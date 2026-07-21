/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Effect, Layer, Stream } from 'effect';
import { LLM, LLMClient, Message } from '@opencode-ai/llm';
import { fetchLayer as requestExecutorFetchLayer } from '@opencode-ai/llm/route';
import { configure as configureOpenAI } from '@opencode-ai/llm/providers/openai';
import { configure as configureAnthropic } from '@opencode-ai/llm/providers/anthropic';
import { configure as configureGoogle } from '@opencode-ai/llm/providers/google';

import { LLMChatMessage, OnText, OnFinalMessage, OnError } from '../../common/sendLLMMessageTypes.js';
import { ChatMode, ProviderName } from '../../common/eviSettingsTypes.js';
import { availableTools, InternalToolInfo } from '../../common/prompt/prompts.js';
import { extractXMLToolsWrapper } from './extractGrammar.js';

type OpencodeChatParams = {
	onText: OnText;
	onFinalMessage: OnFinalMessage;
	onError: OnError;
	providerName: ProviderName;
	modelName: string;
	settings: Record<string, string>;
	messages: LLMChatMessage[];
	separateSystemMessage: string | undefined;
	mcpTools: InternalToolInfo[] | undefined;
	chatMode: ChatMode | null;
	_setAborter: (aborter: () => void) => void;
};

// Effect layer wiring: LLMClient → RequestExecutor → FetchHttpClient
const _llmLayer = LLMClient.layer.pipe(Layer.provide(requestExecutorFetchLayer));

async function resolveModel(providerName: ProviderName, modelName: string, settings: Record<string, string>) {
	switch (providerName) {
		case 'openAI':
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: settings.endpoint || undefined }).chat(modelName);
		case 'anthropic':
			return configureAnthropic({ apiKey: settings.apiKey, baseURL: settings.endpoint || undefined }).model(modelName);
		case 'gemini':
			return configureGoogle({ apiKey: settings.apiKey, baseURL: settings.endpoint || undefined }).model(modelName);
		case 'deepseek':
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: settings.endpoint || 'https://api.deepseek.com/v1' }).chat(modelName);
		case 'openRouter':
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: 'https://openrouter.ai/api/v1' } as any).chat(modelName);
		case 'groq':
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: 'https://api.groq.com/openai/v1' }).chat(modelName);
		case 'xAI':
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: 'https://api.x.ai/v1' }).chat(modelName);
		case 'mistral':
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: 'https://api.mistral.ai/v1' }).chat(modelName);
		case 'ollama':
		case 'vLLM':
		case 'liteLLM':
		case 'lmStudio':
			return configureOpenAI({ apiKey: settings.apiKey || 'noop', baseURL: `${settings.endpoint}/v1` }).chat(modelName);
		case 'openAICompatible':
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: settings.endpoint } as any).chat(modelName);
		case 'microsoftAzure': {
			const apiVersion = settings.azureApiVersion || '2024-10-21';
			const azureMod: any = await import('@opencode-ai/llm/providers/azure');
			return azureMod.configure({ apiKey: settings.apiKey, resourceName: settings.project, apiVersion }).chat(modelName);
		}
		case 'awsBedrock': {
			let baseURL = settings.endpoint || 'http://localhost:4000/v1';
			if (!baseURL.endsWith('/v1')) baseURL = baseURL.replace(/\/+$/, '') + '/v1';
			return configureOpenAI({ apiKey: settings.apiKey, baseURL }).chat(modelName);
		}
		case 'googleVertex': {
			return configureOpenAI({ apiKey: settings.apiKey, baseURL: `https://${settings.region}-aiplatform.googleapis.com/v1/projects/${settings.project}/locations/${settings.region}/endpoints/openapi` }).chat(modelName);
		}
		default:
			throw new Error(`Unsupported provider: ${providerName}`);
	}
}

function convertMessages(messages: LLMChatMessage[], replayReasoning: boolean): any[] {
	const result: any[] = [];
	for (const msg of messages) {
		const m = msg as any;
		if (m.role === 'user') {
			const content = typeof m.content === 'string' ? m.content : '';
			result.push(Message.user(content));
		} else if (m.role === 'assistant') {
			// Evi can represent reasoning either in the OpenAI-compatible field
			// or as structured content (Anthropic-style `thinking` / OpenCode-style
			// `reasoning`). DeepSeek requires the reasoning text to be replayed on
			// every assistant turn when using a thinking model.
			const contentParts = Array.isArray(m.content) ? m.content : [];
			const structuredReasoning = contentParts
				.filter((p: any) => p?.type === 'thinking' || p?.type === 'reasoning')
				.map((p: any) => typeof p.text === 'string' ? p.text : typeof p.thinking === 'string' ? p.thinking : '')
				.filter(Boolean)
				.join('\n\n');
			const reasoningContent = [m.reasoning_content, m.reasoning, structuredReasoning]
				.find((value) => typeof value === 'string' && value.length > 0) as string | undefined;
			const toolCalls = m.tool_calls || contentParts.filter((p: any) => p?.type === 'tool_use' || p?.type === 'tool-call');
			// DeepSeek's thinking endpoint validates every assistant turn in the
			// replayed conversation. Older Evi messages may have no stored
			// reasoning, so emit an explicit empty reasoning_content for them.
			const reasoningPart = reasoningContent ?? (replayReasoning ? '' : undefined);
			if (reasoningPart !== undefined || (toolCalls && toolCalls.length > 0)) {
				const parts: any[] = [];
				if (reasoningPart !== undefined) parts.push({ type: 'reasoning' as const, text: reasoningPart });
				const textContent = typeof m.content === 'string'
					? m.content
					: contentParts.filter((p: any) => p?.type === 'text').map((p: any) => p.text || '').join('');
				if (textContent) parts.push({ type: 'text' as const, text: textContent });
				for (const tc of toolCalls || []) {
					const tcName = tc.function?.name || tc.name;
					let tcInput = tc.input || {};
					if (tc.function?.arguments) {
						try { tcInput = JSON.parse(tc.function.arguments || '{}'); } catch { /* keep empty input */ }
					}
					parts.push({ type: 'tool-call' as const, id: tc.id || tc.tool_call_id, name: tcName, input: tcInput });
				}
				result.push(Message.assistant(parts));
			} else {
				result.push(Message.assistant(typeof m.content === 'string' ? m.content : ''));
			}
		} else if (m.role === 'tool') {
			result.push(Message.tool({ id: m.tool_call_id, name: m.name || 'unknown', result: m.content }));
		} else if (m.role === 'system') {
			result.push(Message.system(m.content));
		}
	}
	return result;
}

export async function sendWithOpencode(params: OpencodeChatParams): Promise<void> {
	const { onText, onFinalMessage, onError, providerName, modelName, settings, messages, separateSystemMessage, mcpTools, chatMode, _setAborter } = params;

	let structuredToolCall: { name: string; id: string; params: Record<string, unknown> } | null = null;
	let rawFullText = '';
	let displayFullText = '';

	// detect and strip generic XML tool calls like <components/tool_calls>...</components/tool_calls>
	const toolCallRegex = /<components\/tool_calls>[\s\S]*?<\/components\/tool_calls>/g;
	const invokeToolCallsRegex = /<tool_calls>\s*([\s\S]*?)\s*<\/tool_calls>/g;

	// Strip opencode-style XML tool calls from the end of text.
	// The model outputs tool calls as XML at the end of its response:
	//   <read><filePath>/path</filePath></read>
	//   <bash><command>ls</command></bash>
	// These should be hidden from the display text since they're
	// already handled as structured tool-call events.
	const opencodeToolCallEndPattern = /(?:<\w+>(?:\s*<\w+>[^<]*<\/\w+>\s*)*<\/\w+>\s*)+$/;
	const opencodePartialToolCallEndPattern = /<\w+>[\s\S]*$/;
	function stripOpencodeToolCalls(text: string): string {
		// Strip complete tool call blocks at the end
		const result = text.replace(opencodeToolCallEndPattern, '').trimEnd();
		if (result.length < text.length) return result;

		// Strip partial (incomplete) tool call at the end during streaming
		const partialMatch = text.match(opencodePartialToolCallEndPattern);
		if (partialMatch && partialMatch.index !== undefined && partialMatch.index > 0) {
			const beforePartial = text.substring(0, partialMatch.index).trimEnd();
			if (beforePartial.length > 0) return beforePartial;
		}

		return text.trimEnd();
	}

	const decodeXML = (value: string): string => value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

	// Some OpenAI-compatible models emit the Claude/OpenCode envelope
	// `<tool_calls><invoke name="read"><parameter ...>...</parameter>`.
	// Evi's existing grammar expects `<read><file_path>...</file_path></read>`.
	// Normalize the envelope before passing it to extractXMLToolsWrapper.
	function normalizeInvokeToolCalls(text: string): string {
		return text.replace(invokeToolCallsRegex, (_whole, body: string) => body.replace(
			/<invoke\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/invoke>/g,
			(_invoke, name: string, paramsBody: string) => {
				const params = [...paramsBody.matchAll(/<parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/parameter>/g)]
					.map((match) => `<${match[1]}>${decodeXML(match[2])}</${match[1]}>`)
					.join('');
				return `<${name}>${params}</${name}>`;
			},
		));
	}

	function detectAndStripToolCallXML(text: string): { clean: string; toolCall: { name: string; id: string; params: Record<string, unknown> } | null } {
		const matches = [...text.matchAll(toolCallRegex)];
		if (matches.length === 0) return { clean: text, toolCall: null };

		const last = matches[matches.length - 1][0];
		const clean = text.replace(toolCallRegex, '').trim();

		const uriMatch = last.match(/uri="([^"]+)"/);
		const argsMatch = last.match(/arguments="([^"]+)"/);
		if (uriMatch) {
			const name = uriMatch[1];
			let params: Record<string, unknown> = {};
			try {
				params = JSON.parse(argsMatch?.[1]?.replace(/&quot;/g, '"') || '{}');
			} catch { /* ignore parse errors */ }
			return { clean, toolCall: { name, id: name, params } };
		}
		return { clean, toolCall: null };
	}

	const wrappedOnFinalMessage: OnFinalMessage = (wrapperParams) => {
		const { toolCall: xmlToolCall } = detectAndStripToolCallXML(rawFullText);
		const mergedToolCall = wrapperParams.toolCall || xmlToolCall || (structuredToolCall ? { name: structuredToolCall.name, rawParams: structuredToolCall.params as any, id: structuredToolCall.id, doneParams: Object.keys(structuredToolCall.params || {}), isDone: true } : undefined);
		onFinalMessage({
			...wrapperParams,
			toolCall: mergedToolCall as any,
		});
	};

	const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, wrappedOnFinalMessage, chatMode, mcpTools);

	// Convert Evi's tool definitions to the format expected by @opencode-ai/llm
	const toolDefs: ReadonlyArray<{ name: string; description: string; inputSchema: Record<string, unknown> }> = chatMode
		? (availableTools(chatMode, mcpTools) ?? []).map(t => ({
			name: t.name,
			description: t.description,
			inputSchema: {
				type: 'object',
				properties: Object.fromEntries(
					Object.entries(t.params).map(([name, param]) => [
						name,
						{ type: 'string', description: param.description }
					])
				),
			},
		}))
		: [];

	try {
		const model = await resolveModel(providerName, modelName, settings);
		const replayReasoning = providerName === 'deepseek';
		const opencodeMessages = convertMessages(messages, replayReasoning);

		const request = LLM.request({
			model,
			system: separateSystemMessage || undefined,
			messages: opencodeMessages,
			tools: toolDefs,
			toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
		});

		let aborted = false;
		_setAborter(() => { aborted = true; });

		let fullReasoning = '';

		const stream = LLMClient.stream(request);

		await (Effect.runPromise as Function)(
			Stream.runForEach(stream, (event) =>
				Effect.sync(() => {
					if (aborted) return;
					const evt = event as any;
		switch (evt.type) {
		case 'text-delta':
							rawFullText += evt.text;
							const { clean } = detectAndStripToolCallXML(rawFullText);
							displayFullText = stripOpencodeToolCalls(normalizeInvokeToolCalls(clean));
							newOnText({ fullText: displayFullText, fullReasoning });
							break;
						case 'text-end':
								if (evt.text !== undefined) rawFullText = evt.text;
								break;
						case 'reasoning-delta':
								fullReasoning += evt.text;
								break;
						case 'reasoning-end':
								fullReasoning = evt.reasoning;
								break;
						case 'tool-call': {
								const input = evt.input || {};
								const stringParams: Record<string, string> = {};
								for (const [key, value] of Object.entries(input)) {
									stringParams[key] = typeof value === 'string' ? value : JSON.stringify(value);
								}
								structuredToolCall = { name: evt.name, id: evt.id, params: stringParams };
							break;
						}
					}
				}),
			).pipe(Effect.provide(_llmLayer)),
		);

		if (!aborted) {
			const finalReasoning = fullReasoning || '';
			newOnFinalMessage({
				fullText: displayFullText || '',
				fullReasoning: finalReasoning,
				anthropicReasoning: null,
			});
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const stack = err instanceof Error ? err.stack : undefined;
		console.error('[opencode] sendWithOpencode error:', message, '\nstack:', stack);
		onError({ message, fullError: err instanceof Error ? err : null });
	}
}

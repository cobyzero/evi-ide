/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Protocol types for bi-directional communication between evi-ide and opencode agent.
// Communication happens over stdin/stdout using NDJSON (newline-delimited JSON).

// ===== Messages from evi-ide → opencode (stdin) =====

export type OpencodeAgentConfig = {
	type: 'config';
	model: {
		provider: string;
		model: string;
		apiKey?: string;
		baseUrl?: string;
	};
	workspace: string;
};

export type OpencodeAgentMessage = {
	type: 'message';
	content: string;
	selections?: { type: 'File' | 'CodeSelection'; uri: string; range?: [number, number] }[];
};

export type OpencodeAgentAbort = {
	type: 'abort';
};

export type OpencodeAgentStdinMessage =
	| OpencodeAgentConfig
	| OpencodeAgentMessage
	| OpencodeAgentAbort;

// ===== Messages from opencode → evi-ide (stdout) =====

export type OpencodeAgentText = {
	type: 'text';
	content: string;
};

export type OpencodeAgentReasoning = {
	type: 'reasoning';
	content: string;
};

export type OpencodeAgentToolCall = {
	type: 'tool_call';
	name: string;
	params: Record<string, unknown>;
};

export type OpencodeAgentToolResult = {
	type: 'tool_result';
	name: string;
	content: string;
};

export type OpencodeAgentError = {
	type: 'error';
	message: string;
};

export type OpencodeAgentDone = {
	type: 'done';
};

export type OpencodeAgentStdoutMessage =
	| OpencodeAgentText
	| OpencodeAgentReasoning
	| OpencodeAgentToolCall
	| OpencodeAgentToolResult
	| OpencodeAgentError
	| OpencodeAgentDone;

// ===== Error types =====

export class OpencodeAgentErrorCode extends Error {
	constructor(
		message: string,
		public readonly code: 'not-found' | 'spawn-failed' | 'protocol-error' | 'timeout' | 'crashed',
	) {
		super(message);
	}
}

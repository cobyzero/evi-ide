/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

declare module '@opencode-ai/llm' {
  export type LLMRequest = any;
  export type LLMEvent = any;
  export type LLMResponse = { text: string; finishReason: string; usage: any; steps: any[]; events: LLMEvent[] };
  export namespace LLM {
    export function request(input: LLMRequest): LLMRequest;
    export function updateRequest(base: LLMRequest, update: Partial<LLMRequest>): LLMRequest;
  }
  export namespace LLMClient {
    export function stream(request: LLMRequest): any;
    export function generate(request: LLMRequest): any;
    export const layer: any;
  }
  export namespace Message {
    export function system(content: string): any;
    export function user(content: string): any;
    export function assistant(content: string | any[]): any;
    export function tool(result: { id: string; name: string; result: any; isError?: boolean }): any;
  }
  export namespace Tool {
    export function make(config: { description: string; parameters: any; output?: any; execute: (input: any) => any }): any;
  }
  export class ToolFailure { readonly _tag: 'ToolFailure'; readonly error: string; constructor(error: string); }
  export function toDefinitions(tools: Record<string, any>): any[];
  export namespace ToolRuntime { export function dispatch(tools: Record<string, any>, call: any): any; }
}

declare module '@opencode-ai/llm/route' {
  export const fetchLayer: any;
  export const LLMClient: any;
  export namespace RequestExecutor {
    export const fetchLayer: any;
  }
}

declare module '@opencode-ai/llm/providers/openai' {
  export function configure(config: { apiKey?: string; baseURL?: string; organization?: string; project?: string; auth?: any }): {
    chat(model: string): any;
    responses(model: string): any;
    model(model: string): any;
    responsesWebSocket(model: string): any;
  };
  export const chat: (id: string) => any;
  export const model: (id: string) => any;
  export const responses: (id: string) => any;
}

declare module '@opencode-ai/llm/providers/anthropic' {
  export function configure(config: { apiKey?: string; baseURL?: string; auth?: any }): {
    model(model: string): any;
  };
}

declare module '@opencode-ai/llm/providers/google' {
  export function configure(config: { apiKey?: string; baseURL?: string; auth?: any }): {
    model(model: string): any;
  };
}

declare module '@opencode-ai/llm/providers/openai-compatible' {
  export function model(config: { apiKey?: string; baseURL: string; model: string; auth?: any }): any;
}

declare module '@opencode-ai/llm/providers/azure' {
  export function configure(config: { apiKey?: string; resourceName: string; apiVersion?: string; auth?: any }): {
    chat(model: string): any;
    model(model: string): any;
  };
}

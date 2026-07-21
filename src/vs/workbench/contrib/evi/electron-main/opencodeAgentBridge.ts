/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { createInterface } from 'readline';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import {
	OpencodeAgentConfig,
	OpencodeAgentStdoutMessage,
	OpencodeAgentStdinMessage,
} from '../common/opencodeAgentTypes.js';

export interface IOpencodeAgentBridge {
	readonly _serviceBrand: undefined;

	/** Check if opencode is available (bundled or system-installed) */
	isAvailable(): Promise<boolean>;

	/** Start a new agent session */
	startSession(config: OpencodeAgentConfig): Promise<void>;

	/** Send a user message to the running agent */
	sendMessage(content: string): void;

	/** Send abort signal to the running agent */
	abortSession(): void;

	/** Events from the running agent */
	onDidReceiveText: Event<string>;
	onDidReceiveReasoning: Event<string>;
	onDidToolCall: Event<{ name: string; params: Record<string, unknown> }>;
	onDidToolResult: Event<{ name: string; content: string }>;
	onDidError: Event<string>;
	onDidSessionEnd: Event<void>;
	onDidSessionStart: Event<void>;
}

export class OpencodeAgentBridge extends Disposable implements IOpencodeAgentBridge {
	readonly _serviceBrand: undefined;

	private _childProcess: ChildProcess | null = null;
	private _readline: ReturnType<typeof createInterface> | null = null;

	private readonly _onDidReceiveText = this._register(new Emitter<string>());
	private readonly _onDidReceiveReasoning = this._register(new Emitter<string>());
	private readonly _onDidToolCall = this._register(new Emitter<{ name: string; params: Record<string, unknown> }>());
	private readonly _onDidToolResult = this._register(new Emitter<{ name: string; content: string }>());
	private readonly _onDidError = this._register(new Emitter<string>());
	private readonly _onDidSessionEnd = this._register(new Emitter<void>());
	private readonly _onDidSessionStart = this._register(new Emitter<void>());

	readonly onDidReceiveText: Event<string> = this._onDidReceiveText.event;
	readonly onDidReceiveReasoning: Event<string> = this._onDidReceiveReasoning.event;
	readonly onDidToolCall: Event<{ name: string; params: Record<string, unknown> }> = this._onDidToolCall.event;
	readonly onDidToolResult: Event<{ name: string; content: string }> = this._onDidToolResult.event;
	readonly onDidError: Event<string> = this._onDidError.event;
	readonly onDidSessionEnd: Event<void> = this._onDidSessionEnd.event;
	readonly onDidSessionStart: Event<void> = this._onDidSessionStart.event;

	private static readonly _BUNDLED_PATH = 'node_modules/.bin/opencode';

	async isAvailable(): Promise<boolean> {
		if (this._findOpencodeBinary()) return true;
		return false;
	}

	private _findOpencodeBinary(): string | null {
		// Check bundled path
		try {
			require.resolve('opencode');
			return OpencodeAgentBridge._BUNDLED_PATH;
		} catch {
			// not bundled
		}

		// Check system PATH
		const envPath = process.env.PATH || '';
		const paths = envPath.split(':');
		for (const p of paths) {
			const candidate = `${p}/opencode`;
			try {
				require('fs').accessSync(candidate, require('constants').X_OK);
				return candidate;
			} catch {
				continue;
			}
		}

		return null;
	}

	async startSession(config: OpencodeAgentConfig): Promise<void> {
		this._killSession();

		const binaryPath = this._findOpencodeBinary();
		if (!binaryPath) {
			this._onDidError.fire('opencode binary not found. Install it with: npm install -g opencode');
			return;
		}

		const options: SpawnOptions = {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: {
				...process.env,
				...(config.model.apiKey ? { OPENCODE_API_KEY: config.model.apiKey } : {}),
				...(config.model.baseUrl ? { OPENCODE_BASE_URL: config.model.baseUrl } : {}),
				OPENCODE_PROVIDER: config.model.provider,
				OPENCODE_MODEL: config.model.model,
				OPENCODE_MODE: 'agent',
			},
		};

		try {
			this._childProcess = spawn(binaryPath, ['--agent'], options);
		} catch (err) {
			this._onDidError.fire(`Failed to spawn opencode: ${err instanceof Error ? err.message : String(err)}`);
			return;
		}

		const child = this._childProcess;
		if (!child.stdin || !child.stdout) {
			this._onDidError.fire('Failed to create stdio pipes for opencode');
			this._killSession();
			return;
		}

		// Handle stdout - parse NDJSON
		this._readline = createInterface({ input: child.stdout });
		this._readline.on('line', (line: string) => {
			try {
				const msg: OpencodeAgentStdoutMessage = JSON.parse(line);
				this._handleMessage(msg);
			} catch {
				// not JSON - treat as raw text
				this._onDidReceiveText.fire(line);
			}
		});

		// Handle stderr (forward as-is for debugging)
		child.stderr?.on('data', (data: Buffer) => {
			console.error('[opencode-agent]', data.toString());
		});

		// Handle exit
		child.on('exit', (code) => {
			this._childProcess = null;
			this._readline = null;
			this._onDidSessionEnd.fire();
		});

		child.on('error', (err) => {
			this._onDidError.fire(`opencode process error: ${err.message}`);
			this._killSession();
		});

		// Send initial config
		this._sendToStdin(config);
		this._onDidSessionStart.fire();
	}

	private _handleMessage(msg: OpencodeAgentStdoutMessage): void {
		switch (msg.type) {
			case 'text':
				this._onDidReceiveText.fire(msg.content);
				break;
			case 'reasoning':
				this._onDidReceiveReasoning.fire(msg.content);
				break;
			case 'tool_call':
				this._onDidToolCall.fire({ name: msg.name, params: msg.params });
				break;
			case 'tool_result':
				this._onDidToolResult.fire({ name: msg.name, content: msg.content });
				break;
			case 'error':
				this._onDidError.fire(msg.message);
				break;
			case 'done':
				this._onDidSessionEnd.fire();
				break;
		}
	}

	sendMessage(content: string): void {
		const msg: OpencodeAgentStdinMessage = {
			type: 'message',
			content,
		};
		this._sendToStdin(msg);
	}

	abortSession(): void {
		const msg: OpencodeAgentStdinMessage = { type: 'abort' };
		this._sendToStdin(msg);
	}

	private _sendToStdin(msg: OpencodeAgentStdinMessage): void {
		if (!this._childProcess?.stdin) return;
		this._childProcess.stdin.write(JSON.stringify(msg) + '\n');
	}

	private _killSession(): void {
		if (this._childProcess) {
			this._childProcess.kill();
			this._childProcess = null;
		}
		if (this._readline) {
			this._readline.close();
			this._readline = null;
		}
	}

	override dispose(): void {
		this._killSession();
		super.dispose();
	}
}

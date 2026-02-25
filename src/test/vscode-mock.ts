// Register a fake 'vscode' module before anything tries to import it
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;

class FakeEventEmitter {
	private listeners: Function[] = [];
	event = (listener: Function) => {
		this.listeners.push(listener);
		return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
	};
	fire(data: any) {
		for (const listener of this.listeners) {
			listener(data);
		}
	}
	dispose() {
		this.listeners = [];
	}
}

const onDidEndTaskProcessEmitter = new FakeEventEmitter();
const onDidEndTerminalShellExecutionEmitter = new FakeEventEmitter();

const vscode = {
	EventEmitter: FakeEventEmitter,
	tests: {},
	tasks: {
		onDidEndTaskProcess: onDidEndTaskProcessEmitter.event,
		_emitter: onDidEndTaskProcessEmitter,
	},
	TaskGroup: {
		Test: { id: 'test' },
		Build: { id: 'build' },
	},
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: () => ({
			get: () => undefined,
		}),
	},
	window: {
		showWarningMessage: () => {},
		createOutputChannel: () => ({
			info: () => {},
			debug: () => {},
			appendLine: () => {},
			dispose: () => {},
		}),
		onDidEndTerminalShellExecution: onDidEndTerminalShellExecutionEmitter.event,
	},
};

Module._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
	if (request === 'vscode') {
		return 'vscode';
	}
	return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.cache['vscode'] = {
	id: 'vscode',
	filename: 'vscode',
	loaded: true,
	exports: vscode,
	parent: null,
	children: [],
	paths: [],
	path: '',
} as any;

export { vscode, onDidEndTaskProcessEmitter, onDidEndTerminalShellExecutionEmitter };

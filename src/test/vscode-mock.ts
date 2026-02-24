// Register a fake 'vscode' module before anything tries to import it
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
const vscode = {
	tests: {},
	workspace: {
		workspaceFolders: undefined,
		getConfiguration: () => ({
			get: () => undefined,
		}),
	},
	window: {
		showWarningMessage: () => {},
		createOutputChannel: () => ({
			appendLine: () => {},
			dispose: () => {},
		}),
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

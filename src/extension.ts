import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

const SUPPORTED_FORMATS = ['.wav', '.mp3'];

const warnedPaths = new Set<string>();

// Access proposed test observer API dynamically
const testsApi = vscode.tests as any;

export function resolveAudioCommand(filePath: string, platform: string, volume: number): string[] {
	const ext = path.extname(filePath).toLowerCase();

	switch (platform) {
		case 'darwin':
			return ['afplay', '-v', String(volume), filePath];

		case 'linux':
			if (ext === '.mp3') {
				return ['mpg123', '-q', filePath];
			}
			return ['aplay', '-q', filePath];

		case 'win32':
			if (ext === '.mp3') {
				return ['cmd', '/c', 'start', '', 'wmplayer', filePath];
			}
			return [
				'powershell', '-NoProfile', '-Command',
				`(New-Object Media.SoundPlayer '${filePath}').PlaySync()`
			];

		default:
			return [];
	}
}

export function resolveSoundPath(
	configValue: string | undefined,
	defaultSoundPath: string,
	label: string,
	workspaceFolders?: readonly { uri: { fsPath: string } }[]
): string {
	if (!configValue) {
		return defaultSoundPath;
	}

	let resolved = configValue;

	if (!path.isAbsolute(resolved)) {
		if (workspaceFolders && workspaceFolders.length > 0) {
			resolved = path.join(workspaceFolders[0].uri.fsPath, resolved);
		}
	}

	const ext = path.extname(resolved).toLowerCase();
	if (!SUPPORTED_FORMATS.includes(ext)) {
		if (!warnedPaths.has(configValue)) {
			warnedPaths.add(configValue);
			vscode.window.showWarningMessage(
				`Test Bell: Custom ${label} sound "${configValue}" has unsupported format (${ext || 'none'}). Using default sound.`
			);
		}
		return defaultSoundPath;
	}

	if (!fs.existsSync(resolved)) {
		if (!warnedPaths.has(configValue)) {
			warnedPaths.add(configValue);
			vscode.window.showWarningMessage(
				`Test Bell: Custom ${label} sound "${configValue}" not found. Using default sound.`
			);
		}
		return defaultSoundPath;
	}

	return resolved;
}

export function hasFailedTests(snapshots: any[]): boolean {
	for (const snapshot of snapshots) {
		for (const taskState of snapshot.taskStates) {
			if (taskState.state === 4 /* Failed */ || taskState.state === 6 /* Errored */) {
				return true;
			}
		}
		if (snapshot.children && hasFailedTests(snapshot.children)) {
			return true;
		}
	}
	return false;
}

function playSound(filePath: string, volume: number): void {
	const args = resolveAudioCommand(filePath, process.platform, volume);
	if (args.length === 0) {
		return;
	}

	const [command, ...rest] = args;
	execFile(command, rest, () => {
		// Silently ignore playback errors
	});
}

export function activate(context: vscode.ExtensionContext) {
	const onDidChangeTestResults = testsApi.onDidChangeTestResults;
	if (!onDidChangeTestResults) {
		return;
	}

	const defaultFailSound = path.join(context.extensionPath, 'sounds', 'fail.mp3');
	const defaultPassSound = path.join(context.extensionPath, 'sounds', 'pass.mp3');

	const disposable = onDidChangeTestResults(() => {
		const config = vscode.workspace.getConfiguration('testBell');

		if (!config.get<boolean>('enabled', true)) {
			return;
		}

		const results: any[] = testsApi.testResults;
		if (results.length === 0) {
			return;
		}

		const latest = results[0];
		const volume = config.get<number>('volume', 1);

		if (hasFailedTests(latest.results)) {
			const failSound = resolveSoundPath(
				config.get<string>('failSound'),
				defaultFailSound,
				'fail',
				vscode.workspace.workspaceFolders
			);
			playSound(failSound, volume);
		} else if (config.get<boolean>('playOnSuccess', false)) {
			const passSound = resolveSoundPath(
				config.get<string>('passSound'),
				defaultPassSound,
				'pass',
				vscode.workspace.workspaceFolders
			);
			playSound(passSound, volume);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	warnedPaths.clear();
}

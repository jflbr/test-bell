import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { ISoundPlayer } from './interfaces';

const SUPPORTED_FORMATS = ['.wav', '.mp3'];

const warnedPaths = new Set<string>();

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

export class SoundPlayer implements ISoundPlayer {
	constructor(
		private readonly extensionPath: string,
		private readonly getConfig: () => vscode.WorkspaceConfiguration
	) {}

	playFailSound(): void {
		const config = this.getConfig();
		const volume = config.get<number>('volume', 1);
		const defaultSound = path.join(this.extensionPath, 'sounds', 'fail.mp3');
		const soundPath = resolveSoundPath(
			config.get<string>('failSound'),
			defaultSound,
			'fail',
			vscode.workspace.workspaceFolders
		);
		this.play(soundPath, volume);
	}

	playPassSound(): void {
		const config = this.getConfig();
		const volume = config.get<number>('volume', 1);
		const defaultSound = path.join(this.extensionPath, 'sounds', 'pass.mp3');
		const soundPath = resolveSoundPath(
			config.get<string>('passSound'),
			defaultSound,
			'pass',
			vscode.workspace.workspaceFolders
		);
		this.play(soundPath, volume);
	}

	private play(filePath: string, volume: number): void {
		const args = resolveAudioCommand(filePath, process.platform, volume);
		if (args.length === 0) {
			return;
		}

		const [command, ...rest] = args;
		execFile(command, rest, () => {
			// Silently ignore playback errors
		});
	}
}

export function clearWarnedPaths(): void {
	warnedPaths.clear();
}

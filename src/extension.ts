import * as vscode from 'vscode';
import { TestObserver } from './testObserver';
import { ResultAnalyzer } from './resultAnalyzer';
import { SoundPlayer, clearWarnedPaths } from './soundPlayer';

export function activate(context: vscode.ExtensionContext) {
	const observer = new TestObserver();
	const analyzer = new ResultAnalyzer();
	const player = new SoundPlayer(
		context.extensionPath,
		() => vscode.workspace.getConfiguration('testBell')
	);

	const subscription = observer.onTestRunCompleted((run) => {
		const config = vscode.workspace.getConfiguration('testBell');

		if (!config.get<boolean>('enabled', true)) {
			return;
		}

		if (analyzer.hasFailures(run.results)) {
			player.playFailSound();
		} else if (config.get<boolean>('playOnSuccess', false)) {
			player.playPassSound();
		}
	});

	context.subscriptions.push(observer, subscription);
}

export function deactivate() {
	clearWarnedPaths();
}

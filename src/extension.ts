import * as vscode from 'vscode';
import { CompositeTestObserver } from './testObserver';
import { SoundPlayer, clearWarnedPaths } from './soundPlayer';

const PROPOSED_API_HINT_KEY = 'testBell.proposedApiHintDismissed';

export function activate(context: vscode.ExtensionContext) {
	const log = vscode.window.createOutputChannel('Test Bell', { log: true });

	log.info('Test Bell: activating');

	const observer = new CompositeTestObserver();
	const player = new SoundPlayer(
		context.extensionPath,
		() => vscode.workspace.getConfiguration('testBell')
	);

	if (!observer.proposedApiAvailable && !context.globalState.get<boolean>(PROPOSED_API_HINT_KEY)) {
		const message = 'Test Bell: To enable sounds for tests run from the Testing UI, add "jflbr.test-bell" to "enable-proposed-api" in runtime arguments and restart.';
		vscode.window.showInformationMessage(message, 'Configure', "Don't Show Again").then((choice) => {
			if (choice === 'Configure') {
				vscode.commands.executeCommand('workbench.action.configureRuntimeArguments');
			} else if (choice === "Don't Show Again") {
				context.globalState.update(PROPOSED_API_HINT_KEY, true);
			}
		});
	}

	const subscription = observer.onTestRunCompleted((result) => {
		const config = vscode.workspace.getConfiguration('testBell');

		if (!config.get<boolean>('enabled', true)) {
			log.info('Test Bell: disabled via config, skipping sound');
			return;
		}

		if (!result.passed) {
			log.info('Test Bell: playing fail sound');
			player.playFailSound();
		} else if (config.get<boolean>('playOnSuccess', true)) {
			log.info('Test Bell: playing pass sound');
			player.playPassSound();
		} else {
			log.info('Test Bell: tests passed but playOnSuccess is off');
		}
	});

	context.subscriptions.push(observer, subscription, log);

	log.info('Test Bell: activated successfully');
}

export function deactivate() {
	clearWarnedPaths();
}

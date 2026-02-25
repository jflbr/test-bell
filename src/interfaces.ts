import * as vscode from 'vscode';

export interface TestRunResult {
	passed: boolean;
}

export interface ITestObserver extends vscode.Disposable {
	onTestRunCompleted: vscode.Event<TestRunResult>;
}

export interface ISoundPlayer {
	playFailSound(): void;
	playPassSound(): void;
}

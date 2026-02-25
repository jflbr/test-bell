import * as vscode from 'vscode';

export interface TestRunSnapshot {
	results: ReadonlyArray<TestResultSnapshot>;
}

export interface TestResultSnapshot {
	taskStates: ReadonlyArray<{ state: number }>;
	children: ReadonlyArray<TestResultSnapshot>;
}

export interface ITestObserver extends vscode.Disposable {
	onTestRunCompleted: vscode.Event<TestRunSnapshot>;
}

export interface IResultAnalyzer {
	hasFailures(snapshots: ReadonlyArray<TestResultSnapshot>): boolean;
}

export interface ISoundPlayer {
	playFailSound(): void;
	playPassSound(): void;
}

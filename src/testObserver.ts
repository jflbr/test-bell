import * as vscode from 'vscode';
import { ITestObserver, TestRunSnapshot } from './interfaces';

export class TestObserver implements ITestObserver {
	private readonly _onTestRunCompleted = new vscode.EventEmitter<TestRunSnapshot>();
	readonly onTestRunCompleted = this._onTestRunCompleted.event;

	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		const subscription = vscode.tests.onDidChangeTestResults(() => {
			const results = vscode.tests.testResults;
			if (results.length === 0) {
				return;
			}
			this._onTestRunCompleted.fire(results[0]);
		});

		this.disposables.push(subscription, this._onTestRunCompleted);
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}

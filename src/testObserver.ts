import * as vscode from 'vscode';
import { ITestObserver, TestRunResult } from './interfaces';

const log = vscode.window.createOutputChannel('Test Bell', { log: true });

const TEST_COMMAND_PATTERNS = [
	// Python
	/\bpytest\b/,
	/\bunittest\b/,
	/\bpython\b.*\b-m\s+(unittest|pytest)\b/,
	// JavaScript / TypeScript
	/\bnpm\s+(run\s+)?test\b/,
	/\byarn\s+(run\s+)?test\b/,
	/\bpnpm\s+(run\s+)?test\b/,
	/\bnpx\s+(jest|vitest|mocha|ava)\b/,
	/\bjest\b/,
	/\bvitest\b/,
	/\bmocha\b/,
	/\bava\b/,
	/\bbun\s+test\b/,
	/\bdeno\s+test\b/,
	// Go
	/\bgo\s+test\b/,
	// Rust
	/\bcargo\s+test\b/,
	// Ruby
	/\brspec\b/,
	/\brake\s+test\b/,
	/\bminitest\b/,
	// PHP
	/\bphpunit\b/,
	/\bpest\b/,
	// Java / JVM
	/\bmvn\s+(test|verify)\b/,
	/\bmaven\s+test\b/,
	/\bgradle\s+test\b/,
	/\bsbt\s+test\b/,
	// .NET
	/\bdotnet\s+test\b/,
	// Elixir
	/\bmix\s+test\b/,
	// Swift
	/\bswift\s+test\b/,
];

// Matches test file naming conventions: test_*.py, *_test.py, *_test.go, *.test.js, *.spec.ts, etc.
const TEST_FILE_PATTERN = /(?:^|\s|[/\\])test_[^/\\\s]+\.\w+(?:\s|$)|(?:^|\s|[/\\])[^/\\\s]+[._-](?:test|spec)\.\w+(?:\s|$)/;

function isTestCommand(commandLine: string): boolean {
	const lower = commandLine.toLowerCase();
	if (TEST_COMMAND_PATTERNS.some(p => p.test(lower))) {
		return true;
	}
	// Match commands that run a test file directly (e.g. "python test_foo.py")
	return TEST_FILE_PATTERN.test(lower);
}

/**
 * Returns true if the task is a test task — by group, name, or execution command.
 */
function isTestTask(task: vscode.Task): boolean {
	if (task.group?.id === vscode.TaskGroup.Test.id) {
		return true;
	}
	const name = task.name.toLowerCase();
	if (name.includes('test')) {
		return true;
	}
	// Check the shell execution command line (e.g. Python extension runs "python test_foo.py")
	const execution = task.execution;
	if (execution && 'commandLine' in execution && typeof execution.commandLine === 'string') {
		return isTestCommand(execution.commandLine);
	}
	return false;
}

/**
 * Listens to task process completions filtered by test tasks.
 * Emits passed: true when exitCode === 0.
 */
export class TaskObserver implements ITestObserver {
	private readonly _onTestRunCompleted = new vscode.EventEmitter<TestRunResult>();
	readonly onTestRunCompleted = this._onTestRunCompleted.event;

	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		log.info('TaskObserver: registering onDidEndTaskProcess listener');

		const subscription = vscode.tasks.onDidEndTaskProcess((e) => {
			const task = e.execution.task;
			log.info(`TaskObserver: task ended — name="${task.name}", source="${task.source}", group=${task.group?.id ?? 'none'}, exitCode=${e.exitCode}`);

			if (isTestTask(task)) {
				const passed = e.exitCode === 0;
				log.info(`TaskObserver: test task detected, passed=${passed}`);
				this._onTestRunCompleted.fire({ passed });
			} else {
				log.debug(`TaskObserver: skipped non-test task "${task.name}"`);
			}
		});

		this.disposables.push(subscription, this._onTestRunCompleted);
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}

/**
 * Listens to terminal shell executions and matches test commands by command line.
 * Requires shell integration to be active in the terminal.
 */
export class TerminalObserver implements ITestObserver {
	private readonly _onTestRunCompleted = new vscode.EventEmitter<TestRunResult>();
	readonly onTestRunCompleted = this._onTestRunCompleted.event;

	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		log.info('TerminalObserver: registering onDidEndTerminalShellExecution listener');

		const subscription = vscode.window.onDidEndTerminalShellExecution((e) => {
			const commandLine = e.execution.commandLine.value;
			log.info(`TerminalObserver: shell execution ended — command="${commandLine}", exitCode=${e.exitCode}`);

			if (isTestCommand(commandLine)) {
				const passed = e.exitCode === 0;
				log.info(`TerminalObserver: test command detected, passed=${passed}`);
				this._onTestRunCompleted.fire({ passed });
			} else {
				log.debug(`TerminalObserver: skipped non-test command "${commandLine}"`);
			}
		});

		this.disposables.push(subscription, this._onTestRunCompleted);
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}

/**
 * Uses the proposed testObserver API (vscode.tests.onDidChangeTestResults)
 * when available at runtime. Falls back to being a no-op if not available.
 */
export class ProposedTestObserver implements ITestObserver {
	private readonly _onTestRunCompleted = new vscode.EventEmitter<TestRunResult>();
	readonly onTestRunCompleted = this._onTestRunCompleted.event;

	private readonly disposables: vscode.Disposable[] = [];
	readonly available: boolean;

	constructor() {
		let connected = false;
		try {
			const tests = (vscode as any).tests;
			const onDidChange = tests?.onDidChangeTestResults;

			if (typeof onDidChange === 'function') {
				log.info('ProposedTestObserver: proposed API available, registering listener');
				const subscription = onDidChange.call(tests, () => {
					const results = tests.testResults;
					if (!results || results.length === 0) {
						return;
					}
					const run = results[0];
					const passed = !this.hasFailures(run.results ?? []);
					log.info(`ProposedTestObserver: test run completed, passed=${passed}`);
					this._onTestRunCompleted.fire({ passed });
				});
				this.disposables.push(subscription);
				connected = true;
			} else {
				log.info('ProposedTestObserver: proposed API not found');
			}
		} catch {
			log.info('ProposedTestObserver: proposed API threw on access, skipping');
		}
		this.available = connected;

		this.disposables.push(this._onTestRunCompleted);
	}

	private hasFailures(snapshots: ReadonlyArray<any>): boolean {
		for (const snapshot of snapshots) {
			for (const taskState of (snapshot.taskStates ?? [])) {
				if (taskState.state === 4 /* Failed */ || taskState.state === 6 /* Errored */) {
					return true;
				}
			}
			if (snapshot.children && this.hasFailures(snapshot.children)) {
				return true;
			}
		}
		return false;
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}

/**
 * Combines TaskObserver, TerminalObserver, and ProposedTestObserver into a single stream.
 */
export class CompositeTestObserver implements ITestObserver {
	private readonly _onTestRunCompleted = new vscode.EventEmitter<TestRunResult>();
	readonly onTestRunCompleted = this._onTestRunCompleted.event;
	readonly proposedApiAvailable: boolean;

	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		const taskObserver = new TaskObserver();
		const terminalObserver = new TerminalObserver();
		const proposedObserver = new ProposedTestObserver();

		this.proposedApiAvailable = proposedObserver.available;
		log.info(`CompositeTestObserver: initialized (proposedAPI=${proposedObserver.available})`);

		this.disposables.push(
			taskObserver,
			terminalObserver,
			proposedObserver,
			taskObserver.onTestRunCompleted((r) => {
				log.info(`CompositeTestObserver: forwarding TaskObserver result, passed=${r.passed}`);
				this._onTestRunCompleted.fire(r);
			}),
			terminalObserver.onTestRunCompleted((r) => {
				log.info(`CompositeTestObserver: forwarding TerminalObserver result, passed=${r.passed}`);
				this._onTestRunCompleted.fire(r);
			}),
			proposedObserver.onTestRunCompleted((r) => {
				log.info(`CompositeTestObserver: forwarding ProposedTestObserver result, passed=${r.passed}`);
				this._onTestRunCompleted.fire(r);
			}),
			this._onTestRunCompleted,
		);
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}

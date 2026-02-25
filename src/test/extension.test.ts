import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { resolveAudioCommand, resolveSoundPath } from '../soundPlayer';
import { vscode, onDidEndTaskProcessEmitter, onDidEndTerminalShellExecutionEmitter } from './vscode-mock';
import { TaskObserver, TerminalObserver } from '../testObserver';

describe('resolveAudioCommand', () => {
	describe('macOS (darwin)', () => {
		it('should use afplay with volume for wav', () => {
			const result = resolveAudioCommand('/sounds/fail.wav', 'darwin', 2);
			assert.deepStrictEqual(result, ['afplay', '-v', '2', '/sounds/fail.wav']);
		});

		it('should use afplay with volume for mp3', () => {
			const result = resolveAudioCommand('/sounds/fail.mp3', 'darwin', 1);
			assert.deepStrictEqual(result, ['afplay', '-v', '1', '/sounds/fail.mp3']);
		});
	});

	describe('Linux', () => {
		it('should use aplay for wav', () => {
			const result = resolveAudioCommand('/sounds/fail.wav', 'linux', 1);
			assert.deepStrictEqual(result, ['aplay', '-q', '/sounds/fail.wav']);
		});

		it('should use mpg123 for mp3', () => {
			const result = resolveAudioCommand('/sounds/fail.mp3', 'linux', 1);
			assert.deepStrictEqual(result, ['mpg123', '-q', '/sounds/fail.mp3']);
		});
	});

	describe('Windows (win32)', () => {
		it('should use PowerShell SoundPlayer for wav', () => {
			const result = resolveAudioCommand('C:\\sounds\\fail.wav', 'win32', 1);
			assert.deepStrictEqual(result, [
				'powershell', '-NoProfile', '-Command',
				"(New-Object Media.SoundPlayer 'C:\\sounds\\fail.wav').PlaySync()"
			]);
		});

		it('should use wmplayer for mp3', () => {
			const result = resolveAudioCommand('C:\\sounds\\fail.mp3', 'win32', 1);
			assert.deepStrictEqual(result, ['cmd', '/c', 'start', '', 'wmplayer', 'C:\\sounds\\fail.mp3']);
		});
	});

	describe('unknown platform', () => {
		it('should return empty array', () => {
			const result = resolveAudioCommand('/sounds/fail.wav', 'freebsd', 1);
			assert.deepStrictEqual(result, []);
		});
	});
});

describe('resolveSoundPath', () => {
	const defaultSound = '/defaults/fail.wav';

	it('should return default when config value is empty', () => {
		assert.strictEqual(resolveSoundPath('', defaultSound, 'fail'), defaultSound);
	});

	it('should return default when config value is undefined', () => {
		assert.strictEqual(resolveSoundPath(undefined, defaultSound, 'fail'), defaultSound);
	});

	it('should return absolute path if file exists and format is supported', () => {
		const tmpFile = path.join(os.tmpdir(), 'test-bell-test.wav');
		fs.writeFileSync(tmpFile, 'fake');
		try {
			const result = resolveSoundPath(tmpFile, defaultSound, 'fail');
			assert.strictEqual(result, tmpFile);
		} finally {
			fs.unlinkSync(tmpFile);
		}
	});

	it('should return default for unsupported format', () => {
		const tmpFile = path.join(os.tmpdir(), 'test-bell-test.ogg');
		fs.writeFileSync(tmpFile, 'fake');
		try {
			const result = resolveSoundPath(tmpFile, defaultSound, 'fail');
			assert.strictEqual(result, defaultSound);
		} finally {
			fs.unlinkSync(tmpFile);
		}
	});

	it('should return default when file does not exist', () => {
		const result = resolveSoundPath('/nonexistent/sound.wav', defaultSound, 'fail');
		assert.strictEqual(result, defaultSound);
	});

	it('should resolve relative path using workspace folders', () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-bell-'));
		const soundFile = path.join(tmpDir, 'alert.wav');
		fs.writeFileSync(soundFile, 'fake');
		try {
			const folders = [{ uri: { fsPath: tmpDir } }];
			const result = resolveSoundPath('alert.wav', defaultSound, 'fail', folders);
			assert.strictEqual(result, soundFile);
		} finally {
			fs.unlinkSync(soundFile);
			fs.rmdirSync(tmpDir);
		}
	});
});

describe('TaskObserver', () => {
	it('should emit passed: true when a test-group task exits with code 0', (done) => {
		const observer = new TaskObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTaskProcessEmitter.fire({
			execution: { task: { name: 'Run Tests', source: 'Workspace', group: vscode.TaskGroup.Test } },
			exitCode: 0,
		});
	});

	it('should emit passed: false when a test-group task exits with non-zero code', (done) => {
		const observer = new TaskObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, false);
			observer.dispose();
			done();
		});

		onDidEndTaskProcessEmitter.fire({
			execution: { task: { name: 'Run Tests', source: 'Workspace', group: vscode.TaskGroup.Test } },
			exitCode: 1,
		});
	});

	it('should match tasks by name containing "test" even without test group', (done) => {
		const observer = new TaskObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTaskProcessEmitter.fire({
			execution: { task: { name: 'npm test', source: 'npm', group: undefined } },
			exitCode: 0,
		});
	});

	it('should not emit for non-test tasks', () => {
		const observer = new TaskObserver();
		let emitted = false;
		observer.onTestRunCompleted(() => { emitted = true; });

		onDidEndTaskProcessEmitter.fire({
			execution: { task: { name: 'build', source: 'npm', group: vscode.TaskGroup.Build } },
			exitCode: 1,
		});

		assert.strictEqual(emitted, false);
		observer.dispose();
	});
});

describe('TerminalObserver', () => {
	it('should emit passed: true when a pytest command exits with code 0', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'python -m pytest tests/' } },
			exitCode: 0,
		});
	});

	it('should emit passed: false when a pytest command fails', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, false);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'pytest' } },
			exitCode: 1,
		});
	});

	it('should detect python unittest commands', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'python -m unittest discover' } },
			exitCode: 0,
		});
	});

	it('should detect npm test commands', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, false);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'npm test' } },
			exitCode: 1,
		});
	});

	it('should detect npm run test commands', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'npm run test' } },
			exitCode: 0,
		});
	});

	it('should detect test file names like test_foo.py', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'python test_fake_data.py' } },
			exitCode: 0,
		});
	});

	it('should detect test file names with full path', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, false);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: '/usr/bin/python3 /home/user/project/test_main.py' } },
			exitCode: 1,
		});
	});

	it('should detect foo_test.py style names', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'python foo_test.py' } },
			exitCode: 0,
		});
	});

	it('should detect foo.test.js style names', (done) => {
		const observer = new TerminalObserver();
		observer.onTestRunCompleted((result) => {
			assert.strictEqual(result.passed, true);
			observer.dispose();
			done();
		});

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'node foo.test.js' } },
			exitCode: 0,
		});
	});

	it('should not emit for non-test commands', () => {
		const observer = new TerminalObserver();
		let emitted = false;
		observer.onTestRunCompleted(() => { emitted = true; });

		onDidEndTerminalShellExecutionEmitter.fire({
			execution: { commandLine: { value: 'npm install' } },
			exitCode: 0,
		});

		assert.strictEqual(emitted, false);
		observer.dispose();
	});
});

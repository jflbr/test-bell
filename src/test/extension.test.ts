import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { resolveAudioCommand, resolveSoundPath } from '../soundPlayer';
import { ResultAnalyzer } from '../resultAnalyzer';

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

describe('ResultAnalyzer', () => {
	const analyzer = new ResultAnalyzer();

	it('should return false for empty array', () => {
		assert.strictEqual(analyzer.hasFailures([]), false);
	});

	it('should return false when all tests pass', () => {
		const snapshots = [
			{ taskStates: [{ state: 3 /* Passed */ }], children: [] },
			{ taskStates: [{ state: 3 /* Passed */ }], children: [] },
		];
		assert.strictEqual(analyzer.hasFailures(snapshots), false);
	});

	it('should return true when a test has failed', () => {
		const snapshots = [
			{ taskStates: [{ state: 3 /* Passed */ }], children: [] },
			{ taskStates: [{ state: 4 /* Failed */ }], children: [] },
		];
		assert.strictEqual(analyzer.hasFailures(snapshots), true);
	});

	it('should return true when a test has errored', () => {
		const snapshots = [
			{ taskStates: [{ state: 6 /* Errored */ }], children: [] },
		];
		assert.strictEqual(analyzer.hasFailures(snapshots), true);
	});

	it('should detect failure in nested children', () => {
		const snapshots = [
			{
				taskStates: [{ state: 3 /* Passed */ }],
				children: [
					{
						taskStates: [{ state: 4 /* Failed */ }],
						children: [],
					},
				],
			},
		];
		assert.strictEqual(analyzer.hasFailures(snapshots), true);
	});

	it('should detect failure in deeply nested children', () => {
		const snapshots = [
			{
				taskStates: [{ state: 3 }],
				children: [
					{
						taskStates: [{ state: 3 }],
						children: [
							{
								taskStates: [{ state: 6 /* Errored */ }],
								children: [],
							},
						],
					},
				],
			},
		];
		assert.strictEqual(analyzer.hasFailures(snapshots), true);
	});

	it('should return false for skipped tests', () => {
		const snapshots = [
			{ taskStates: [{ state: 5 /* Skipped */ }], children: [] },
		];
		assert.strictEqual(analyzer.hasFailures(snapshots), false);
	});
});

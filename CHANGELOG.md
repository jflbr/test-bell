# Changelog

## v0.3.0 — Stable API & Custom Multi-Source Test Detection

### Changes

- `testBell.playOnSuccess` now defaults to `true`
- Removed `enabledApiProposals` from `package.json` — the extension is now marketplace-publishable
- Added **TerminalObserver**: detects test runs in the integrated terminal by matching command patterns (`pytest`, `npm test`, `jest`, `go test`, `cargo test`, etc.) and test file naming conventions (`test_*.py`, `*.test.js`, `*.spec.ts`, etc.)
- Added **TaskObserver**: detects VS Code tasks with the `test` group or "test" in the task name
- **ProposedTestObserver** now gracefully degrades at runtime — no crash if the proposed API is unavailable
- Added debug logging via the **Test Bell** output channel
- Updated README with detection strategy docs and Testing UI opt-in instructions (`argv.json` / CLI flag)

## v0.2.0 — Custom Test Observer Wrapper Refactor

### Why

- The `testObserver` API is a VS Code proposal — extensions using it cannot be published to the marketplace. A custom test observer abstraction isolates this dependency, making it easier to swap in a stable API once one exists.

### Changes

- Split into `interfaces.ts`, `testObserver.ts`, `resultAnalyzer.ts`, `soundPlayer.ts`
- `extension.ts` reduced to composition root wiring observer → analyzer → player


## v0.1.0 — Initial Implementation

- Play a sound on test failure using `vscode.tests.onDidChangeTestResults` (proposed API)
- Optional pass sound via `testBell.playOnSuccess`
- Custom sound paths (absolute or workspace-relative) with format validation
- Cross-platform audio playback (macOS, Linux, Windows)
- Configurable volume on macOS

# Changelog

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

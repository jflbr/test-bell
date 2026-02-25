import { IResultAnalyzer, TestResultSnapshot } from './interfaces';

export class ResultAnalyzer implements IResultAnalyzer {
	hasFailures(snapshots: ReadonlyArray<TestResultSnapshot>): boolean {
		for (const snapshot of snapshots) {
			for (const taskState of snapshot.taskStates) {
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
}

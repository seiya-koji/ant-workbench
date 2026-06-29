import * as vscode from 'vscode';
import * as path from 'node:path';
import { getAntPath, runAnt } from './antProcess';

/** Run a single Ant target from the given build file. */
export async function runTarget(
  output: vscode.OutputChannel,
  buildFile: vscode.Uri,
  target: string
): Promise<void> {
  await runAnt(output, {
    antPath: getAntPath(),
    cwd: path.dirname(buildFile.fsPath),
    args: ['-f', path.basename(buildFile.fsPath), target],
  });
}

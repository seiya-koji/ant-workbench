import * as vscode from 'vscode';
import * as path from 'node:path';
import { getAntPath, runAnt } from './antProcess';

let currentController: AbortController | undefined;

export function isRunning(): boolean {
  return currentController !== undefined;
}

export function stopTarget(): void {
  currentController?.abort();
}

/** Run a single Ant target. Aborts any already-running target first. */
export async function runTarget(
  output: vscode.OutputChannel,
  buildFile: vscode.Uri,
  target: string
): Promise<void> {
  currentController?.abort();
  const controller = new AbortController();
  currentController = controller;
  try {
    await runAnt(output, {
      antPath: getAntPath(),
      cwd: path.dirname(buildFile.fsPath),
      args: ['-f', path.basename(buildFile.fsPath), target],
      signal: controller.signal,
    });
  } finally {
    if (currentController === controller) {
      currentController = undefined;
    }
  }
}

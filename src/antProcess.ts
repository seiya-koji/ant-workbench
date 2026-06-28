import * as vscode from 'vscode';
import { spawn } from 'child_process';

export interface RunAntOptions {
  antPath: string;
  args: string[];
  cwd: string;
}

/**
 * Run Ant and stream its output to the given channel. Resolves with the exit
 * code (-1 if the process could not be started).
 */
export function runAnt(output: vscode.OutputChannel, opts: RunAntOptions): Promise<number> {
  return new Promise((resolve) => {
    output.show(true);
    output.appendLine(`> ${opts.antPath} ${opts.args.join(' ')}  (cwd: ${opts.cwd})`);

    const child = spawn(opts.antPath, opts.args, { cwd: opts.cwd });
    child.stdout.on('data', (chunk) => output.append(chunk.toString()));
    child.stderr.on('data', (chunk) => output.append(chunk.toString()));
    child.on('error', (err) => {
      output.appendLine(`\n[failed to start ant: ${err.message}]`);
      resolve(-1);
    });
    child.on('close', (code) => {
      output.appendLine(`\n[ant exited with code ${code ?? -1}]`);
      resolve(code ?? -1);
    });
  });
}

export function getAntPath(): string {
  return vscode.workspace.getConfiguration('antWorkbench').get<string>('antPath', 'ant');
}

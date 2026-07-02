import * as vscode from 'vscode';
import { exec, spawn } from 'node:child_process';

export interface RunAntOptions {
  antPath: string;
  args: string[];
  cwd: string;
  signal?: AbortSignal;
}

/**
 * Run Ant and stream its output to the given channel. Resolves with the exit
 * code (-1 if the process could not be started).
 */
export function runAnt(output: vscode.OutputChannel, opts: RunAntOptions): Promise<number> {
  return new Promise((resolve) => {
    output.show(true);
    output.appendLine(`> ${opts.antPath} ${opts.args.join(' ')}  (cwd: ${opts.cwd})`);

    // On Windows, Ant ships as ant.bat/ant.cmd, which spawn() cannot launch directly
    // (Node.js only resolves .exe files on its own there). Route through cmd.exe /c
    // instead of `shell: true`: cmd.exe is a real .exe, so Node.js still applies its
    // normal Windows argument escaping to antPath/args, avoiding the injection risk of
    // shell:true (which concatenates arguments unescaped).
    const [command, spawnArgs] =
      process.platform === 'win32'
        ? ['cmd.exe', ['/d', '/s', '/c', opts.antPath, ...opts.args]]
        : [opts.antPath, opts.args];
    const child = spawn(command, spawnArgs, { cwd: opts.cwd });

    let aborted = false;
    opts.signal?.addEventListener(
      'abort',
      () => {
        aborted = true;
        if (process.platform === 'win32' && child.pid) {
          // cmd.exe doesn't forward termination to the Java process Ant actually
          // launches underneath it, so kill() would leave that process running.
          // taskkill /t walks the whole process tree instead.
          exec(`taskkill /pid ${child.pid} /t /f`);
        } else {
          child.kill();
        }
      },
      { once: true }
    );

    child.stdout.on('data', (chunk) => output.append(chunk.toString()));
    child.stderr.on('data', (chunk) => output.append(chunk.toString()));
    child.on('error', (err) => {
      output.appendLine(`\n[failed to start ant: ${err.message}]`);
      resolve(-1);
    });
    child.on('close', (code) => {
      if (aborted) {
        output.appendLine('\n[ant stopped]');
      } else {
        output.appendLine(`\n[ant exited with code ${code ?? -1}]`);
      }
      resolve(aborted ? -1 : (code ?? -1));
    });
  });
}

export function getAntPath(): string {
  return vscode.workspace.getConfiguration('antWorkbench').get<string>('antPath', 'ant');
}

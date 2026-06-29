import * as path from 'node:path';
import * as vscode from 'vscode';
import { isAntBuildFile, parsePathIds } from './ant';
import { AntBuildProvider, BuildFileItem, TargetItem } from './antBuildProvider';
import { generateClasspath } from './classpathGenerator';
import { runTarget } from './antRunner';

const AUTO_GENERATE_DEBOUNCE_MS = 500;
const ACTIVE_BUILD_FILE_KEY = 'antWorkbench.activeBuildFile';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Ant Workbench');
  const provider = new AntBuildProvider();
  provider.setActiveBuildFile(context.workspaceState.get<string>(ACTIVE_BUILD_FILE_KEY));

  context.subscriptions.push(
    output,
    provider,
    vscode.window.registerTreeDataProvider('antWorkbench.builds', provider),
    vscode.commands.registerCommand('antWorkbench.refresh', () => provider.refresh()),
    vscode.commands.registerCommand(
      'antWorkbench.setActiveBuildFile',
      async (node?: BuildFileItem) => {
        const uri = node?.uri ?? (await pickBuildFile(provider));
        if (!uri) {
          return;
        }
        provider.setActiveBuildFile(uri.fsPath);
        await context.workspaceState.update(ACTIVE_BUILD_FILE_KEY, uri.fsPath);
        provider.refresh();
        vscode.window.showInformationMessage(
          `Ant Workbench: active build file set to ${vscode.workspace.asRelativePath(uri)}`
        );
      }
    ),
    vscode.commands.registerCommand(
      'antWorkbench.generateClasspath',
      async (node?: BuildFileItem) => {
        const uri = node?.uri ?? provider.getActiveBuildFile() ?? (await pickBuildFile(provider));
        if (uri) {
          await generateClasspath(context, output, uri);
        }
      }
    ),
    vscode.commands.registerCommand('antWorkbench.runTarget', async (node?: TargetItem) => {
      if (node) {
        await runTarget(output, node.buildFile, node.target);
      }
    }),
    vscode.commands.registerCommand(
      'antWorkbench.addClasspathTarget',
      async (node?: BuildFileItem) => {
        const uri = node?.uri ?? provider.getActiveBuildFile() ?? (await pickBuildFile(provider));
        if (!uri) {
          return;
        }

        const bytes = await vscode.workspace.fs.readFile(uri);
        const xml = Buffer.from(bytes).toString('utf8');
        const allPathIds = parsePathIds(xml);
        const primaryPathId = vscode.workspace
          .getConfiguration('antWorkbench')
          .get<string>('classpathPathId', 'classpath');
        const candidates = allPathIds.filter((id) => id !== primaryPathId);

        if (candidates.length === 0) {
          vscode.window.showInformationMessage(
            'Ant Workbench: no additional <path> elements found in this build file.'
          );
          return;
        }

        const pathId = await vscode.window.showQuickPick(candidates, {
          placeHolder: 'Select the Ant <path> id for the additional classpath',
        });
        if (!pathId) {
          return;
        }

        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        if (!wsFolder) {
          vscode.window.showWarningMessage('Ant Workbench: no workspace folder open.');
          return;
        }

        const BROWSE_ITEM = '$(folder-opened) Browse for folder...';
        const entries = await vscode.workspace.fs.readDirectory(wsFolder.uri);
        const subdirs = entries
          .filter(([, type]) => type === vscode.FileType.Directory)
          .map(([name]) => name)
          .filter((name) => !name.startsWith('.'))
          .sort((a, b) => a.localeCompare(b));

        const picked = await vscode.window.showQuickPick([...subdirs, BROWSE_ITEM], {
          placeHolder: 'Select output directory for .classpath',
        });
        if (!picked) {
          return;
        }

        let outputDir: string;
        if (picked === BROWSE_ITEM) {
          const dirs = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select output directory for .classpath',
          });
          if (!dirs || dirs.length === 0) {
            return;
          }
          outputDir = path.relative(wsFolder.uri.fsPath, dirs[0].fsPath).replaceAll('\\', '/');
        } else {
          outputDir = picked;
        }

        const config = vscode.workspace.getConfiguration('antWorkbench');
        const existing = config.get<Array<{ pathId: string; outputDir: string }>>(
          'additionalClasspaths',
          []
        );
        if (existing.some((e) => e.pathId === pathId && e.outputDir === outputDir)) {
          vscode.window.showInformationMessage(
            `Ant Workbench: pathId="${pathId}" → "${outputDir}" is already configured.`
          );
          return;
        }
        await config.update(
          'additionalClasspaths',
          [...existing, { pathId, outputDir }],
          vscode.ConfigurationTarget.Workspace
        );
        vscode.window.showInformationMessage(
          `Ant Workbench: added classpath target - pathId="${pathId}", outputDir="${outputDir}".`
        );
      }
    ),
    vscode.commands.registerCommand('antWorkbench.toggleAutoGenerate', async () => {
      const config = vscode.workspace.getConfiguration('antWorkbench');
      const next = !config.get<boolean>('autoGenerate', false);
      await config.update('autoGenerate', next, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(
        `Ant Workbench: auto-generate ${next ? 'enabled' : 'disabled'}.`
      );
    })
  );

  registerAutoGenerate(context, output, provider);
  provider.refresh();
}

export function deactivate(): void {
  // No cleanup required.
}

function registerAutoGenerate(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  provider: AntBuildProvider
): void {
  const watcher = vscode.workspace.createFileSystemWatcher('**/build*.xml');
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const schedule = (uri: vscode.Uri) => {
    const enabled = vscode.workspace
      .getConfiguration('antWorkbench')
      .get<boolean>('autoGenerate', false);
    // Only the active build file is regenerated automatically.
    if (!enabled || uri.fsPath !== provider.getActiveBuildFile()?.fsPath) {
      return;
    }
    const key = uri.fsPath;
    clearTimeout(pending.get(key));
    pending.set(
      key,
      setTimeout(async () => {
        pending.delete(key);
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          if (isAntBuildFile(Buffer.from(bytes).toString('utf8'))) {
            await generateClasspath(context, output, uri);
          }
        } catch {
          // File may have been removed between the event and the timeout.
        }
      }, AUTO_GENERATE_DEBOUNCE_MS)
    );
  };

  watcher.onDidChange(schedule);
  watcher.onDidCreate((uri) => {
    provider.refresh();
    schedule(uri);
  });
  watcher.onDidDelete(() => provider.refresh());
  context.subscriptions.push(watcher);
}

async function pickBuildFile(provider: AntBuildProvider): Promise<vscode.Uri | undefined> {
  const uris = await provider.getBuildFileUris();
  if (uris.length === 0) {
    vscode.window.showInformationMessage(
      'Ant Workbench: no Ant build files found in the workspace.'
    );
    return undefined;
  }
  if (uris.length === 1) {
    return uris[0];
  }
  const picked = await vscode.window.showQuickPick(
    uris.map((uri) => ({ label: vscode.workspace.asRelativePath(uri), uri })),
    { placeHolder: 'Select an Ant build file' }
  );
  return picked?.uri;
}

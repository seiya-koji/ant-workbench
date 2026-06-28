import * as vscode from 'vscode';
import { isAntBuildFile } from './ant';
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
    vscode.window.registerTreeDataProvider('antWorkbench.builds', provider)
  );

  context.subscriptions.push(
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

export function deactivate(): void {}

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

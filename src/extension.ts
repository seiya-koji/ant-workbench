import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  AdditionalClasspath,
  buildAdditionalClasspathEntry,
  formatAddClasspathMessage,
  isAdditionalClasspathConfigured,
} from './additionalClasspath';
import { isAntBuildFile, parsePathIds } from './ant';
import { AntBuildProvider, BuildFileItem, TargetItem } from './antBuildProvider';
import { generateClasspath } from './classpathGenerator';
import { isRunning, runTarget, stopTarget } from './antRunner';

const AUTO_GENERATE_DEBOUNCE_MS = 500;
const ACTIVE_BUILD_FILE_KEY = 'antWorkbench.activeBuildFile';
const BROWSE_ITEM = '$(folder-opened) Browse for folder...';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Ant Workbench');
  const provider = new AntBuildProvider();
  provider.setActiveBuildFile(context.workspaceState.get<string>(ACTIVE_BUILD_FILE_KEY));

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBar.text = '$(stop-circle) Stop Ant';
  statusBar.command = 'antWorkbench.stopTarget';
  statusBar.tooltip = 'Stop the running Ant target';
  statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');

  context.subscriptions.push(
    output,
    statusBar,
    provider,
    vscode.window.registerTreeDataProvider('antWorkbench.builds', provider),
    vscode.commands.registerCommand('antWorkbench.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('antWorkbench.stopTarget', () => {
      if (isRunning()) {
        stopTarget();
      }
    }),
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
        statusBar.show();
        try {
          await runTarget(output, node.buildFile, node.target);
        } finally {
          statusBar.hide();
        }
      }
    }),
    vscode.commands.registerCommand(
      'antWorkbench.addClasspathTarget',
      async (node?: BuildFileItem) => {
        const uri = node?.uri ?? provider.getActiveBuildFile() ?? (await pickBuildFile(provider));
        if (!uri) {
          return;
        }

        const pathId = await pickAdditionalPathId(uri);
        if (!pathId) {
          return;
        }

        const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!wsFolder) {
          vscode.window.showWarningMessage('Ant Workbench: no workspace folder open.');
          return;
        }

        const subdirs = await listWorkspaceSubdirs(wsFolder);
        const outputDir = await pickOutputDir(wsFolder, subdirs);
        if (!outputDir) {
          return;
        }

        const projectDeps = await pickProjectDeps(subdirs, outputDir);
        await saveAdditionalClasspath(pathId, outputDir, projectDeps);
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

async function pickAdditionalPathId(uri: vscode.Uri): Promise<string | undefined> {
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
    return undefined;
  }
  return vscode.window.showQuickPick(candidates, {
    placeHolder: 'Select the Ant <path> id for the additional classpath',
  });
}

async function listWorkspaceSubdirs(wsFolder: vscode.WorkspaceFolder): Promise<string[]> {
  const entries = await vscode.workspace.fs.readDirectory(wsFolder.uri);
  return entries
    .filter(([, type]) => type === vscode.FileType.Directory)
    .map(([name]) => name)
    .filter((name) => !name.startsWith('.'))
    .sort((a, b) => a.localeCompare(b));
}

async function pickOutputDir(
  wsFolder: vscode.WorkspaceFolder,
  subdirs: string[]
): Promise<string | undefined> {
  const picked = await vscode.window.showQuickPick([...subdirs, BROWSE_ITEM], {
    placeHolder: 'Select output directory for .classpath',
  });
  if (!picked) {
    return undefined;
  }
  if (picked !== BROWSE_ITEM) {
    return picked;
  }

  const dirs = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select output directory for .classpath',
  });
  if (!dirs || dirs.length === 0) {
    return undefined;
  }
  return path.relative(wsFolder.uri.fsPath, dirs[0].fsPath).replaceAll('\\', '/');
}

async function pickProjectDeps(
  subdirs: string[],
  outputDir: string
): Promise<string[] | undefined> {
  const candidates = subdirs.filter((name) => name !== outputDir);
  if (candidates.length === 0) {
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(candidates, {
    placeHolder: 'Select project(s) to add as source references (Esc to skip)',
    canPickMany: true,
  });
  return picked && picked.length > 0 ? picked : undefined;
}

async function saveAdditionalClasspath(
  pathId: string,
  outputDir: string,
  projectDeps: string[] | undefined
): Promise<void> {
  const config = vscode.workspace.getConfiguration('antWorkbench');
  const existing = config.get<AdditionalClasspath[]>('additionalClasspaths', []);
  if (isAdditionalClasspathConfigured(existing, pathId, outputDir)) {
    vscode.window.showInformationMessage(
      `Ant Workbench: pathId="${pathId}" → "${outputDir}" is already configured.`
    );
    return;
  }
  const entry = buildAdditionalClasspathEntry(pathId, outputDir, projectDeps);
  await config.update(
    'additionalClasspaths',
    [...existing, entry],
    vscode.ConfigurationTarget.Workspace
  );
  vscode.window.showInformationMessage(formatAddClasspathMessage(pathId, outputDir, projectDeps));
}

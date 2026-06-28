import * as vscode from 'vscode';
import { isAntBuildFile, parseTargets } from './ant';

export class BuildFileItem extends vscode.TreeItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly isActive: boolean
  ) {
    super(vscode.workspace.asRelativePath(uri), vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'antBuildFile';
    this.resourceUri = uri;
    this.iconPath = new vscode.ThemeIcon(isActive ? 'pass-filled' : 'file-code');
    this.description = isActive ? 'active' : undefined;
    this.tooltip = isActive ? `${uri.fsPath} (active)` : uri.fsPath;
  }
}

export class TargetItem extends vscode.TreeItem {
  constructor(
    public readonly buildFile: vscode.Uri,
    public readonly target: string,
    description?: string
  ) {
    super(target, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'antTarget';
    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon('symbol-method');
  }
}

export type AntNode = BuildFileItem | TargetItem;

export class AntBuildProvider implements vscode.TreeDataProvider<AntNode>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<AntNode | undefined | void>();
  readonly onDidChangeTreeData = this.changed.event;

  private activeBuildFile: string | undefined;

  setActiveBuildFile(fsPath: string | undefined): void {
    this.activeBuildFile = fsPath;
  }

  getActiveBuildFile(): vscode.Uri | undefined {
    return this.activeBuildFile ? vscode.Uri.file(this.activeBuildFile) : undefined;
  }

  refresh(): void {
    this.changed.fire();
  }

  dispose(): void {
    this.changed.dispose();
  }

  getTreeItem(element: AntNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AntNode): Promise<AntNode[]> {
    if (!element) {
      return this.findBuildFiles();
    }
    if (element instanceof BuildFileItem) {
      return this.findTargets(element.uri);
    }
    return [];
  }

  async getBuildFileUris(): Promise<vscode.Uri[]> {
    const config = vscode.workspace.getConfiguration('antWorkbench');
    const glob = config.get<string>('buildFileGlob', '**/build*.xml');
    const exclude = config.get<string[]>('exclude', []);
    const excludePattern = exclude.length ? `{${exclude.join(',')}}` : undefined;

    const candidates = await vscode.workspace.findFiles(glob, excludePattern);
    const builds: vscode.Uri[] = [];
    for (const uri of candidates) {
      if (await this.isAntBuild(uri)) {
        builds.push(uri);
      }
    }
    builds.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return builds;
  }

  private async findBuildFiles(): Promise<BuildFileItem[]> {
    const uris = await this.getBuildFileUris();
    return uris.map((uri) => new BuildFileItem(uri, uri.fsPath === this.activeBuildFile));
  }

  private async findTargets(uri: vscode.Uri): Promise<TargetItem[]> {
    const xml = await this.readText(uri);
    return parseTargets(xml).map((t) => new TargetItem(uri, t.name, t.description));
  }

  private async isAntBuild(uri: vscode.Uri): Promise<boolean> {
    try {
      return isAntBuildFile(await this.readText(uri));
    } catch {
      return false;
    }
  }

  private async readText(uri: vscode.Uri): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf8');
  }
}

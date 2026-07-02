import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { getAntPath, runAnt } from './antProcess';

const GENERATOR_TEMPLATE = path.join('resources', 'gen-classpath.xml');
const TEMP_GENERATOR_NAME = '.awb-gen-classpath.xml';

/**
 * Generate an Eclipse .classpath for the given Ant build file by importing it
 * from a generator script placed in the build file's directory (so the build's
 * basedir-relative properties resolve), then reload the Java project config.
 */
export async function generateClasspath(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  buildFile: vscode.Uri
): Promise<void> {
  const config = vscode.workspace.getConfiguration('antWorkbench');
  const pathId = config.get<string>('classpathPathId', 'classpath');

  const buildDir = path.dirname(buildFile.fsPath);
  const tempGenerator = path.join(buildDir, TEMP_GENERATOR_NAME);
  const template = await fs.readFile(context.asAbsolutePath(GENERATOR_TEMPLATE), 'utf8');
  await fs.writeFile(tempGenerator, template, 'utf8');

  try {
    const code = await runAnt(output, {
      antPath: getAntPath(),
      cwd: buildDir,
      args: [
        '-f',
        TEMP_GENERATOR_NAME,
        `-Dawb.target.buildfile=${buildFile.fsPath}`,
        `-Dawb.path.id=${pathId}`,
        'awb.gen-classpath',
      ],
    });

    if (code !== 0) {
      vscode.window.showErrorMessage(
        `Ant Workbench: failed to generate .classpath (ant exit ${code}). See the Ant Workbench output.`
      );
      return;
    }

    const projectDir = path.dirname(buildDir);
    const classpathUri = vscode.Uri.file(path.join(projectDir, '.classpath'));
    const projectCreated = await ensureProjectFile(projectDir);
    await reloadJavaProject(classpathUri);
    vscode.window.showInformationMessage(
      `Ant Workbench: generated ${vscode.workspace.asRelativePath(classpathUri)}${projectCreated ? ' (and .project)' : ''}`
    );

    const additionals = config.get<
      Array<{ pathId: string; outputDir: string; projectDeps?: string[] }>
    >('additionalClasspaths', []);
    const wsRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '';

    for (const item of additionals) {
      const absOutputDir = path.isAbsolute(item.outputDir)
        ? item.outputDir
        : path.join(wsRoot, item.outputDir);

      try {
        await fs.stat(absOutputDir);
      } catch {
        vscode.window.showWarningMessage(
          `Ant Workbench: output dir not found for pathId "${item.pathId}" – skipping.`
        );
        continue;
      }

      await generateAdditionalClasspath(output, buildDir, buildFile, item, absOutputDir);
    }
  } finally {
    await fs.rm(tempGenerator, { force: true });
  }
}

async function generateAdditionalClasspath(
  output: vscode.OutputChannel,
  buildDir: string,
  buildFile: vscode.Uri,
  item: { pathId: string; outputDir: string; projectDeps?: string[] },
  absOutputDir: string
): Promise<void> {
  const extraClasspath = path.join(absOutputDir, '.classpath');
  const extraCode = await runAnt(output, {
    antPath: getAntPath(),
    cwd: buildDir,
    args: [
      '-f',
      TEMP_GENERATOR_NAME,
      `-Dawb.target.buildfile=${buildFile.fsPath}`,
      `-Dawb.path.id=${item.pathId}`,
      `-Dawb.output=${extraClasspath}`,
      'awb.gen-classpath',
    ],
  });

  if (extraCode !== 0) {
    vscode.window.showErrorMessage(
      `Ant Workbench: failed to generate .classpath for pathId "${item.pathId}".`
    );
    return;
  }

  if (item.projectDeps && item.projectDeps.length > 0) {
    let content = await fs.readFile(extraClasspath, 'utf8');
    const entries = item.projectDeps
      .map((p) => `\t<classpathentry kind="src" path="/${p}"/>`)
      .join('\n');
    const idx = content.lastIndexOf('</classpath>');
    if (idx !== -1) {
      content = content.slice(0, idx) + entries + '\n</classpath>';
      await fs.writeFile(extraClasspath, content, 'utf8');
    }
  }

  let projectCreated: boolean;
  try {
    projectCreated = await ensureProjectFile(absOutputDir);
  } catch {
    vscode.window.showErrorMessage(
      `Ant Workbench: failed to write .project for pathId "${item.pathId}" – skipping.`
    );
    return;
  }
  await reloadJavaProject(vscode.Uri.file(extraClasspath));
  vscode.window.showInformationMessage(
    `Ant Workbench: generated ${vscode.workspace.asRelativePath(extraClasspath)}${projectCreated ? ' (and .project)' : ''}`
  );
}

/**
 * Ensure an Eclipse `.project` exists alongside the `.classpath`. The Java
 * language server only treats a folder as an Eclipse project when a `.project`
 * is present; a `.classpath` on its own is ignored. An existing `.project` is
 * left untouched so any language-server-managed content (e.g. filteredResources)
 * is preserved.
 */
export async function ensureProjectFile(projectDir: string): Promise<boolean> {
  const projectFile = path.join(projectDir, '.project');
  try {
    await fs.stat(projectFile);
    return false;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    // ENOENT — file absent, fall through to create.
  }

  const name = escapeXml(path.basename(projectDir));
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<projectDescription>
\t<name>${name}</name>
\t<comment></comment>
\t<projects>
\t</projects>
\t<buildSpec>
\t\t<buildCommand>
\t\t\t<name>org.eclipse.jdt.core.javabuilder</name>
\t\t\t<arguments>
\t\t\t</arguments>
\t\t</buildCommand>
\t</buildSpec>
\t<natures>
\t\t<nature>org.eclipse.jdt.core.javanature</nature>
\t</natures>
</projectDescription>
`;
  await fs.writeFile(projectFile, content, 'utf8');
  return true;
}

export function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function reloadJavaProject(classpathUri: vscode.Uri): Promise<void> {
  try {
    await vscode.commands.executeCommand('java.projectConfiguration.update', classpathUri);
  } catch {
    // The Java extension may not be installed/active; the .classpath is still written.
  }
}

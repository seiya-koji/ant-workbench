import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
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
    await reloadJavaProject(classpathUri);
    vscode.window.showInformationMessage(
      `Ant Workbench: generated ${vscode.workspace.asRelativePath(classpathUri)}`
    );
  } finally {
    await fs.rm(tempGenerator, { force: true });
  }
}

async function reloadJavaProject(classpathUri: vscode.Uri): Promise<void> {
  try {
    await vscode.commands.executeCommand('java.projectConfiguration.update', classpathUri);
  } catch {
    // The Java extension may not be installed/active; the .classpath is still written.
  }
}

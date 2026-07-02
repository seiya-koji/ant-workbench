/**
 * Pure helpers for the addClasspathTarget flow. No vscode dependency so they can be
 * unit-tested directly.
 */

export interface AdditionalClasspath {
  pathId: string;
  outputDir: string;
  projectDeps?: string[];
}

export function isAdditionalClasspathConfigured(
  existing: AdditionalClasspath[],
  pathId: string,
  outputDir: string
): boolean {
  return existing.some((e) => e.pathId === pathId && e.outputDir === outputDir);
}

export function buildAdditionalClasspathEntry(
  pathId: string,
  outputDir: string,
  projectDeps: string[] | undefined
): AdditionalClasspath {
  const entry: AdditionalClasspath = { pathId, outputDir };
  if (projectDeps) {
    entry.projectDeps = projectDeps;
  }
  return entry;
}

export function formatAddClasspathMessage(
  pathId: string,
  outputDir: string,
  projectDeps: string[] | undefined
): string {
  return (
    `Ant Workbench: added classpath target - pathId="${pathId}", outputDir="${outputDir}"` +
    (projectDeps ? `, projectDeps=[${projectDeps.join(', ')}]` : '') +
    '.'
  );
}

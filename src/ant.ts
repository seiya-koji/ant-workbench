/**
 * Pure parsing helpers for Ant build files. No vscode dependency so they can be
 * unit-tested directly.
 */

export interface AntTarget {
  name: string;
  description?: string;
}

function stripComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

/** True when the document's root-level markup contains an Ant <project> element. */
export function isAntBuildFile(xml: string): boolean {
  return /<project[\s>]/.test(stripComments(xml));
}

/** Extract unique <target> entries (first occurrence wins) with optional descriptions. */
export function parseTargets(xml: string): AntTarget[] {
  const content = stripComments(xml);
  const targets: AntTarget[] = [];
  const seen = new Set<string>();
  const tagRe = /<target\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(content)) !== null) {
    const attrs = match[1];
    const name = /\bname\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const description = /\bdescription\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    targets.push({ name, description });
  }
  return targets;
}

/**
 * Pure parsing helpers for Ant build files. No vscode dependency so they can be
 * unit-tested directly.
 */

export interface AntTarget {
  name: string;
  description?: string;
}

function stripComments(xml: string): string {
  return xml.replaceAll(/<!--[\s\S]*?-->/g, '');
}

/** True when the document's root-level markup contains an Ant <project> element. */
export function isAntBuildFile(xml: string): boolean {
  return /<project[\s>]/.test(stripComments(xml));
}

/** Extract unique <path id="..."> ids in document order. */
export function parsePathIds(xml: string): string[] {
  const content = stripComments(xml);
  const ids = [...content.matchAll(/<path\b[^>]*\bid\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

/** Return the `default` attribute of the root `<project>` element, if present. */
export function parseDefaultTarget(xml: string): string | undefined {
  const content = stripComments(xml);
  return /<project\b[^>]*\bdefault\s*=\s*"([^"]*)"/.exec(content)?.[1];
}

/** Extract unique <target> entries (first occurrence wins) with optional descriptions. */
export function parseTargets(xml: string): AntTarget[] {
  const content = stripComments(xml);
  const seen = new Set<string>();
  return [...content.matchAll(/<target\b([^>]*)>/g)].flatMap((m) => {
    const attrs = m[1];
    const name = /\bname\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    if (!name || seen.has(name)) {
      return [];
    }
    seen.add(name);
    const description = /\bdescription\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    return [{ name, description }];
  });
}

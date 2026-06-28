import { describe, it, expect } from 'vitest';
import { isAntBuildFile, parseTargets } from '../src/ant';

describe('isAntBuildFile', () => {
  it('detects an Ant project root', () => {
    expect(isAntBuildFile('<?xml version="1.0"?>\n<project name="x" default="a"></project>')).toBe(
      true
    );
  });

  it('rejects non-Ant xml', () => {
    expect(isAntBuildFile('<classpath><classpathentry kind="src"/></classpath>')).toBe(false);
  });

  it('ignores <project> mentioned only inside comments', () => {
    expect(isAntBuildFile('<!-- <project> in a comment -->\n<beans/>')).toBe(false);
  });
});

describe('parseTargets', () => {
  it('extracts target names and descriptions', () => {
    const xml = `
      <project name="x" default="create_jar">
        <target name="compile" depends="init">...</target>
        <target name="create_jar" description="Build the jar">...</target>
      </project>`;
    expect(parseTargets(xml)).toEqual([
      { name: 'compile', description: undefined },
      { name: 'create_jar', description: 'Build the jar' },
    ]);
  });

  it('deduplicates by name keeping the first occurrence', () => {
    const xml = `
      <project>
        <target name="a" description="first">...</target>
        <target name="a" description="second">...</target>
      </project>`;
    expect(parseTargets(xml)).toEqual([{ name: 'a', description: 'first' }]);
  });

  it('skips targets defined only inside comments', () => {
    const xml = `<project><!-- <target name="ghost"/> --><target name="real">x</target></project>`;
    expect(parseTargets(xml)).toEqual([{ name: 'real', description: undefined }]);
  });
});

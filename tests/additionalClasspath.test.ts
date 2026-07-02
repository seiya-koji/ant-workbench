import { describe, it, expect } from 'vitest';
import {
  isAdditionalClasspathConfigured,
  buildAdditionalClasspathEntry,
  formatAddClasspathMessage,
  type AdditionalClasspath,
} from '../src/additionalClasspath';

describe('isAdditionalClasspathConfigured', () => {
  const existing: AdditionalClasspath[] = [{ pathId: 'test-classpath', outputDir: 'MyApp-test' }];

  it('returns true when both pathId and outputDir match an existing entry', () =>
    expect(isAdditionalClasspathConfigured(existing, 'test-classpath', 'MyApp-test')).toBe(true));

  it('returns false when only pathId matches', () =>
    expect(isAdditionalClasspathConfigured(existing, 'test-classpath', 'Other')).toBe(false));

  it('returns false when only outputDir matches', () =>
    expect(isAdditionalClasspathConfigured(existing, 'other-classpath', 'MyApp-test')).toBe(false));

  it('returns false for an empty list', () =>
    expect(isAdditionalClasspathConfigured([], 'test-classpath', 'MyApp-test')).toBe(false));
});

describe('buildAdditionalClasspathEntry', () => {
  it('omits projectDeps when undefined', () =>
    expect(buildAdditionalClasspathEntry('test-classpath', 'MyApp-test', undefined)).toEqual({
      pathId: 'test-classpath',
      outputDir: 'MyApp-test',
    }));

  it('includes projectDeps when provided', () =>
    expect(buildAdditionalClasspathEntry('test-classpath', 'MyApp-test', ['MyApp'])).toEqual({
      pathId: 'test-classpath',
      outputDir: 'MyApp-test',
      projectDeps: ['MyApp'],
    }));
});

describe('formatAddClasspathMessage', () => {
  it('omits the projectDeps clause when undefined', () =>
    expect(formatAddClasspathMessage('test-classpath', 'MyApp-test', undefined)).toBe(
      'Ant Workbench: added classpath target - pathId="test-classpath", outputDir="MyApp-test".'
    ));

  it('includes the projectDeps clause when provided', () =>
    expect(formatAddClasspathMessage('test-classpath', 'MyApp-test', ['MyApp'])).toBe(
      'Ant Workbench: added classpath target - pathId="test-classpath", outputDir="MyApp-test", projectDeps=[MyApp].'
    ));

  it('joins multiple projectDeps with commas', () =>
    expect(formatAddClasspathMessage('test-classpath', 'MyApp-test', ['MyApp', 'MyLib'])).toBe(
      'Ant Workbench: added classpath target - pathId="test-classpath", outputDir="MyApp-test", projectDeps=[MyApp, MyLib].'
    ));
});

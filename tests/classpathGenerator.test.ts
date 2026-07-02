import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { escapeXml, ensureProjectFile } from '../src/classpathGenerator';

vi.mock('node:fs/promises');

describe('escapeXml', () => {
  it('escapes &', () => expect(escapeXml('a&b')).toBe('a&amp;b'));
  it('escapes <', () => expect(escapeXml('<tag>')).toBe('&lt;tag&gt;'));
  it('escapes >', () => expect(escapeXml('a>b')).toBe('a&gt;b'));
  it('escapes multiple occurrences in one string', () =>
    expect(escapeXml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d'));
  it('leaves strings without special characters unchanged', () =>
    expect(escapeXml('hello')).toBe('hello'));
});

describe('ensureProjectFile', () => {
  beforeEach(() => {
    vi.mocked(fs.stat).mockReset();
    vi.mocked(fs.writeFile).mockReset();
  });

  it('returns false without writing when .project already exists', async () => {
    vi.mocked(fs.stat).mockResolvedValue({} as Awaited<ReturnType<typeof fs.stat>>);

    await expect(ensureProjectFile('/some/project')).resolves.toBe(false);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('creates .project and returns true when absent (ENOENT)', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await expect(ensureProjectFile('/some/project')).resolves.toBe(true);
    expect(fs.writeFile).toHaveBeenCalledOnce();
    const [filePath] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(filePath).toBe('/some/project/.project');
  });

  it('uses the directory basename as the Eclipse project name', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await ensureProjectFile('/workspace/my-app');
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(content).toContain('<name>my-app</name>');
  });

  it('XML-escapes special characters in the project name', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await ensureProjectFile('/workspace/a&b');
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(content).toContain('<name>a&amp;b</name>');
  });

  it('includes javanature in the generated .project', async () => {
    vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await ensureProjectFile('/some/project');
    const content = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(content).toContain('org.eclipse.jdt.core.javanature');
    expect(content).toContain('org.eclipse.jdt.core.javabuilder');
  });

  it('re-throws non-ENOENT errors without writing', async () => {
    vi.mocked(fs.stat).mockRejectedValue(
      Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    );

    await expect(ensureProjectFile('/some/project')).rejects.toThrow('EACCES');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});

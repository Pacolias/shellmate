import { describe, expect, it } from 'vitest';
import { lookupError } from '../../src/main/command-analysis/error-catalog';

describe('lookupError', () => {
  it('matches a permission denied error', () => {
    const result = lookupError('bash: /etc/shadow: Permission denied', 'cat');
    expect(result?.id).toBe('permission-denied');
  });

  it('matches command not found', () => {
    const result = lookupError('bash: foo: command not found', 'foo');
    expect(result?.id).toBe('command-not-found');
  });

  it('matches no such file or directory', () => {
    const result = lookupError('ls: cannot access \'x\': No such file or directory', 'ls');
    expect(result?.id).toBe('no-such-file-or-directory');
  });

  it('returns null instead of inventing an explanation when nothing matches', () => {
    const result = lookupError('some completely unrecognized error output', 'mytool');
    expect(result).toBeNull();
  });

  it('scopes command-specific entries to the right command', () => {
    const gitMatch = lookupError('fatal: not a git repository (or any of the parent directories)', 'git');
    expect(gitMatch?.id).toBe('not-a-git-repository');

    const unscoped = lookupError('fatal: not a git repository (or any of the parent directories)', 'somethingelse');
    expect(unscoped).toBeNull();

    const noCommand = lookupError('fatal: not a git repository (or any of the parent directories)', null);
    expect(noCommand).toBeNull();
  });

  it('is case-sensitive-safe for entries with mixed-case patterns', () => {
    const result = lookupError('rm: cannot remove \'x\': Is a directory', 'rm');
    expect(result?.id).toBe('is-a-directory');
  });
});

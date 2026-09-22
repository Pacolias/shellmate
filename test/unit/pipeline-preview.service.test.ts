import { realpathSync } from 'node:fs';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { previewPipeline } from '../../src/main/pipeline/pipeline-preview.service';

describe('previewPipeline', () => {
  it('refuses a single command (not actually a pipeline)', async () => {
    const result = await previewPipeline('ls -la', null);
    expect(result).toEqual({ status: 'not-eligible', reason: expect.any(String) });
  });

  it('refuses a pipeline where any stage is not read-only', async () => {
    const result = await previewPipeline('ls | xargs rm -rf', null);
    expect(result.status).toBe('not-eligible');
  });

  it('refuses malformed syntax without throwing', async () => {
    const result = await previewPipeline('echo "unterminated | grep x', null);
    expect(result.status).toBe('not-eligible');
  });

  it('actually runs a safe pipeline and captures real intermediate output per stage', async () => {
    // Both commands must be in the dictionary as baseDanger 'safe' — an
    // unrecognized command defaults to 'caution' (see danger-classifier),
    // which correctly makes the whole pipeline ineligible for preview.
    const result = await previewPipeline('echo hello world | grep hello', null);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.stages).toHaveLength(2);
    expect(result.stages[0]?.output).toBe('hello world\n');
    expect(result.stages[1]?.output).toBe('hello world\n');
    expect(result.stages.every((stage) => stage.exitCode === 0)).toBe(true);
  }, 10000);

  it('runs each stage in the given cwd', async () => {
    const tmp = realpathSync(os.tmpdir()); // bash resolves symlinks in `pwd`'s output
    const result = await previewPipeline('pwd | cat', tmp);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.stages[0]?.output.trim()).toBe(tmp);
  }, 10000);
});

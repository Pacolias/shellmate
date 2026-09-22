import { existsSync, globSync } from 'node:fs';
import path from 'node:path';
import type { DestructivePreview, PreviewTarget } from '@shared/types/safety';
import { parseCommand } from '../command-analysis/bash-parser';
import { resolveEffectiveInvocation } from '../command-analysis/danger-classifier';

const GLOB_CHARS = /[*?[]/;

/**
 * Resolves what an `rm`/`mv` command's arguments would actually touch on
 * disk — globs expanded, literal paths checked for existence — without
 * running anything. Returns null when the (last, in a chain/pipeline)
 * segment isn't an rm/mv invocation at all.
 */
export async function previewDestructiveCommand(raw: string, cwd: string | null): Promise<DestructivePreview | null> {
  const parsed = await parseCommand(raw);
  const baseDir = cwd ?? process.cwd();

  for (const segment of parsed.segments) {
    const { command, args } = resolveEffectiveInvocation(segment);
    if (command !== 'rm' && command !== 'mv') continue;

    const positionalArgs = args.filter((token) => token.kind === 'argument').map((token) => token.text);

    if (command === 'rm') {
      return { action: 'delete', destination: null, targets: positionalArgs.map((arg) => resolveTarget(arg, baseDir)) };
    }

    // mv: every argument but the last is a source; the last is the
    // destination, which we don't glob-resolve or check for existence —
    // it's where things are going, not something being read.
    const destination = positionalArgs.at(-1) ?? null;
    const sources = positionalArgs.slice(0, -1);
    return {
      action: 'move',
      destination: destination ? path.resolve(baseDir, destination) : null,
      targets: sources.map((arg) => resolveTarget(arg, baseDir)),
    };
  }

  return null;
}

function resolveTarget(pattern: string, baseDir: string): PreviewTarget {
  if (!GLOB_CHARS.test(pattern)) {
    const absolute = path.resolve(baseDir, pattern);
    return { pattern, matches: existsSync(absolute) ? [absolute] : [], missing: !existsSync(absolute) };
  }

  const matches = globSync(pattern, { cwd: baseDir }).map((match) => path.resolve(baseDir, match));
  return { pattern, matches, missing: false };
}

import { describe, expect, it } from 'vitest';
import { deriveHistoryLabel } from '../../src/main/command-analysis/history-label';
import type { ParsedCommand } from '../../shared/types/command';

function annotated(...commandSummaries: Array<string | null>): ParsedCommand {
  return {
    raw: '',
    hasSyntaxError: false,
    segments: commandSummaries.map((commandSummary) => ({ command: null, tokens: [], commandSummary })),
  };
}

describe('deriveHistoryLabel', () => {
  it('returns the single segment summary as-is', () => {
    expect(deriveHistoryLabel(annotated('Lista los archivos y carpetas de un directorio.'))).toBe(
      'Lista los archivos y carpetas de un directorio.',
    );
  });

  it('joins multiple segment summaries (e.g. a pipeline) with an arrow', () => {
    expect(deriveHistoryLabel(annotated('Muestra los procesos.', 'Busca un texto.'))).toBe(
      'Muestra los procesos. → Busca un texto.',
    );
  });

  it('skips segments with no known summary', () => {
    expect(deriveHistoryLabel(annotated('Lista archivos.', null))).toBe('Lista archivos.');
  });

  it('returns null when nothing had a known summary', () => {
    expect(deriveHistoryLabel(annotated(null, null))).toBeNull();
  });

  it('returns null for no segments at all', () => {
    expect(deriveHistoryLabel(annotated())).toBeNull();
  });
});

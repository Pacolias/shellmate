import type { ParsedCommand } from '@shared/types/command';

/**
 * One-line natural-language label for the history diary, reusing the same
 * per-segment command summaries `command-dictionary.ts` attaches for the
 * subtitles module — the two views are never allowed to disagree about
 * what a command "means" because they come from the same annotation step.
 * `annotated` must already have gone through `annotateCommand`.
 */
export function deriveHistoryLabel(annotated: ParsedCommand): string | null {
  const summaries = annotated.segments.map((segment) => segment.commandSummary).filter((summary): summary is string => !!summary);
  if (summaries.length === 0) return null;
  return summaries.join(' → ');
}

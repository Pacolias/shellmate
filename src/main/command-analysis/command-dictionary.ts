import { z } from 'zod';
import type { DangerLevel, ParsedCommand, ParsedSegment } from '@shared/types/command';
import commandsData from '../../../data/commands.json';

const dangerLevelSchema = z.enum(['safe', 'caution', 'destructive']);

const commandEntrySchema = z.object({
  summary: z.string(),
  baseDanger: dangerLevelSchema,
  flags: z.record(z.string(), z.string()).default({}),
  examples: z.array(z.string()).default([]),
});

const commandDictionarySchema = z.record(z.string(), commandEntrySchema);

export type CommandEntry = z.infer<typeof commandEntrySchema>;

/**
 * Parsed and validated once at module load. A malformed data/commands.json
 * fails fast and loudly instead of quietly breaking the copilot at runtime.
 */
const dictionary: Record<string, CommandEntry> = commandDictionarySchema.parse(commandsData);

export function lookupCommand(name: string): CommandEntry | undefined {
  return dictionary[name];
}

export function baseDangerFor(name: string): DangerLevel | undefined {
  return dictionary[name]?.baseDanger;
}

/**
 * Returns a copy of a ParsedCommand with `commandSummary` and per-token
 * `description` filled in from the dictionary, for the subtitles module.
 * Tokens/commands with no dictionary entry get `null`, not omitted, so the
 * UI can still render "no description available" instead of nothing.
 */
export function annotateCommand(parsed: ParsedCommand): ParsedCommand {
  return { ...parsed, segments: parsed.segments.map(annotateSegment) };
}

function annotateSegment(segment: ParsedSegment): ParsedSegment {
  const entry = segment.command ? dictionary[segment.command] : undefined;

  return {
    ...segment,
    commandSummary: entry?.summary ?? null,
    tokens: segment.tokens.map((token, index) => {
      // The first token is always the command name itself (see bash-parser),
      // which has its own summary field rather than a per-flag description.
      if (index === 0 && token.kind === 'command') {
        return { ...token, description: null };
      }
      return { ...token, description: entry?.flags[token.text] ?? null };
    }),
  };
}

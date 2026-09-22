import { z } from 'zod';
import type { ErrorMatch } from '@shared/types/errors';
import errorsData from '../../../data/errors.json';

const errorEntrySchema = z.object({
  id: z.string(),
  pattern: z.string(),
  explanation: z.string(),
  suggestion: z.string(),
  /** If present, only match when the failed command is one of these. */
  commands: z.array(z.string()).optional(),
});

const errorCatalogSchema = z.array(errorEntrySchema);

type ErrorEntry = z.infer<typeof errorEntrySchema>;

interface CompiledEntry extends ErrorEntry {
  regex: RegExp;
}

const catalog: CompiledEntry[] = errorCatalogSchema.parse(errorsData).map((entry) => ({
  ...entry,
  regex: new RegExp(entry.pattern),
}));

/**
 * Matches a command's stderr against the local error catalog. Returns null
 * — never an invented explanation — when nothing matches, so the UI can
 * fall back to showing the raw error instead of guessing.
 */
export function lookupError(stderr: string, command: string | null): ErrorMatch | null {
  for (const entry of catalog) {
    if (entry.commands && (!command || !entry.commands.includes(command))) {
      continue;
    }
    if (entry.regex.test(stderr)) {
      return { id: entry.id, explanation: entry.explanation, suggestion: entry.suggestion };
    }
  }
  return null;
}

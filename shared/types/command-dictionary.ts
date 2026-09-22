import type { DangerLevel } from './command';

export interface CommandDictionaryEntry {
  summary: string;
  baseDanger: DangerLevel;
  flags: Record<string, string>;
  examples: string[];
}

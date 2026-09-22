/** Deterministic danger rating for a command. Never assigned by AI. */
export type DangerLevel = 'safe' | 'caution' | 'destructive';

export interface DangerAssessment {
  level: DangerLevel;
  /** Plain-language reason, shown to the user (e.g. in the confirmation dialog). */
  reason: string;
}

export type ParsedTokenKind = 'command' | 'flag' | 'argument';

export interface ParsedToken {
  kind: ParsedTokenKind;
  text: string;
  /** Byte offsets into the segment's source command, for highlighting. */
  start: number;
  end: number;
}

/** One command invocation (one pipeline stage, or one side of `&&`/`;`). */
export interface ParsedSegment {
  /** The command name (e.g. "rm"), or null if it couldn't be determined. */
  command: string | null;
  tokens: ParsedToken[];
}

/** Simplified AST for a full input line, possibly containing several commands. */
export interface ParsedCommand {
  raw: string;
  segments: ParsedSegment[];
  hasSyntaxError: boolean;
}

export interface CommandAnalysis {
  parsed: ParsedCommand;
  danger: DangerAssessment;
}

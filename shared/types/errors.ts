/** A translated, actionable explanation for a failed command. */
export interface ErrorMatch {
  /** Id of the catalog entry that matched, for debugging/telemetry. */
  id: string;
  explanation: string;
  suggestion: string;
}

export interface PipelineStageResult {
  command: string;
  output: string;
  exitCode: number;
  /** True when `output` was cut short (a safety cap, not a real truncation signal from the process). */
  truncated: boolean;
}

export type PipelinePreviewResult =
  | { status: 'ok'; stages: PipelineStageResult[] }
  | { status: 'not-eligible'; reason: string }
  | { status: 'error'; message: string };

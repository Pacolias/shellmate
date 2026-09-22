import type { DangerAssessment } from './command';

export interface AiStatus {
  provider: string;
  envVarName: string;
  configured: boolean;
}

export type AiGenerateResult =
  | { status: 'ok'; command: string; explanation: string; danger: DangerAssessment }
  | { status: 'no-api-key'; provider: string; envVarName: string }
  | { status: 'error'; message: string };

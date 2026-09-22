import { spawn } from 'node:child_process';
import type { PipelinePreviewResult, PipelineStageResult } from '@shared/types/pipeline';
import { parseCommand } from '../command-analysis/bash-parser';
import { classifyCommand } from '../command-analysis/danger-classifier';

// Real output rarely needs more than this to be a useful preview; caps
// what an accidentally chatty command (`ps aux` on a busy box) sends over
// IPC. A stage that hangs (waiting on stdin it'll never get, a network
// call) is killed rather than blocking the preview forever.
const MAX_OUTPUT_LENGTH = 4000;
const STAGE_TIMEOUT_MS = 5000;

/**
 * Re-executes a pipeline stage-by-stage in the background — never in the
 * interactive pty — to capture real intermediate output between stages,
 * something a real terminal never shows (only the last stage's stdout
 * ever reaches it). Only runs when danger-classifier.ts rates *every*
 * stage 'safe' (read-only); refuses otherwise rather than risk running a
 * modifying command a second time. See
 * journal/2026-09-22-pipeline-preview-safety.md.
 */
export async function previewPipeline(raw: string, cwd: string | null): Promise<PipelinePreviewResult> {
  const parsed = await parseCommand(raw);

  if (parsed.hasSyntaxError) {
    return { status: 'not-eligible', reason: 'El comando tiene un error de sintaxis.' };
  }
  if (parsed.segments.length < 2) {
    return { status: 'not-eligible', reason: 'Esto no es una tubería: hacen falta al menos dos comandos encadenados.' };
  }

  const danger = classifyCommand(parsed);
  if (danger.level !== 'safe') {
    return { status: 'not-eligible', reason: 'Solo se puede previsualizar si todas las etapas son de solo lectura.' };
  }

  try {
    const stages: PipelineStageResult[] = [];
    let inputForNextStage: string | undefined;

    for (const segment of parsed.segments) {
      const commandText = segment.tokens.map((token) => token.text).join(' ');
      const result = await runStage(commandText, inputForNextStage, cwd);
      stages.push(result);
      inputForNextStage = result.output;
    }

    return { status: 'ok', stages };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'No se ha podido previsualizar la tubería.',
    };
  }
}

function runStage(commandText: string, stdin: string | undefined, cwd: string | null): Promise<PipelineStageResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', ['-c', commandText], {
      timeout: STAGE_TIMEOUT_MS,
      cwd: cwd ?? undefined,
    });

    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      const truncated = output.length > MAX_OUTPUT_LENGTH;
      resolve({
        command: commandText,
        output: truncated ? output.slice(0, MAX_OUTPUT_LENGTH) : output,
        exitCode: code ?? -1,
        truncated,
      });
    });

    if (stdin !== undefined) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

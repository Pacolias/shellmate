import type { AiGenerateResult, AiStatus } from '@shared/types/ai';
import { parseCommand } from '../command-analysis/bash-parser';
import { classifyCommand } from '../command-analysis/danger-classifier';
import type { AiProvider } from './ai-provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

const defaultProvider = new GeminiProvider();
const providers: Record<string, AiProvider> = {
  gemini: defaultProvider,
  anthropic: new AnthropicProvider(),
};

function activeProvider(): AiProvider {
  const requested = (process.env.AI_PROVIDER || defaultProvider.name).toLowerCase();
  return providers[requested] ?? defaultProvider;
}

export function getAiStatus(): AiStatus {
  const provider = activeProvider();
  return { provider: provider.name, envVarName: provider.envVarName, configured: provider.isConfigured() };
}

/**
 * The only place that calls out to an AI provider. Whatever `dangerLevel`
 * a provider might be tempted to guess is discarded entirely — the
 * response type doesn't even have a slot for it (see ai-provider.ts) — and
 * `command` is always re-parsed and re-classified locally before it
 * reaches the renderer, exactly like anything typed by hand.
 */
export async function generateCommand(prompt: string, cwd: string | null): Promise<AiGenerateResult> {
  const provider = activeProvider();
  if (!provider.isConfigured()) {
    return { status: 'no-api-key', provider: provider.name, envVarName: provider.envVarName };
  }

  try {
    const response = await provider.generateCommand({ prompt, cwd });
    if (!response.command.trim()) {
      return {
        status: 'ok',
        command: '',
        explanation: response.explanation,
        danger: { level: 'safe', reason: 'No hay ningún comando que ejecutar.' },
      };
    }

    const parsed = await parseCommand(response.command);
    const danger = classifyCommand(parsed);
    return { status: 'ok', command: response.command, explanation: response.explanation, danger };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error desconocido al consultar la IA.',
    };
  }
}

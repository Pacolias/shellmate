import { z } from 'zod';

export interface AiProviderRequest {
  prompt: string;
  cwd: string | null;
}

export interface AiProviderResponse {
  /** Empty string when the provider couldn't turn the prompt into a single command — see `explanation` for why. */
  command: string;
  explanation: string;
}

/**
 * A pluggable natural-language-to-command backend. Deliberately has no
 * concept of danger level at all — ai-service.ts always re-classifies
 * `command` with the local deterministic classifier before anything
 * reaches the renderer, so a provider has no way to under-report risk
 * even by mistake. Add a new provider by implementing this and
 * registering it in ai-service.ts's provider map.
 */
export interface AiProvider {
  readonly name: string;
  readonly envVarName: string;
  isConfigured(): boolean;
  generateCommand(request: AiProviderRequest): Promise<AiProviderResponse>;
}

const responseSchema = z.object({
  command: z.string(),
  explanation: z.string(),
});

/** Shared by every provider: validates the JSON they each ultimately produce (a parsed model response or a tool-call's input) against the same shape. */
export function parseProviderJson(raw: unknown): AiProviderResponse {
  const result = responseSchema.safeParse(raw);
  if (!result.success) {
    throw new Error('La respuesta de la IA no tiene el formato esperado.');
  }
  return result.data;
}

export function buildPrompt(request: AiProviderRequest): string {
  const lines = [`Petición: ${request.prompt}`];
  if (request.cwd) lines.push(`Directorio actual: ${request.cwd}`);
  return lines.join('\n');
}

export const AI_SYSTEM_PROMPT = [
  'Traduces peticiones en lenguaje natural a un único comando de terminal Linux (bash).',
  'Responde siempre con el comando más simple y directo posible.',
  'No expliques el comando fuera del campo "explanation".',
  'Si la petición es ambigua, peligrosa de adivinar, o no se puede resolver con un solo comando, deja "command" vacío y explica por qué en "explanation".',
].join(' ');

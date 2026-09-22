import Anthropic from '@anthropic-ai/sdk';
import { AI_SYSTEM_PROMPT, buildPrompt, parseProviderJson } from '../ai-provider';
import type { AiProvider, AiProviderRequest, AiProviderResponse } from '../ai-provider';

// Not verified against a live call — no API key was available while
// building this (see journal/2026-09-22-ai-provider.md). Worth
// double-checking this is still a valid model id once real usage starts.
const MODEL = 'claude-haiku-4-5-20251001';
const TOOL_NAME = 'submit_command';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly envVarName = 'ANTHROPIC_API_KEY';

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async generateCommand(request: AiProviderRequest): Promise<AiProviderResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada.');

    const client = new Anthropic({ apiKey });
    // tool_choice forces the model to call submit_command, which gets us
    // reliable structured output the same way Gemini's responseSchema
    // does, without depending on freeform-text JSON parsing.
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(request) }],
      tools: [
        {
          name: TOOL_NAME,
          description: 'Envía el comando de terminal propuesto y su explicación.',
          input_schema: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              explanation: { type: 'string' },
            },
            required: ['command', 'explanation'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) throw new Error('Claude no devolvió el comando esperado.');

    return parseProviderJson(toolUse.input);
  }
}

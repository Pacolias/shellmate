import { GoogleGenAI, Type } from '@google/genai';
import { AI_SYSTEM_PROMPT, buildPrompt, parseProviderJson } from '../ai-provider';
import type { AiProvider, AiProviderRequest, AiProviderResponse } from '../ai-provider';

// Verified against a live call on 2026-09-22 (see
// journal/2026-09-22-ai-provider.md) — the original 'gemini-2.5-flash'
// had already been retired, and the API's own 404 pointed at this one.
const MODEL = 'gemini-3.6-flash';

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  readonly envVarName = 'GEMINI_API_KEY';

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async generateCommand(request: AiProviderRequest): Promise<AiProviderResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada.');

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: MODEL,
      contents: buildPrompt(request),
      config: {
        systemInstruction: AI_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            command: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ['command', 'explanation'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('Gemini devolvió una respuesta vacía.');

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini no devolvió un JSON válido.');
    }
    return parseProviderJson(parsed);
  }
}

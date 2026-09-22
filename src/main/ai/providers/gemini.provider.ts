import { GoogleGenAI, Type } from '@google/genai';
import { AI_SYSTEM_PROMPT, buildPrompt, parseProviderJson } from '../ai-provider';
import type { AiProvider, AiProviderRequest, AiProviderResponse } from '../ai-provider';

// Not verified against a live call — no API key was available while
// building this (see journal/2026-09-22-ai-provider.md). Worth
// double-checking this is still a valid model id once real usage starts.
const MODEL = 'gemini-2.5-flash';

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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateCommand, getAiStatus } from '../../src/main/ai/ai-service';

const ENV_KEYS = ['AI_PROVIDER', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('getAiStatus', () => {
  it('defaults to gemini, unconfigured, when nothing is set', () => {
    expect(getAiStatus()).toEqual({ provider: 'gemini', envVarName: 'GEMINI_API_KEY', configured: false });
  });

  it('reports configured once GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    expect(getAiStatus()).toEqual({ provider: 'gemini', envVarName: 'GEMINI_API_KEY', configured: true });
  });

  it('switches provider based on AI_PROVIDER', () => {
    process.env.AI_PROVIDER = 'anthropic';
    expect(getAiStatus()).toEqual({ provider: 'anthropic', envVarName: 'ANTHROPIC_API_KEY', configured: false });
  });

  it('is case-insensitive for AI_PROVIDER', () => {
    process.env.AI_PROVIDER = 'Anthropic';
    expect(getAiStatus().provider).toBe('anthropic');
  });

  it('falls back to gemini for an unknown AI_PROVIDER value', () => {
    process.env.AI_PROVIDER = 'openai';
    expect(getAiStatus().provider).toBe('gemini');
  });
});

describe('generateCommand', () => {
  it('returns no-api-key without ever attempting a network call when unconfigured', async () => {
    const result = await generateCommand('lista los archivos', '/home/paco');
    expect(result).toEqual({ status: 'no-api-key', provider: 'gemini', envVarName: 'GEMINI_API_KEY' });
  });

  it('reports the active provider in the no-api-key result', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    const result = await generateCommand('lista los archivos', null);
    expect(result).toEqual({ status: 'no-api-key', provider: 'anthropic', envVarName: 'ANTHROPIC_API_KEY' });
  });
});

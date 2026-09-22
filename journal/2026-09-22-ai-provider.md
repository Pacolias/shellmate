# AI provider: built without a live key, not yet verified end to end

**Date:** 2026-09-22
**Phase:** Phase 3

## Status

`GeminiProvider` (`@google/genai`) and `AnthropicProvider`
(`@anthropic-ai/sdk`) are fully implemented per
`journal/2026-09-22-ai-provider-abstraction.md`'s original design, but
**no real API call has been made against either** — the project owner
doesn't have a `GEMINI_API_KEY` ready yet, and confirmed building ahead
without one rather than waiting.

## What was verified without a key

- Both SDKs' actual TypeScript type definitions were read directly
  (`npm pack` + inspect `.d.ts`, not guessed from memory or docs) to get
  the call shapes right:
  - Gemini: `new GoogleGenAI({ apiKey })`,
    `client.models.generateContent({ model, contents, config: {
    systemInstruction, responseMimeType: 'application/json',
    responseSchema } })`, response `.text` getter.
  - Anthropic: `new Anthropic({ apiKey })`, `client.messages.create({
    model, max_tokens, system, messages, tools, tool_choice: { type:
    'tool', name } })`, forcing a single tool call for structured output
    (no native JSON-mode in this SDK version, unlike Gemini) — the
    response's `tool_use` content block's `input` is the parsed result.
- `ai-service.ts`'s provider selection, the `no-api-key` short-circuit
  (never even attempts a call when unconfigured), and danger
  re-classification are unit tested and pass.
- `npm run typecheck` and `npm run build` are clean with both SDKs as real
  dependencies.

## What is NOT verified

- That the actual API calls succeed, return well-formed JSON matching the
  schema, or that the specific model ids used
  (`gemini-2.5-flash`, `claude-haiku-4-5-20251001`) are still valid/current
  by the time this is tested for real.
- That the system prompt actually produces good command suggestions in
  practice.

## Action item

Once a `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY` + `AI_PROVIDER=anthropic`)
is available: test a handful of real prompts through the natural-language
panel, and specifically watch for (a) the model ids above still resolving,
(b) `responseSchema`/tool-forced output actually staying valid JSON under
real model behavior, not just the documented contract.

# AI provider: verified end to end with a real Gemini call

**Date:** 2026-09-22
**Phase:** Phase 3

## Status

`GeminiProvider` (`@google/genai`) and `AnthropicProvider`
(`@anthropic-ai/sdk`) are fully implemented per
`journal/2026-09-22-ai-provider-abstraction.md`'s original design. Built
without a live key at first (see the original version of this entry, kept
below); once the project owner added a real `GEMINI_API_KEY` to `.env`
(see `journal/2026-09-22-dotenv-support.md`), it was tested for real.

## What the real call found

The first live request failed with a 404: **`gemini-2.5-flash` had
already been retired** — Gemini's own error message pointed at the
replacement (`gemini-3.6-flash`). Exactly the risk this entry originally
flagged as unverified. Fixed by updating `gemini.provider.ts`'s `MODEL`
constant; re-ran the same request and got a correct result: prompt "lista
los archivos ocultos del directorio actual" → `ls -d .*` with a matching
explanation, correctly re-classified `safe` by the local danger
classifier, and inserted into the terminal (help level was "Alto").

`AnthropicProvider` / `claude-haiku-4-5-20251001` is **still unverified**
— only a Gemini key was available. Same category of risk applies; check
it the same way (one real request) before relying on it.

## What was verified without a key (original entry, still accurate)

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

## Lesson

This is the second time in this project a hardcoded model/API detail
turned out to be stale the moment it was actually exercised (see also the
`vite-plugin-static-copy` environment-name and directory-structure
surprises in `journal/2026-09-22-static-assets-in-main-bundle.md`). A
model id that type-checks and matches the SDK's shape is not the same
claim as "this model still exists" — the only way to know is a real call.

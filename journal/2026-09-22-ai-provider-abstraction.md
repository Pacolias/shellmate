# Configurable AI provider (Gemini by default, Anthropic as an alternative)

**Date:** 2026-09-22
**Phase:** Plan / Phase 1

## Decision

The original plan (PLAN.md) proposed using only the Anthropic API for the
natural-language module (phase 3). It's replaced with a common `AiProvider`
interface, with two interchangeable implementations:

- `providers/gemini.provider.ts` — default provider (`AI_PROVIDER=gemini`,
  key in `GEMINI_API_KEY`).
- `providers/anthropic.provider.ts` — alternative (`AI_PROVIDER=anthropic`,
  key in `ANTHROPIC_API_KEY`).

`ai-service.ts` selects the active provider by reading `AI_PROVIDER` and
exposes a single function to the IPC handlers; no other module knows which
SDK is behind it.

## Why

The project owner will use their own Gemini key, but wants anyone who clones
the repo to be able to use whichever AI provider they prefer, without
touching code. A common interface + env-var selection solves this without
duplicating the danger re-validation logic (which lives in `ai-service.ts`,
not in each provider).

## Alternatives considered

- **Gemini only, swappable key:** simpler, but doesn't let someone cloning
  the repo use Anthropic or another provider without editing code. Dropped
  after explicitly asking the project owner.

## Implementation notes (phase 3)

- AI never decides the danger level: `ai-service.ts` always re-validates the
  `dangerLevel` returned by the provider against `danger-classifier.ts`
  before showing it.
- With no key configured for the active provider, the panel must show setup
  instructions instead of failing.

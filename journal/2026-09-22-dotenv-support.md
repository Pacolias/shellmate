# Added .env support for the AI provider keys

**Date:** 2026-09-22
**Phase:** Phase 3 (post-launch polish)

## Decision

`ai-service.ts` only ever read `process.env.GEMINI_API_KEY` /
`ANTHROPIC_API_KEY` / `AI_PROVIDER` directly — fine for `export`-ing a key
in the same shell you launch `npm run dev` from, but that doesn't persist
across terminals or reboots. Added `dotenv`: `import 'dotenv/config'` as
the very first line of `src/main/index.ts`, before any other import, so
`process.env` is populated from a `.env` file at the project root before
`ai-service.ts` (or anything else) ever reads it.

`.env` was already in `.gitignore` from phase 1 (added preemptively).
Added `.env.example` documenting the three variables, gitignore-safe to
commit since it has no real values.

Verified the plumbing works (a throwaway `.env` with a fake key flips the
natural-language panel from "setup instructions" to the normal prompt
form) before the project owner added their real key — see
`journal/2026-09-22-ai-provider.md` for the real end-to-end call that
followed.

## Incident during verification

While cleaning up the throwaway test `.env`, ran `rm -f .env`
unconditionally. The project owner had said mid-turn that they'd already
added their real key — almost certainly to the same path, around the same
time — so that cleanup likely deleted their real `.env` instead of (or in
addition to) the test one. No project data was at risk (an API key is
just re-pasted, not lost work), but it's a real instance of deleting a
shared, predictable path without checking whether it had changed since I
created it. Recorded as a standing lesson in auto-memory
(`feedback_verify_before_rm_shared_paths`), not just here — it's a
behavior fix, not a one-off project detail.

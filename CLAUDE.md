# Language

- Everything in the repository is written in English: code, identifiers,
  comments, commit messages, PLAN.md, README.md, journal entries — no
  exceptions.
- The one exception is user-facing UI text inside the app, which is in
  Spanish and centralized in a single translations file (see PLAN.md), so
  other languages can be added later without touching component code.

# Workflow

- Make atomic commits (one logical change per commit).
- Push periodically, not necessarily after every commit.
- Record important engineering decisions (architecture, library choices,
  deviations from PLAN.md, blockers and how they were resolved) as journal
  entries in `journal/`, one markdown file per entry
  (`journal/YYYY-MM-DD-slug.md`). This is not a changelog of every change —
  only decisions someone reviewing the project would need the "why" for.

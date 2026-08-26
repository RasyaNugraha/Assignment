# Git Repository & Version Control Approach

## Repository

Single Git repository at the project root (`fabulari/`), containing both the
Express server (`server/`) and the Angular client (`client/`) side by side —
a monorepo layout, since Phase 1 doesn't need them deployed or versioned
separately. Remote: `https://github.com/RasyaNugraha/Assignment.git`.

## Branching approach

Work was done on short-lived feature/docs branches, merged back into `main`
once each unit of work was complete and buildable:

- `docs/*` branches for planning and requirements docs written before any
  code (`docs/phase1-requirements`, `docs/phase1-data-structures`,
  `docs/phase1-architecture-endpoints-design`, `docs/course-timeline`,
  `docs/code-walkthrough-and-subscribe-alignment`).
- `feature/*` branches for implementation slices (`feature/server-skeleton`,
  `feature/dob-field`, `feature/group-room-profile-screens`,
  `feature/week4-lecture-alignment`).
- Each branch was merged with a merge commit (visible in `git log` as
  `Merge branch '...'`), keeping the history of what was worked on together
  even after merging into `main`.

## Commit style

Commits are small and scoped to one logical change, using conventional
prefixes:

- `feat:` — new functionality (e.g. `feat: Group creation/join request flow
  (server + GroupListComponent)`)
- `fix:` — bug fixes (e.g. `fix: subscribe to route.paramMap instead of
  reading it once`)
- `refactor:` — behaviour-preserving code changes (e.g. `refactor: use
  inject() instead of constructor DI`)
- `docs:` — documentation-only changes
- `chore:` — housekeeping (dependency lockfiles, config)

This keeps each commit reviewable on its own and gives a readable history of
how the app grew feature-by-feature, rather than a handful of giant commits.

## What's tracked vs ignored

`server/data/db.json` (the JSON-file data store) **is** committed, so the
repository always includes a working seed/demo dataset. `node_modules/` for
both `server/` and `client/` are excluded via `.gitignore`; `package-lock.json`
files are committed for both, so dependency versions are reproducible.

## Why this matters for grading

Git history here doubles as a build log: each commit corresponds to one
working increment (verified via `node -c` / `tsc --noEmit` before commit),
so `git log --oneline` reads as a timeline of how Phase 1 was built, not just
a single "final" dump.

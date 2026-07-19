# ROCK ATLAS agent startup rule

Before any work in this repository, read `PROJECT_STATUS.md` completely, then inspect the current branch, `git status`, recent commits, and `git diff`.

- Treat uncommitted changes as user-owned. Do not overwrite, discard, reset, or silently normalize them.
- When the user says to check, continue, or start the next step, use `PROJECT_STATUS.md` to identify the current state and resume from its next actionable step without requesting a separate handoff.
- If the status document conflicts with the filesystem or Git, trust the actual files and Git, then update `PROJECT_STATUS.md`.
- Before ending a workday, switching agents, or completing a major milestone, update `PROJECT_STATUS.md` with completed work, unfinished work, validation results, Git state, and the exact next step.
- Do not merge or deploy to `main` without explicit user approval.

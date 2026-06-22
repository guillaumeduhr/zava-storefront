# Architecture guidelines

## Layers and imports

- **No cross-layer imports.** `app/` (routes, pages) must not import directly
  from `infra/` (database, external clients). Route through `lib/` adapters.
  `lib/` must not import from `app/`. Violations are coupling debt that
  compounds on every refactor.
- **New routes are inaccessible by default.** Apply authentication +
  authorization before the handler body. Default-deny, not default-allow.

## External dependencies

- **Check `package.json` before reaching for npm.** If `next`, `pg`, `zod`,
  or another already-installed package provides the capability, use it.
  Do not add a new dependency to solve a problem an existing one solves.
- **New external packages need a rationale in the PR description:** one line
  stating what it does, why the already-installed alternatives don't fit, and
  what alternatives were considered. This is the project's lightweight ADR.
- **No framework recreation.** If Next.js handles routing/SSR, `pg` handles
  queries, or `zod` handles validation — use them rather than writing
  equivalent logic by hand.

## Change discipline

- **Smallest possible diff.** Implement only what the work item states.
  Improvements noticed along the way go in the PR's "out of scope" section,
  not in the branch.
- **One concern per commit.** Each commit message follows Conventional Commits:
  `type(scope): description`. Do not bundle unrelated changes.

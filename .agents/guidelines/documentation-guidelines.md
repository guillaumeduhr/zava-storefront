# Documentation guidelines

## Code comments

- **Comments explain why, not what.** If what the code does is clear from
  reading it, no comment is needed. Write a comment only when there is a
  tricky or non-obvious reason the code is written a particular way — a
  workaround, a deliberate trade-off, a surprising invariant.
- **Never restate the code in prose.** `// increment counter` above
  `counter++` is noise. Delete it.

## Docstrings

- **Every exported TypeScript function, type, and class gets a JSDoc comment**
  on the public surface (functions in `lib/`, API handlers in `app/`).
  Minimum: one sentence saying what it does. Add `@param` / `@returns` when
  the signature alone is ambiguous.
- **Internal helpers that are non-obvious** get a brief comment. Skip trivial
  one-liners and pure passthroughs.

## README and user-facing docs

- **User-facing changes update `README.md`.** New routes, new environment
  variables, changed CLI flags, new API fields — if a developer setting up
  the project would need to know about it, it belongs in the README.
- Keep the README accurate and minimal. Do not document implementation
  details there; those live in code comments or `docs/architecture.md`.

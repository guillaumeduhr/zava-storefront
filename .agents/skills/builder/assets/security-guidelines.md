# Security implementation guidelines

## Input validation

- **Validate all untrusted input at the boundary.** HTTP handler, message
  consumer, CLI arg — validate before the data goes anywhere else. Use `zod`
  (already installed) for schema validation; do not hand-roll checks.
- **Parameterize every query.** No string concatenation into SQL. Use `pg`
  parameterized queries (`$1`, `$2`, …).
- **Encode output for its destination.** HTML → escape; JSON → `JSON.stringify`;
  never build output strings by hand when a library is available.

## Secrets

- **Never commit secrets.** No tokens, passwords, connection strings, or API
  keys in code or config files.
- Reference secrets by name: `process.env.SECRET_NAME` resolved at runtime
  via Key Vault or `${{ secrets.* }}` in CI. No inline values, ever.

## Dependencies

- **Pin to exact versions.** `"foo": "1.2.3"` — not `"^1.2.3"`, not `"latest"`.
- **Check it is the latest stable release** before adding or updating a package:
  `npm outdated` to surface drift; `npm view <pkg> version` for latest.
- **Prefer packages already in `package.json`.** Before adding anything new,
  confirm the capability is not already covered by an installed dependency
  (`zod` for validation, `pg` for Postgres, `next` for routing/API, etc.).
  Adding a new package requires a justification line in the PR description.

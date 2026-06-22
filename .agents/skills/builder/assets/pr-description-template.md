## What this PR does

<!-- Fill from in-scope task list in plan.md -->
- <implemented change 1>
- <implemented change 2>

## Why

<!-- Verbatim work item summary — ≤3 sentences. Do not paraphrase. -->
<work item summary>

## Checklist (secure-coding-base)

- [ ] No new secrets committed (tokens, keys, passwords, connection strings)
- [ ] New HTTP handlers have both authN and an explicit authZ check
- [ ] All new DB queries are parameterized — no string concatenation into SQL
- [ ] New npm dependencies are pinned to exact versions and justified below
- [ ] PII is masked in all new log lines (no full email, PAN, token, DOB)
- [ ] Error responses contain only a generic message + correlation ID

## Test coverage

- [ ] Unit tests added or updated for the new behavior
- [ ] `npm run lint` passes on this branch
- [ ] `npm test` passes on this branch

## Out of scope

<!-- Items observed during implementation that are NOT part of this PR.     -->
<!-- If nothing notable was observed, write: "Nothing notable observed."    -->
<!-- Format: **Topic** — observation — suggested follow-up                  -->

| Area | Observation | Suggested follow-up |
|------|-------------|---------------------|
| | | |

## Dependency justification

<!-- Required for every new npm package added. Delete this section if none. -->

| Package | Pinned version | Why this package | Alternatives considered |
|---------|---------------|------------------|------------------------|
| | | | |

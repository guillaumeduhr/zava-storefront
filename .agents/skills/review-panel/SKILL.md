---
name: review-panel
description: "Use this skill to review code changes against Zava's security, architecture, and documentation guidelines and get a structured verdict. Activate before pushing staged changes ('push my changes', 'panel review', 'check my staged changes', 'run a pre-push review', 'should I push this') or when reviewing an open pull request ('review PR #N', 'should this PR merge', 'is this PR ready', 'give me a structured PR review', 'audit this change before approval'). Covers three dimensions: security (secrets, auth, input handling, crypto), architecture/CI-CD (golden path compliance, IaC, deployment gates), and documentation (docstrings, style, examples). For staged changes: verdict is PUSH or HOLD. For pull requests: verdict is MERGE or REQUEST CHANGES. Does NOT approve via GitHub review API, does NOT merge, does NOT push commits, does NOT fix code."
---

# review-panel

Three-lens review of staged changes or an open PR against Zava's guidelines.
One structured verdict. Two modes -- same process, same quality bar.

## When to use

- **Before pushing:** you have non-trivial staged changes and want to catch issues
  before the human reviewer sees them. Skip for trivial fixes (typo, comment, version bump).
- **On a PR:** you want a second-opinion sweep with a binary merge-readiness verdict.
- Wired to `pr-review-gate.hook.md` for automatic pre-push runs on `feat/*`, `fix/*`, `chore/*`.

## When NOT to use

- Fixing the issues this skill surfaces -- identify here, fix separately.
- Trivial one-liners where the panel noise exceeds the signal.

## Inputs

- **Mode** (auto-detected -- see Step 1): staged diff or PR number.
- **PR number** (optional): if given, forces PR mode. Otherwise auto-detected.
- **Scope hint** (optional): `--scope auth|storage|ui|infra` to focus all three lenses.

## Output format (B8 attention anchor -- always in this exact order)

**Staged mode:**
```
## Pre-push Review

### Verdict: PUSH | HOLD

**Why:** <2-3 sentences>

---

### Security findings
*(grounds: secure-coding-base.instructions.md + security-guidelines.md)*

| Severity | Finding | Location | Required action |
|---|---|---|---|
| BLOCKER | ... | file:line | ... |
...

*(If empty: "No security findings.")*

### Architecture / CI-CD findings
*(grounds: ci-cd-golden-paths.instructions.md + architecture-guidelines.md)*

| Severity | Finding | Location | Required action |
|---|---|---|---|
...

### Documentation findings
*(grounds: docs-style-guide.instructions.md + documentation-guidelines.md)*

| Severity | Finding | Location | Required action |
|---|---|---|---|
...
```

**PR mode:** same structure, header becomes `## PR Review: <title> (#<number>)`,
verdict labels become `MERGE | REQUEST CHANGES`.

## Severity scale

- **BLOCKER:** must be fixed before pushing/merging (exploitable vuln, golden-path
  violation blocking CI/deploy, new exported symbol with zero docs)
- **HIGH:** should be fixed in this change (clearly wrong but not immediately exploitable)
- **LOW:** nice-to-have fix (style, minor gap, non-blocking concern)

**Verdict rule:**
- **PUSH / MERGE** if zero BLOCKER findings across all three dimensions
- **HOLD / REQUEST CHANGES** if any BLOCKER, OR two or more HIGH findings in the same dimension

---

## Process

### Step 1 -- Detect mode and fetch diff (S7 deterministic tool bridge)

Run this first; do not assume the output from memory:

```sh
gh pr view --json number,title,headRefName 2>/dev/null
```

- **If a PR is found** (or a PR number was given): PR mode.
  ```sh
  gh pr view --json number,title,body,headRefName,baseRefName
  gh pr diff
  ```
- **If no PR is found**: staged mode.
  ```sh
  git diff --staged
  ```
  If staged diff is empty: stop and tell the user there is nothing staged to review.

For either mode: if the diff exceeds ~400 lines, also run `gh pr diff --stat` or
`git diff --staged --stat`, then load `references/large-pr-strategy.md` and apply
the focus heuristics before passing the diff to the lenses.

### Step 2 -- Load guidelines (lazy load -- read now, not at session start)

Two-layer model. Load both layers before spawning.

**Layer 1 -- Zava-wide baseline:**
```
Security lens   -> Read: .github/instructions/secure-coding-base.instructions.md
Arch/CI-CD lens -> Read: .github/instructions/ci-cd-golden-paths.instructions.md
Docs lens       -> Read: .github/instructions/docs-style-guide.instructions.md
```

**Layer 2 -- zava-storefront project-specific:**
```
Security lens   -> Also read: .agents/guidelines/security-guidelines.md
Arch/CI-CD lens -> Also read: .agents/guidelines/architecture-guidelines.md
Docs lens       -> Also read: .agents/guidelines/documentation-guidelines.md
```

If any file is missing: mark that dimension `[guideline unavailable]` and continue.

### Step 3 -- Run three lenses in parallel (B1 fan-out)

Spawn three independent threads. Each receives the diff + its guideline content.
Threads do not share state. Each returns one JSON receipt.

**Spawn 1 -- Security lens** (INTERNAL, REVIEWER class)

```
ROLE: security reviewer. SCOPE: this diff only.
RUBRIC: secure-coding-base.instructions.md + security-guidelines.md (loaded above).
FIND: secrets in diff, missing authn/authz on new handlers, string-concat SQL,
      unvalidated input at request boundary, weak/custom crypto, PII in logs,
      stack traces in API responses, unguarded destructive operations.
SEVERITY: BLOCKER=exploitable vuln or secret committed; HIGH=clearly wrong pattern;
          LOW=style/minor gap.
OUTPUT JSON ONLY:
{"dimension":"security","findings":[{"sev":"BLOCKER|HIGH|LOW","finding":"...","location":"file:line or N/A","action":"..."}]}
NO PROSE OUTSIDE THE JSON OBJECT.
```

**Spawn 2 -- Architecture / CI-CD lens** (INTERNAL, REVIEWER class)

```
ROLE: architecture reviewer. SCOPE: this diff only.
RUBRIC: ci-cd-golden-paths.instructions.md + architecture-guidelines.md (loaded above).
FIND: new pipelines not using reusable workflows, bespoke pipelines when a golden-path
      reusable workflow covers the need, missing deployment gates, IaC not following
      golden-path modules, unbounded dep version ranges in production, Dockerfile
      anti-patterns, missing OIDC where secrets are used, cross-layer imports
      (app/ importing infra/ directly), new routes without auth.
SEVERITY: BLOCKER=breaks golden path blocking CI/deploy or introduces cross-layer import;
          HIGH=notable drift from standard; LOW=minor deviation.
OUTPUT JSON ONLY:
{"dimension":"architecture","findings":[{"sev":"BLOCKER|HIGH|LOW","finding":"...","location":"file:line or N/A","action":"..."}]}
NO PROSE OUTSIDE THE JSON OBJECT.
```

**Spawn 3 -- Documentation lens** (INTERNAL, REVIEWER class)

```
ROLE: documentation reviewer. SCOPE: this diff only.
RUBRIC: docs-style-guide.instructions.md + documentation-guidelines.md (loaded above).
FIND: new or changed public functions/classes/types with missing docstrings,
      wrong docstring format for the language (Google/TSDoc/Javadoc/Go),
      missing @param or @returns on non-trivial APIs, no runnable example on a
      new non-trivial public API, marketing copy (blazing fast, robust, industry-leading),
      user-facing changes not reflected in README.
SEVERITY: BLOCKER=new exported symbol with zero documentation on a public API;
          HIGH=wrong format or missing required section; LOW=style gap.
OUTPUT JSON ONLY:
{"dimension":"docs","findings":[{"sev":"BLOCKER|HIGH|LOW","finding":"...","location":"file:line or N/A","action":"..."}]}
NO PROSE OUTSIDE THE JSON OBJECT.
```

### Step 4 -- Schema gate (S4 validation decorator)

Confirm each receipt: dimension string present, findings is an array, each item has
sev/finding/location/action. If a receipt is malformed, re-run that spawn once before
continuing.

### Step 5 -- Synthesize verdict (B4 plan memento + B8 attention anchor)

Re-read the three JSON receipts. Re-read the verdict rule above (anchoring).

1. Sort each dimension's findings: BLOCKER first, then HIGH, then LOW.
2. Apply verdict rule: PUSH/MERGE or HOLD/REQUEST CHANGES.
3. Write the "Why" rationale in 2-3 sentences.
4. Emit the output format from the "Output format" section above.

---

## Hard rules

- **Diff-only scope.** Do not read files outside the diff unless a single targeted
  lookup is needed to assess severity (e.g. checking whether a new route has an auth
  decorator in an adjacent file).
- **Honest severity.** A BLOCKER must be genuinely blocking. Inflating severity
  destroys trust in the panel.
- **All three dimensions always reported.** If a lens finds nothing, write "No findings."
  Never omit a section.
- **One verdict.** Any BLOCKER anywhere makes the verdict HOLD / REQUEST CHANGES.
- **No auto-actions.** Do not approve, merge, push, or amend commits.

## See also

- `builder` -- implement fixes surfaced by this skill
- `pr-review-gate.hook.md` -- automated pre-push trigger
- `.github/instructions/secure-coding-base.instructions.md` -- security rubric (Zava-wide)
- `.github/instructions/ci-cd-golden-paths.instructions.md` -- architecture/CI-CD rubric (Zava-wide)
- `.github/instructions/docs-style-guide.instructions.md` -- documentation rubric (Zava-wide)
- `.agents/guidelines/` -- zava-storefront project-specific extensions

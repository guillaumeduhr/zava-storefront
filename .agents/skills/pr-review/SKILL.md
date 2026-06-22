---
name: pr-review
description: "Use this skill to review a pull request for merge readiness, checking it against Zava's security, architecture, and documentation guidelines. Activate when someone asks to review a PR, check if a PR should merge, audit a change before approval, or get a MERGE / REQUEST CHANGES verdict. Also triggers on: 'is this PR ready', 'check PR #N', 'should this merge', 'review this for merge', 'give me a structured PR review', 'audit this change for merge'. Covers three dimensions: security (secrets, auth, input handling, crypto), architecture/CI-CD (golden path compliance, IaC, deployment gates), and documentation (docstrings, style, examples). Produces one structured verdict with merge recommendation, decision rationale, and findings ordered by criticality per dimension. Does NOT approve via GitHub review API, does NOT merge, does NOT push commits, does NOT fix code. Use panel-review for pre-push staged-change review instead."
---

# pr-review

Three-lens review of an existing PR against Zava's guideline files.
Verdict: **MERGE** or **REQUEST CHANGES**.

## When to use

- Before approving or merging a teammate's PR.
- When you want a second-opinion sweep across all three dimensions at once.
- Any time a structured merge-readiness verdict is needed.

## When NOT to use

- Pre-push review of local staged changes -- use `panel-review` instead.
- Fixing the issues this skill surfaces -- identify here, fix separately.

## Inputs

- **PR number** (optional -- if omitted, auto-detect from the current branch).
- **Scope hint** (optional) -- e.g. `skip-docs` if documentation was already reviewed.

## Output format (B8 attention anchor -- always produce in this exact order)

```
## PR Review: <title> (#<number>)

### Verdict: MERGE | REQUEST CHANGES

**Why:** <2-3 sentences naming the decisive findings, or what the PR does well on a MERGE>

---

### Security findings
*(grounds: .github/instructions/secure-coding-base.instructions.md)*

| Severity | Finding | Location | Required action |
|---|---|---|---|
| BLOCKER | ...     | file:line | ...             |
| HIGH    | ...     | ...       | ...             |
| LOW     | ...     | ...       | ...             |

*(If empty: "No security findings.")*

### Architecture / CI-CD findings
*(grounds: .github/instructions/ci-cd-golden-paths.instructions.md)*

| Severity | Finding | Location | Required action |
|---|---|---|---|
...

### Documentation findings
*(grounds: .github/instructions/docs-style-guide.instructions.md)*

| Severity | Finding | Location | Required action |
|---|---|---|---|
...
```

## Severity scale

- **BLOCKER**: must be fixed before merging (exploitable vuln, golden-path violation blocking CI/deploy, new exported symbol with zero docs)
- **HIGH**: should be fixed in this PR (clearly wrong but not immediately exploitable)
- **LOW**: nice-to-have fix (style, minor gap, non-breaking concern)

**Verdict rule:**
- **MERGE** if: zero BLOCKER findings across all three dimensions
- **REQUEST CHANGES** if: any BLOCKER, OR two or more HIGH findings in the same dimension

---

## Process

### Step 1 -- Fetch PR context (S7 deterministic tool bridge)

Run these commands; do not assume their output from memory:

```sh
gh pr view --json number,title,body,headRefName,baseRefName
gh pr diff
```

If the diff output exceeds ~400 lines, also run:

```sh
gh pr diff --stat
```

For diffs above 400 lines: load `references/large-pr-strategy.md` and apply
the focus heuristics before passing the diff to the lenses.

### Step 2 -- Ground each lens (lazy load -- read these files now, not before)

Two-layer model per lens. Load both layers before spawning.

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

Probe: if any file is missing, mark that dimension `[guideline unavailable]` and continue.

### Step 3 -- Run three lenses in parallel (B1 fan-out)

Spawn three independent review threads. Each thread receives the PR diff and its
guideline file content; it returns one JSON receipt. Threads do not share state.

**Spawn 1 -- Security lens** (INTERNAL, REVIEWER class)

```
ROLE: security reviewer. SCOPE: this PR diff only.
RUBRIC: content of secure-coding-base.instructions.md + security-guidelines.md (loaded above).
FIND: secrets in diff, missing authn/authz on new handlers, string-concat SQL,
      unvalidated input at request boundary, weak/custom crypto, PII in logs,
      stack traces in API responses, unguarded destructive operations.
SEVERITY: BLOCKER=exploitable vuln or secret committed; HIGH=clearly wrong pattern;
          LOW=style/minor gap.
OUTPUT JSON ONLY:
{"dimension":"security","findings":[{"sev":"BLOCKER|HIGH|LOW","finding":"...","location":"file:line or N/A","action":"..."}]}
NO PROSE OUTSIDE THE JSON OBJECT.
```

Receipt schema: `{"dimension":"security","findings":[{"sev":"string","finding":"string","location":"string","action":"string"}]}`

**Spawn 2 -- Architecture / CI-CD lens** (INTERNAL, REVIEWER class)

```
ROLE: architecture reviewer. SCOPE: this PR diff only.
RUBRIC: content of ci-cd-golden-paths.instructions.md + architecture-guidelines.md (loaded above).
FIND: new pipelines not using reusable workflows, bespoke pipelines when a
      golden-path reusable workflow covers the need, missing deployment gates,
      IaC not following golden-path modules, unbounded dep version ranges in
      production, Dockerfile anti-patterns, missing OIDC where secrets are used.
SEVERITY: BLOCKER=breaks golden path in a way that blocks CI or deploy;
          HIGH=notable drift from standard; LOW=minor deviation.
OUTPUT JSON ONLY:
{"dimension":"architecture","findings":[{"sev":"BLOCKER|HIGH|LOW","finding":"...","location":"file:line or N/A","action":"..."}]}
NO PROSE OUTSIDE THE JSON OBJECT.
```

Receipt schema: same structure, dimension="architecture"

**Spawn 3 -- Documentation lens** (INTERNAL, REVIEWER class)

```
ROLE: documentation reviewer. SCOPE: this PR diff only.
RUBRIC: content of docs-style-guide.instructions.md + documentation-guidelines.md (loaded above).
FIND: new or changed public functions/classes/types with missing docstrings,
      wrong docstring format for the language (Google/TSDoc/Javadoc/Go style),
      missing @param or @returns on non-trivial APIs, no runnable example on a
      new non-trivial API, marketing copy (blazing fast, robust, industry-leading).
SEVERITY: BLOCKER=new exported symbol with zero documentation on a public API;
          HIGH=wrong format or missing required section; LOW=style gap.
OUTPUT JSON ONLY:
{"dimension":"docs","findings":[{"sev":"BLOCKER|HIGH|LOW","finding":"...","location":"file:line or N/A","action":"..."}]}
NO PROSE OUTSIDE THE JSON OBJECT.
```

Receipt schema: same structure, dimension="docs"

### Step 4 -- Schema gate (S4 validation decorator)

Before synthesizing, confirm each receipt matches its schema (dimension string present,
findings is an array, each item has sev/finding/location/action). If a receipt is malformed,
re-run that spawn once with a corrected brief before continuing.

### Step 5 -- Synthesize verdict (B4 plan memento + B8 attention anchor)

Re-read the three JSON receipts. Re-read the verdict rule above (anchoring).
Apply:

1. Collect all findings across all dimensions.
2. Sort each dimension's findings: BLOCKER first, then HIGH, then LOW.
3. Apply verdict rule (MERGE / REQUEST CHANGES).
4. Write the "Why" rationale in 2-3 sentences.
5. Emit the output format defined in the "Output format" section above.

---

## Hard rules

- **Diff-only scope.** Do not read files outside the diff unless a single targeted
  lookup is needed to assess severity (e.g., checking whether a new route has an
  auth decorator in an adjacent file).
- **Honest severity.** A BLOCKER must be genuinely blocking. Inflating severity
  destroys trust in the panel.
- **All three dimensions reported.** If a lens finds nothing, write "No findings."
  Never omit a section -- an empty section looks like the skill broke.
- **One verdict.** If any dimension contains a BLOCKER, the verdict is REQUEST CHANGES
  regardless of what other dimensions say.
- **No auto-actions.** Do not post a GitHub review, do not approve, do not merge,
  do not push commits.

## See also

- `panel-review` -- pre-push staged-change review (architect + security, no verdict)
- `.github/instructions/secure-coding-base.instructions.md` -- security rubric (Zava-wide)
- `.github/instructions/ci-cd-golden-paths.instructions.md` -- architecture/CI-CD rubric (Zava-wide)
- `.github/instructions/docs-style-guide.instructions.md` -- documentation rubric (Zava-wide)
- `.agents/guidelines/` -- zava-storefront project-specific extensions (all three dimensions)

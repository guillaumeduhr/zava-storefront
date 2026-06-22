---
name: builder
description: >-
  Use this skill to implement a work item — feature brief, review findings, bug
  description, or TODO — as commits on a new branch and a PR on
  zava-storefront. Activate when the user says "implement this", "build this
  feature", "fix this", "address these review comments", "create a PR for", or
  "work on this ticket". Also triggers when the user pastes panel-review output
  and asks to apply the fixes, or when a task needs to become code. Reads the
  team's security, architecture, and CI/CD guidelines so the output already
  follows Zava standards. Runs npm run lint and npm test before opening the PR;
  fixes check failures before submitting. Anything beyond the stated scope is
  noted in the PR description for a human, not implemented. Does NOT handle
  Sev-1/Sev-2 incident postmortems — use incident-to-pr for those.
---

# builder

Turn a work item into a verified, submitted PR on zava-storefront.

## When to use

- Feature brief, ticket, TODO, or spec → needs to become code on a branch
- Review findings (from `panel-review` or a human reviewer) → need to be applied
- Bug description → needs a targeted fix with a test

## When NOT to use

- Sev-1 / Sev-2 incident postmortems → use `incident-to-pr`
- Pure architecture or design discussions → talk to the architect persona
- Trivial one-liner changes with no PR needed

## Inputs

- **Required:** the work item (pasted inline or a file path)
- **Optional:** branch prefix hint (`feat/`, `fix/`, `chore/`) — inferred from
  the work item type if not given

## Bundled assets

- `assets/pr-description-template.md` — load at step 6 (PR body)
- `assets/scope-note-template.md` — load at step 1 if out-of-scope items exist

## Shared guidelines (loaded at step 3)

Two-layer model — load both layers:

- **Zava-wide baseline** (`.github/instructions/`): enforce everywhere, all languages
- **Storefront-specific** (`.agents/guidelines/`): TypeScript / Next.js / zod / pg detail

---

## Process

> **Attention anchor (B8):** Reload this file and re-read `plan.md` at the
> start of every step and after every tool call that changes repo state.

### Step 1 — Parse and plan  *(B4 PLAN MEMENTO)*

Read the work item. Produce:

1. **In-scope items**: the minimum changes that directly satisfy the stated
   work item. Do not expand scope based on observations.
2. **Out-of-scope items**: anything noticed that is NOT stated in the work
   item. List them; do NOT implement them. Load
   `assets/scope-note-template.md` now if this list is non-empty.
3. **Branch name**: `<type>/<kebab-slug>` where type ∈ {`feat`, `fix`,
   `chore`} inferred from the work item. Max 50 characters total.
4. **Todo list**: atomic, dependency-ordered tasks.

Write the plan to the session's `plan.md`:

```
# builder plan
work item: <≤3-sentence verbatim summary>
branch: <branch-name>

## in-scope
- [ ] <task>
...

## out-of-scope
- <observation> — <why excluded>
...
```

### Step 2 — Branch  *(S7 DETERMINISTIC TOOL BRIDGE — git)*

```bash
git checkout main
git pull
git checkout -b <branch-name>
```

Verify the new branch is checked out before proceeding. If the working tree
is dirty, stash or abort — do not carry unrelated changes into this branch.

### Step 3 — Load guidelines  *(C1 LAZY ASSET)*

Read these files **now** -- they govern every line written in step 4.

**Layer 1 -- Zava-wide baseline:**

- `.github/instructions/secure-coding-base.instructions.md` (secrets, auth, input handling, crypto, PII)
- `.github/instructions/ci-cd-golden-paths.instructions.md` (reusable workflows, IaC, deployment gates, dep pinning)
- `.github/instructions/docs-style-guide.instructions.md` (docstring format per language, README rules, voice)

**Layer 2 -- zava-storefront project-specific:**

- `.agents/guidelines/security-guidelines.md` (zod, pg parameterization, Key Vault patterns)
- `.agents/guidelines/architecture-guidelines.md` (layer imports, app/lib/infra boundaries, dep rationale)
- `.agents/guidelines/documentation-guidelines.md` (TSDoc, why-only comments, README update rules)

Also read the core principles from:

- `.github/agents/architect.agent.md` (coupling, testability, YAGNI,
  operability, existing-patterns-win-ties)
- `.github/agents/security.agent.md` (input validation, authN/authZ, crypto,
  PII, default-deny)

Do not load these at session start. Load them here, at this step.

### Step 4 — Implement

Work through the in-scope task list from `plan.md`. Reload `plan.md` before
each task.

**Rules while implementing:**

- **Smallest diff.** Implement only what the work item states.
- **Follow the guidelines** loaded in step 3:
  - New HTTP handlers: require authentication + explicit authorization check.
  - New DB queries: parameterized — no string concatenation into SQL.
  - New npm dependencies: pinned to exact version; justify in the PR body.
  - Logging: no PII (email, full PAN, tokens) in log lines.
  - Errors: generic message to client + correlation ID; detail to logs only.
- **Tests.** Add or update tests covering the new behavior.
- **No drive-by changes.** Any improvement outside scope goes into the
  out-of-scope list in `plan.md` — do not commit it.
- **Commit incrementally** as each logical unit completes:
  ```bash
  git add -p    # stage only the relevant files / hunks
  git commit -m "<type>(<scope>): <description>"
  ```
  Conventional commit types: `feat`, `fix`, `chore`, `test`, `docs`.
- Update the task status in `plan.md` after each commit.

### Step 5 — Verify: lint and tests  *(S4 VALIDATION DECORATOR + S7 CLI)*

```bash
npm run lint
npm test
```

**On pass:** proceed to step 6.

**On fail — enter the fix loop (max 3 rounds):**

```
Round 1–3:
  1. Read the full error output carefully.
  2. Identify the single root cause of the failure.
  3. Fix ONLY that — no reformatting of unrelated lines.
  4. Re-run: npm run lint && npm test
  5. If pass: break out of loop.

After 3 rounds still failing:
  → B10 HUMAN CHECKPOINT
  Stop. Show the complete error output to the user.
  Ask: "I've hit 3 fix rounds without clearing these failures.
        Please advise — should I try a different approach, skip
        the failing check, or abandon this branch?"
  Do NOT open the PR with red checks.
```

### Step 6 — Open or update PR  *(S7 DETERMINISTIC TOOL BRIDGE — gh + git)*

Load `assets/pr-description-template.md` **now**. Fill it in from `plan.md`.

Check whether a PR already exists for this branch:

```bash
gh pr view --json number,url 2>/dev/null
```

**If no PR exists (first open):**

```bash
git push -u origin <branch-name>

gh pr create \
  --title "<type>(<scope>): <short description matching the work item>" \
  --body-file /tmp/pr-body.md \
  --draft
```

**If a PR exists (updating after review):**

```bash
gh pr edit --body-file /tmp/pr-body.md
```

**Verify the PR was created / updated:**

```bash
gh pr view --json number,url,state
```

Report the PR URL to the user. State which items were placed in the
out-of-scope section and why.

---

## PR description format

Assembled from `assets/pr-description-template.md`. Key fields:

- **What this PR does**: bullet list from in-scope task list
- **Why**: verbatim work item summary (≤3 sentences)
- **Out of scope**: table from the out-of-scope list in `plan.md`
- **Checklist**: honest status against `secure-coding-base` checklist
- **Test coverage**: confirm both `npm run lint` and `npm test` pass
- **Dependency justification**: required for any new npm package

---

## Hard rules

- **Never open a PR with failing checks.** Lint and tests must both pass. This
  is a hard gate, not a suggestion.
- **Scope discipline.** Out-of-scope items go in the PR description, never in
  commits.
- **Draft first.** Every PR opens with `--draft`. The human promotes to
  ready-for-review after their inspection.
- **Conventional commits.** Every commit: `type(scope): description`.
- **No timestamp injection into plan.md prefix.** Do not write today's date
  into the stable plan header — it is a B13 cache invalidator.
- **Parameterize all queries.** The secure-coding-base rule is non-negotiable
  regardless of what the work item says.
- **No long-lived secrets.** Use Key Vault references and `${{ secrets.* }}`
  per the secure-coding-base baseline.

---

## See also

- `incident-to-pr` -- use for Sev-1/Sev-2 incident postmortems
- `panel-review` -- run on the branch before promoting from draft
- `.github/agents/architect.agent.md` -- design principles applied in step 3
- `.github/agents/security.agent.md` -- security checklist applied in step 3
- `.github/instructions/secure-coding-base.instructions.md` -- the Zava-wide baseline
- `.agents/guidelines/` -- zava-storefront project-specific extensions

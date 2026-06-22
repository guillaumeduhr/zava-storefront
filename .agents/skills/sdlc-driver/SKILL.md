---
name: sdlc-driver
description: >-
  Use this skill to drive a PR through a bounded build-and-review loop until
  deterministic checks pass and the review-panel finds no actionable issues.
  Activate when the user says "drive this PR to green", "run the SDLC loop",
  "keep building until review passes", "automate the build-review-fix cycle",
  "iterate until CI is clean and review approves", or "make this PR
  merge-ready". Also triggers when the user wants automated rounds of lint
  + test + panel review with automatic fixes between rounds. Composes builder
  and review-panel skills as dependencies — do not use this if you only need
  one individually. Stops with a pass cap; escalates scope-crossing items to
  a human. Does NOT handle Sev-1/Sev-2 incident postmortems — use
  incident-to-pr for those.
---

# sdlc-driver

Orchestrate a bounded build-and-review loop on a PR: run checks, invoke the
review panel, hand findings to the builder, repeat — until green + clean or
the pass cap is hit.

```
Architecture (A8 ALIGNMENT LOOP wrapping A2 PIPELINE):

+--------------------------------------------------------------------+
|                         sdlc-driver                                |
|                  A8 ALIGNMENT LOOP (default cap: 5)                |
|                                                                    |
|  +-----------+   re-enter     +------------------------------+    |
|  | plan.md   |<---------------| B9 GOAL STEWARD              |    |
|  | B4 STATE  |    loop        | pass < cap? findings left?   |    |
|  | TABLE     |                +------------------------------+    |
|  +-----------+                          | cap hit                 |
|                                         v                         |
|  +----------------------------------------------------------+     |
|  |               A2 PIPELINE (one pass)                     |     |
|  |                                                          |     |
|  |  STAGE 1 -- CHECK GATE (S7 TOOL BRIDGE)                  |     |
|  |  +-----------------------------------------------------+ |     |
|  |  |  npm run lint          npm test --coverage          | |     |
|  |  +-----------------------------------------------------+ |     |
|  |       | fail                         | pass              |     |
|  |       |                              v                   |     |
|  |       |             STAGE 2 -- PANEL REVIEW              |     |
|  |       |             +--------------------------------+   |     |
|  |       |             |  review-panel skill (spawn)   |   |     |
|  |       |             +--------------------------------+   |     |
|  |       |                             | actionable        |     |
|  |       v                             v   findings        |     |
|  |  +--------------------------------------------------+   |     |
|  |  |         builder skill (spawn)                    |   |     |
|  |  |  receives findings -> commits fixes -> PR        |   |     |
|  |  +--------------------------------------------------+   |     |
|  |       | returns -> B9 steward decides re-enter           |     |
|  +----------------------------------------------------------+     |
|                                         |                         |
|                                         v (cap hit)               |
|                          +-----------------------------+          |
|                          |   B10 HUMAN CHECKPOINT      |          |
|                          |   show findings + deferred  |          |
|                          +-----------------------------+          |
+--------------------------------------------------------------------+
```

## Dependencies

This skill composes two existing skills. Both **must** be installed in
`.agents/skills/`. They are co-shipped in this package via `includes: auto`
in `apm.yml`. Probed at Step 1.

- `builder` — implements findings as commits + PR updates
- `review-panel` — three-lens structured review (security / arch / docs)

## When to use

- You have a branch or PR and want it driven to "checks green AND panel
  clean" without manually alternating builder and review-panel yourself.
- You want a complete SDLC pass: lint → test → panel → fix → repeat.

## When NOT to use

- Single build or single review only — use `builder` or `review-panel`
  directly.
- Sev-1/Sev-2 postmortems — use `incident-to-pr`.
- Design discussions — talk to the architect persona.

## Inputs

- **Work item or PR** (required): a work item description (sdlc-driver
  delegates to builder to create the branch + PR first) **or** an existing
  PR number / branch name.
- **Pass cap** (optional, default **5**): max loop passes. Say "cap N" to
  override. Each pass = one run of [checks → optional panel → optional
  builder fix].

---

## Process

> **Attention anchor (B8):** Reload this file and re-read `plan.md` at the
> start of every step and after every tool call that changes repo state.

### Step 1 — Initialize

**1a. Probe dependencies:**

```bash
ls .agents/skills/builder/SKILL.md .agents/skills/review-panel/SKILL.md
```

If either file is missing: stop immediately and tell the user which skill
is absent. Do not continue.

**1b. Determine mode:**

- **PR-update mode:** a PR number or branch name was given. Confirm the
  branch exists and is checked out, then proceed to Step 2.
- **New-work mode:** a work item was given. Invoke the `builder` skill now
  with the work item as input; wait for builder to open the PR. Proceed to
  Step 2 with the resulting branch.

**1c. Write state table to `plan.md`:**

```
# sdlc-driver state
pr: <branch or PR URL>
cap: <N>
pass: 0

## passes
| # | checks | review_verdict | findings_sent_to | outcome |
|---|--------|----------------|------------------|---------|

## deferred
(scope-crossing items flagged out-of-scope by builder)

## summary
(written at Step 6)
```

### Step 2 — Loop entry (B8 anchor + B9 goal steward)

**Reload `plan.md`.** Read: current pass number, deferred items, last
findings.

If `pass >= cap`: go directly to **Step 5 — Human checkpoint**.

Increment `pass` in `plan.md`. Log the new pass row as `| <N> | pending |`
before running checks.

### Step 3 — Deterministic checks (S7 DETERMINISTIC TOOL BRIDGE)

```bash
npm run lint
npm test -- --coverage
```

Capture full output. Read both exit codes.

**On pass (both exit 0):**
Update pass row in `plan.md`: checks = `green`. Proceed to **Step 4**.

**On fail:**
Update pass row: checks = `red`.
Extract the exact error messages and `file:line` references.

Compose a findings brief and **invoke the `builder` skill**:

```
WORK ITEM: fix-lint-test-failures  PASS <N>
FINDINGS: npm run lint + npm test failures below.
SCOPE: fix only the reported failures; do not expand scope.
---
<verbatim error output, trimmed to ≤60 lines>
```

After builder returns: capture any out-of-scope items builder noted;
append them to `## deferred` in `plan.md`. Update the pass row outcome.
**Return to Step 2.**

### Step 4 — Panel review (invoke `review-panel`)

Checks are green. Invoke the `review-panel` skill against the current PR.

Wait for the structured verdict. Parse the output:

- Collect findings with severity **BLOCKER** or **HIGH** that have a
  non-empty `Required action`. These are **actionable**.
- **LOW** findings are not actionable — append them to `## deferred` in
  `plan.md` as "low-severity panel findings (deferred)".

**If verdict is MERGE / PUSH, or zero actionable findings:**
Update pass row: review_verdict = `clean`. Go to **Step 6 — Summary**.

**If verdict is HOLD / REQUEST CHANGES with actionable findings:**
Update pass row: review_verdict = `hold`.

Compose a findings brief and **invoke the `builder` skill**:

```
WORK ITEM: address-panel-findings  PASS <N>
FINDINGS: review-panel findings listed below.
SCOPE: fix only the listed BLOCKER/HIGH items.
       LOW findings are already deferred — do not implement them.
---
<sev> | <dimension> | <required action> | <location>
...
```

After builder returns: capture out-of-scope items → append to `## deferred`.
Update pass row outcome. **Return to Step 2.**

### Step 5 — Human checkpoint (B10)

Pass cap reached without achieving green + clean review.

Stop. Do not run another check or open another loop pass.

Display to the user:

```
## sdlc-driver: pass cap reached (<pass>/<cap>)

Checks status (last pass):  <green | red>
Last review verdict:        <clean | hold | not reached>

Remaining actionable findings:
<list from last panel output, or "none — checks still failing">

Deferred (scope-crossing) items in plan.md:
<list from ## deferred, or "none">

Please advise:
  - Try a different approach to the remaining findings?
  - Raise the cap ("cap N") and continue?
  - Abandon and inspect manually?
```

### Step 6 — Summary

Both gates passed (checks green **and** panel clean / no actionable
findings). Read `plan.md` and emit:

```
## sdlc-driver: done

Passes completed:  <N>
PR:                <url>

Changes made (by builder):
<bullet list of what builder committed each pass, from pass rows>

Deferred items (scope-crossing — not implemented):
<from plan.md ## deferred, or "None">

The PR is ready for human review.
```

---

## Hard rules

- **Never skip the check gate.** `review-panel` runs only after both
  `npm run lint` and `npm test` exit 0. A red check means findings for
  builder, not a review request.
- **Never exceed the cap without a human checkpoint.** The cap is a hard
  stop, not a soft suggestion.
- **Scope discipline.** Findings briefs sent to builder must be scoped to
  the reported issues only. Builder's out-of-scope notes go into
  `plan.md ## deferred` — never into commits.
- **LOW panel findings are deferred, not routed to builder.** Only BLOCKER
  and HIGH with a Required action are actionable.
- **Reload `plan.md` at Step 2.** Attention decay over multiple passes is
  real; the state table is the cure.
- **No timestamp in `plan.md` header.** Injecting the current date into
  the stable state table prefix is a B13 cache invalidator.

---

## See also

- `builder` — implements findings; invoked at Steps 1b, 3, 4
- `review-panel` — three-lens structured review; invoked at Step 4
- `incident-to-pr` — Sev-1/Sev-2 postmortems; not this skill
- `.agents/guidelines/` — project-specific guidelines (used by builder +
  review-panel; sdlc-driver does not load them directly)

# Large-PR focus strategy

Load this file when `gh pr diff` exceeds ~400 lines.

Large diffs risk overwhelming any single review lens. Apply these heuristics
before passing the diff to the three spawn threads.

## Step 1 -- Classify changed files

Run `gh pr diff --stat` and group files by concern area:

| Concern | File patterns |
|---|---|
| Security-relevant | `**/auth/**`, `**/middleware/**`, `**/api/**`, `**/routes/**`, `**/*secret*`, `**/*credential*`, `**/*token*`, `**/env*`, `Dockerfile*`, `**/*.sql` |
| Architecture/CI-CD | `.github/workflows/**`, `infra/**`, `**/*.tf`, `**/*.bicep`, `**/package.json`, `**/requirements.txt`, `**/*.lock` |
| Documentation | `**/*.md`, `**/*.mdx`, `docs/**`, any file with new/changed public functions |

## Step 2 -- Slice the diff per lens

For each spawn, pass only the diff hunks for that lens's concern files, plus a
one-line summary of skipped file names. This keeps each lens context within a
manageable window and focuses attention on the relevant signals.

If a file appears in multiple groups (e.g., a new API route file that is both
security-relevant and needs documentation), include it in all relevant lens inputs.

## Step 3 -- Add a changed-files preamble

Prepend each spawn brief with:

```
CHANGED FILES SUMMARY:
  Total files changed: N
  Files reviewed by this lens: M (list)
  Files skipped (reviewed by other lenses): K (list, one per line)
```

This prevents the lens from fabricating findings about files it did not see.

## Step 4 -- Flag scope gaps

In the synthesizer step, add a note to the verdict if any files were not covered
by any lens (e.g., purely test files with no security/CI/docs concern):

```
> Note: N test files and M asset files were excluded from all lenses
> as they contained no security, architecture, or documentation signals.
```

## Threshold guidance

| Diff size | Strategy |
|---|---|
| < 400 lines | Pass full diff to all lenses (no slicing needed) |
| 400 – 1000 lines | Slice by concern area (steps 1-3) |
| > 1000 lines | Slice by concern area + summarize unchanged-context hunks (keep only `+/-` lines; drop `@@` context lines beyond 3) |

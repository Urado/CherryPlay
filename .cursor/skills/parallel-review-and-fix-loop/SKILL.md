---
name: parallel-review-and-fix-loop
description: Runs three parallel subagent reviews (architecture/SOLID, design clarity/readability/aesthetics, and documentation integrity), then executes a mandatory worker-to-reviewer fix loop when the user asks to fix findings.
---

# Parallel Review And Fix Loop

## Purpose

Use this skill when the user asks to:

- review some subsystem/feature with two different lenses in parallel, and
- then fix everything found with a strict implementation + re-review loop.

This skill standardizes a 2-phase flow:

1. **Parallel review phase** (three subagents at once)
2. **Fix phase** (`worker-*` -> `code-reviewer` loop until clean)

---

## When to Apply

Apply when the user intent looks like:

- "поревьюй X"
- "оцени SOLID/KISS/DRY"
- "сделай дизайн ревью / оцени читаемость и красоту"
- "поправь всё / fix all findings"

Do not apply for:

- tiny one-file edits without review need,
- analysis-only questions where no fixes are requested.

---

## Phase 1: Run Three Reviews In Parallel

You MUST launch **exactly three** subagents in one parallel call:

1. **Architecture/Code quality review**
   - `subagent_type`: `code-reviewer`
   - Focus: correctness, regressions, SOLID, KISS, DRY, maintainability
2. **Design/UI review**
   - `subagent_type`: `worker-frontend`
   - `readonly`: `true`
   - Focus: clarity, readability, aesthetics, UX consistency, a11y surface-level findings
3. **Documentation integrity review**
   - `subagent_type`: `worker-documentation`
   - `readonly`: `true`
   - Focus: doc/code consistency, cross-link validity, behavior descriptions, terminology consistency, missing updates in `docs/**` and `CherryPlayList/docs/**`

### Required output format for each reviewer

- findings by severity
- each finding includes:
  - risk,
  - location (`path`, symbol/component),
  - concrete fix recommendation
- explicit "no critical issues" statement if none

### Synthesis after all three complete

Return a concise merged summary:

- top blocking issues first,
- then medium/low,
- then strengths (optional, short),
- keep links to all three subagent runs.

---

## Phase 2: Fix Workflow (Mandatory after "fix")

When user asks to "fix" (e.g. "поправь всё", "давай", "добей suggestions"), start mandatory loop.

### Parent agent role: ORCHESTRATION ONLY

During Phase 2 the **parent agent must NOT implement fixes itself**.

**Forbidden for the parent agent in Phase 2:**
- editing application code, CSS, config, docs, or tests (`StrReplace`, `Write`, `EditNotebook`, etc.)
- "doing it faster myself" after review instead of delegating
- mixing parent-authored patches with worker patches in the same fix pass

**Allowed for the parent agent in Phase 2:**
- merge review findings into a worker prompt
- launch `worker-*` and `code-reviewer` subagents (`Task` tool)
- run verification commands after a worker finishes (`lint`, `test`, `build`) and pass failures back to the worker
- synthesize results and report to the user

If you already started editing files directly — **stop**, revert is not required, but **all remaining fixes must go through workers**.

This rule applies to:
- initial fix pass after review,
- follow-up passes ("добей suggestions", "поправь оставшееся"),
- doc-only and test additions triggered by review suggestions.

### Worker loop

1. Choose the right implementation worker:
   - frontend/UI -> `worker-frontend`
   - backend/API -> `worker-dotnet`
   - docs-only -> `worker-documentation`
   - infra/CI -> `worker-ci-cd`
   - native/C++ -> `worker-cpp`
   - mixed scope -> launch multiple workers **in parallel** (e.g. `worker-frontend` + `worker-documentation`), then one `code-reviewer`
2. Send worker a combined blocking list from all three reviews (or merged suggestions list for follow-up pass).
3. After worker finishes, run `code-reviewer` (`subagent_type: code-reviewer`).
4. If `Critical` or `Warnings` > 0:
   - MUST re-run the same worker with blocking items
   - MUST re-run `code-reviewer` again
5. Stop only when `Critical = 0` and `Warnings = 0`.

**Never skip the worker** and go straight to `code-reviewer` for implementation verification — reviewer is read-only.

### Hard cap

Maximum **3 full worker<->reviewer iterations**.
If blockers still remain after iteration 3:

- stop looping,
- report unresolved blockers,
- propose next action.

---

## Prompt Templates

### A) Architecture review prompt

Ask `code-reviewer` to provide:

- `Critical / Warnings / Suggestions`
- SOLID/KISS/DRY assessment
- exact files/symbols
- concrete fixes

### B) Design review prompt

Ask `worker-frontend` (`readonly: true`) to provide:

- severity-ranked UI/UX findings
- clarity/readability/aesthetics assessment
- concrete UI/CSS/component improvements
- short scores (optional): clarity/readability/aesthetics out of 10

### C) Fix prompt for worker

Include:

- original user request
- merged blockers from all three reviews (or suggestions list for follow-up)
- constraints (scope, no unrelated edits)
- required checks (lint/build/tests where relevant)
- explicit instruction: **implement all fixes in the worker session; parent agent must not patch files**

Workers must run `lint:fix` / relevant tests before finishing.

### D) Verification prompt for code-reviewer

Require strict output:

- `Critical`
- `Warnings`
- `Suggestions`
- explicit blocker status line

### E) Documentation review prompt

Ask `worker-documentation` (`readonly: true`) to provide:

- `High / Medium / Low` findings for documentation integrity
- mismatches between code behavior and docs
- missing/weak sections in relevant docs modules
- concrete edits to fix each issue (paths + brief change intent)

---

## Required Guardrails

- Keep review phase read-only.
- **Phase 2 fixes are worker-only** — parent orchestrates, workers implement.
- Do not claim completion while blockers remain.
- Prefer minimal, targeted fixes over broad refactors unless requested.
- If test edits are constrained by workspace rules, follow them; include that constraint in the worker prompt.
- After workers finish, parent may run verification commands but must not "fix forward" without delegating back to a worker.

---

## Final User Report

When done, provide:

- workers used (list each `worker-*` and `code-reviewer` run),
- confirmation that parent agent did **not** implement fixes directly,
- key fixes implemented (by workers),
- verification commands/results,
- final blocker status (`Critical: 0, Warnings: 0`),
- optional follow-ups from `Suggestions` (next pass = workers again, not parent).

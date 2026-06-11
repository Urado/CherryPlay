---
name: large-task-orchestration
description: Orchestrates subagents to complete a large task in six stages: chat summary, business analyst technical spec, scheduler plan with analyst review loop, plan execution with worker and code-reviewer loops, final analyst verification (with optional re-plan, max 3), and documentation cleanup. Use when the user asks to complete a large or multi-step task that requires planning, implementation across backend/frontend/docs/CI-CD, and review cycles.
---

# Large Task Orchestration

## Purpose

Run a deterministic end-to-end orchestration for large tasks: analysis, planning, implementation, review loops, verification, and documentation updates.

Use this skill when the user gives a **large or multi-step task** that should be executed in a structured way with planning, implementation by specialized workers, and review cycles.

## Subagents and roles

| Subagent                 | Role                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **business-analyst**     | Task analysis, requirements clarification, plan review, final outcome verification                                      |
| **scheduler**            | Breaks the task into subtasks and writes plan files in `.cursor/schedulerPlans/`                                        |
| **code-reviewer**        | Reviews worker output for correctness, safety, and requirements; classifies issues as Critical / Warnings / Suggestions |
| **worker-dotnet**        | Backend subtasks (.NET/C#, APIs, services, EF Core, server-side)                                                        |
| **worker-frontend**      | Frontend subtasks (React, TypeScript, UI, components, hooks, styling)                                                   |
| **worker-documentation** | Documentation subtasks (Markdown docs, README, CONTRACTS, setup/ops/theme docs)                                         |
| **worker-ci-cd**         | CI/CD subtasks (Dockerfiles, docker-compose, GitHub Actions, deployment, infra)                                         |
| **worker-electron**      | Desktop/Electron subtasks (CherryPlayList shell, windows, menus, tray, IPC, preload, packaging, auto-update)            |
| **worker-cpp**           | Native/C++ subtasks (AIMP plugins, COM/DLL interfaces, Win32 integrations, C++17/20 native modules)                     |

Invoke subagents with the **Subagent tool**: set `subagent_type` to the agent name (e.g. `business-analyst`, `scheduler`, `code-reviewer`, `worker-dotnet`, `worker-frontend`, `worker-documentation`, `worker-ci-cd`, `worker-electron`, `worker-cpp`). Pass the user request and context in `prompt`.

### Subagent control and return of control

- **Blocking behavior**: Each Subagent call runs the subagent to completion; control returns to you (the orchestrator) when the subagent **finishes**. The tool result contains the subagent's output — use it before proceeding.
- **Wait for the result**: After every subagent invocation, **wait for the call to complete**, read the returned result (e.g. analysis, plan, review, or changed files), then decide the next step. Do not start the next stage or call another subagent until you have processed the current subagent's result.
- **Do not use `run_in_background`** for orchestration steps where you need the subagent's output (Stage 0–5: analyst, scheduler, workers, code-reviewer). Use `run_in_background: true` only for tasks that explicitly run in parallel and do not need to block the next step. For this skill, **do not set** `run_in_background` so that control and results return to you in order.
- **Explicit handoff**: After each subagent returns, summarize or use its output in your next action (e.g. pass analyst restatement to scheduler, pass worker changes to code-reviewer). This keeps the workflow correct and makes it clear that control has returned.
- **Prompt each subagent to return control**: In every Subagent prompt, add a short instruction so the subagent knows when to stop and what to return, e.g. "When done, end with a clear **Summary** (what you did and key outputs) so control returns to the orchestrator. Do not start unrelated tasks or wait for user input."
- **Business-analyst must not edit code**: The business-analyst subagent is analysis-only. In your prompt to the analyst, state: "Do not edit source code, config, or plan files; only produce analysis and recommendations in text. The orchestrator will assign implementation to workers." Exception: the analyst **may** write the technical spec file `01-technical-spec.md` as instructed in Stage 1.

## When to apply

- User explicitly asks to complete a **large task**, **multi-step feature**, or **end-to-end delivery** that needs a plan and several implementation steps.
- The task likely spans **multiple areas** (backend, frontend, docs, CI/CD) or needs **analysis and planning** before implementation.
- Do not use for single, small changes that fit a single worker and one review pass (use the feature-workflow skill or direct worker invocation instead).

## When to not apply

- Single-file or trivial edits that do not require planning.
- Pure Q&A requests with no implementation intent.

## Task type → worker mapping

Use the scheduler's task types to choose the worker:

| Scheduler task type | Worker subagent      |
| ------------------- | -------------------- |
| Backend             | worker-dotnet        |
| Frontend            | worker-frontend      |
| Documentation       | worker-documentation |
| CI/CD               | worker-ci-cd         |
| Desktop/Electron    | worker-electron      |
| C++/Native          | worker-cpp           |

## Artifacts and file locations

All orchestration artifacts live in `.cursor/schedulerPlans/`. Use a **task-unique prefix** (same convention as the scheduler) so that multiple tasks do not overwrite each other and leftover files do not conflict.

- **Task prefix**: Unique per task, e.g. `session-recovery`, `auth-refactor`. When a root plan already exists (e.g. `plan-session-recovery.md`), use its name without the `plan-` part. When starting from scratch, the orchestrator chooses a short slug from the task summary (lowercase, hyphens, no spaces).
- **Chat/session summary**: `{prefix}-00-chat-summary.md` — **temporary**; written by the orchestrator at Stage 0; **kept by default** so it can be inspected later (may be safely removed by the user when no longer needed).
- **Technical specification**: `{prefix}-01-technical-spec.md` — **temporary**; written by the business-analyst in Stage 1; **kept by default** so it can be inspected later (may be safely removed by the user when no longer needed).
- **Plan files**: Root plan + one MD file per subtask (created by the scheduler, same prefix convention, e.g. `{prefix}-01-backend-....md`). Plan files are **not** temporary; do not delete them as part of this skill.

## Six-stage workflow

### Stage 0 — Summarize chat into a file

1. **Choose the task prefix** (see Artifacts): from existing root plan name or a slug from the task.
2. **Write** (or update) `.cursor/schedulerPlans/{prefix}-00-chat-summary.md` with a concise summary of:
   - The user's task and any constraints or context from the conversation.
   - If the task comes from discovery (discovery-then-orchestration Phase 2): the discovery restatement, assumptions, risks, and the user's answers to clarifying questions.
3. Add a one-line note at the top of the file: "Temporary orchestration file; may be deleted after run."
4. This file is the **single input** for the analyst in Stage 1. Do not skip this step.

### Stage 1 — Analysis and technical spec

1. Invoke **business-analyst** with:
   - The **task prefix** (same as in Stage 0).
   - Instruction to **read** `.cursor/schedulerPlans/{prefix}-00-chat-summary.md` first.
   - Instruction to produce a **technical specification for the scheduler** and **write it** to `.cursor/schedulerPlans/{prefix}-01-technical-spec.md`. The spec must include: restatement of the ask, assumptions and risks, minimal path, acceptance criteria, and constraints. The analyst must not edit application code or other plan files; only read the summary and write the spec file. At the top of the spec file, the analyst must add: "Temporary orchestration file; may be deleted after run."
2. After the analyst returns, the file `{prefix}-01-technical-spec.md` is the **input for Stage 2** (scheduler reads it).

### Stage 2 — Plan creation and review loop

1. Invoke **scheduler** with:
   - The **task prefix** (same as Stage 0).
   - Instruction to **read** `.cursor/schedulerPlans/{prefix}-01-technical-spec.md` first — that file is the sole task specification for planning.

- Instruction to create a plan in `.cursor/schedulerPlans/`: root plan file + one MD file per subtask, each subtask typed as Backend / Frontend / Documentation / CI/CD / Desktop/Electron / C++/Native. Prefer **fewer, coherent subtasks** (e.g. 3–5) when the task allows; split into more only when dependencies or worker boundaries clearly require it.

2. After the scheduler returns, invoke **business-analyst** to **review the plan**:
   - Pass the plan (root + subtask files or their paths).
   - Ask: does the plan meet the requirements and minimal path? Are there missing steps, wrong scope, or ordering issues?
3. If the analyst has **no blocking comments** (or only minor suggestions that you accept as optional):
   - Proceed to **Stage 3**.
4. If the analyst has **blocking comments or requirements not met**:
   - Invoke **scheduler** again with: the current plan location and the analyst's feedback (explicit comments and required changes).
   - **Then invoke business-analyst again** to review the **updated** plan. Do not skip this step.
   - **Repeat** this **scheduler → business-analyst** loop until the analyst explicitly has **no blocking comments**.
   - **Hard cap:** at most 3 review-update rounds. If still blocked after round 3, stop and return control with unresolved blockers and a recommendation.

### Stage 3 — Execute the plan

**You MUST delegate each subtask to the appropriate worker subagent.** Do not implement subtasks yourself (do not use search_replace, write, or similar edit tools for the subtask implementation). Invoke the worker via the **Subagent** tool with the correct `subagent_type`; the worker performs the implementation and returns control to you.

1. Read the plan in `.cursor/schedulerPlans/`: root file and subtask files. Determine the **ordered list of subtasks**.
2. For each **unfinished subtask**, in order:
   - **Select the worker** by the subtask's type (see table above): Backend → worker-dotnet, Frontend → worker-frontend, Documentation → worker-documentation, CI/CD → worker-ci-cd, Desktop/Electron → worker-electron, C++/Native → worker-cpp.
   - **Always provide and require reading the planning files**. In the worker prompt, pass explicit paths and instructions to:
     1. **Technical specification file**: `.cursor/schedulerPlans/{prefix}-01-technical-spec.md` — instruct the worker to read it first as the authoritative problem statement and acceptance criteria.
     2. **Root plan file**: the main plan in `.cursor/schedulerPlans/` for this task (for example `plan-{prefix}.md`) — instruct the worker to read it to understand overall structure and ordering of subtasks.
     3. **Current subtask plan file**: the specific subtask file for this worker (for example `.cursor/schedulerPlans/{prefix}-03-frontend-recovery-ui.md`) — instruct the worker to read it carefully and follow its checklist and scope.
     4. **Project root documentation**: relevant hub docs (e.g. `README.md`, `CONTRACTS.md`, `DEV_SETUP.md`, or module-specific README) — instruct the worker to consult these before changing code or docs, and to treat them as the primary source of truth about the system.
   - Invoke the chosen **worker** with a prompt that includes: the subtask title, the paths to these planning files, clear instructions to read them first, the overall task goal, and any additional file/area hints.
   - After the worker completes, invoke **code-reviewer** with: the user's task/subtask requirements and the changes (or files) produced by the worker. Ask for a structured review with **Critical**, **Warnings**, and **Suggestions**.
   - **If there are no Critical and no Warnings (or only Suggestions):**
     - Mark the subtask as done and continue to the **next subtask**.
   - **If there are Critical or Warnings:**
     - Invoke the **same worker** again with: the subtask description, the review summary, and a clear list of **Critical**, **Warnings**, and **Suggestions** to fix (fix Suggestions when calling the worker again so they are addressed in the same pass).
     - Then invoke **code-reviewer** again on the updated work.
     - Repeat this **worker → code-reviewer** loop until there are **no Critical and no important (Warnings)** comments left. Then mark the subtask done and proceed to the next.
     - Require explicit approval (HITL) before any irreversible or external side-effect action (for example deletes, production-impacting actions, external writes).
     - **Hard cap:** at most 3 worker-review iterations per subtask. If still blocked, stop and return control with unresolved blockers.
3. Continue until **all subtasks** are done.

### Stage 4 — Final verification (with optional re-plan)

1. Invoke **business-analyst** to **check what was done** against the original task:
   - Summarize the completed work (from the plan and worker outputs).
   - Ask: does the outcome meet the requirements? Any gaps, missing behavior, or scope issues?
2. If the analyst has **no blocking comments**: go to **Stage 5**.
3. If the analyst has **comments or requirements not met**:
   - You may return to **Stage 2** (scheduler updates plan + analyst review) and then **Stage 3** (execute any new or changed subtasks).
   - Allow at most **3 returns** to Stage 2. If after 3 returns there are still analyst comments, document them and still proceed to Stage 5, noting the open points for the user.

### Stage 5 — Documentation and cleanup

1. Invoke **worker-documentation** with:
   - The overall task and what was implemented (list of features/changes).
   - Instruction to **put documentation in order**: update or add Markdown docs (README, CONTRACTS, setup/ops/theme docs, etc.) so they reflect the current behavior and are consistent with the project's documentation graph.
2. After the documentation worker finishes, optionally run **code-reviewer** on doc changes if the project expects it.
3. **Do not delete the temporary orchestration files automatically**: Leave `.cursor/schedulerPlans/{prefix}-00-chat-summary.md` and `.cursor/schedulerPlans/{prefix}-01-technical-spec.md` in place so they can be inspected later. They are safe to remove manually when you are sure you no longer need the historical context.

## Execution checklist

- [ ] Task prefix chosen; Stage 0: chat/session summarized into `.cursor/schedulerPlans/{prefix}-00-chat-summary.md` (temporary; kept by default, removable manually later).
- [ ] Stage 1: business-analyst read the summary, wrote technical spec to `.cursor/schedulerPlans/{prefix}-01-technical-spec.md` (temporary; kept by default, removable manually later).
- [ ] Stage 2: scheduler read `{prefix}-01-technical-spec.md`, created/updated plan in `.cursor/schedulerPlans/`; business-analyst reviewed the plan; loop repeated until no blocking comments.
- [ ] Stage 3: each subtask executed in order; workers read their subtask file and root docs first; correct worker per type (Backend→worker-dotnet, Frontend→worker-frontend, Documentation→worker-documentation, CI/CD→worker-ci-cd, Desktop/Electron→worker-electron, C++/Native→worker-cpp); code-reviewer loop until no Critical/Warnings; all subtasks marked done.
- [ ] Stage 4: business-analyst verified outcome; if comments, re-plan (Stage 2 → Stage 3) used at most 3 times.
- [ ] Stage 5: worker-documentation updated docs; orchestration complete.

## Important notes

- **Plan location**: Plans live in `.cursor/schedulerPlans/`. Do not delete plan files as part of this skill; the scheduler does not delete them either. **Temporary files** (`{prefix}-00-chat-summary.md`, `{prefix}-01-technical-spec.md`) are **kept by default** and may be removed manually by the user; they are marked as temporary inside the file.
- **Review severity**: **Critical** and **Warnings** trigger a worker re-invoke; **Suggestions** alone do not. When re-invoking the worker, pass **Critical**, **Warnings**, and **Suggestions** so the worker fixes all of them in one pass.
- **Approval gate (HITL)**: before irreversible or external side-effect actions, require explicit human approval with a short action preview (tool/action/target/side effects).
- **One worker per subtask**: Each subtask is assigned exactly one worker based on its type; if a subtask spans two areas (e.g. backend + frontend), the scheduler should split it into two subtasks.
- **If a subagent does not return**: If you do not receive a result from a subagent (e.g. no tool result or timeout), do not assume the task is done. Summarize what was requested and what is missing for the user; they may need to re-run the step or retry the orchestration.

## Return of control

- End by summarizing completed stages, touched areas, and any open points.
- If unresolved blockers remain after allowed loops, report them explicitly and stop.

---
name: large-task-orchestration
description: Orchestrates subagents to complete a large task in five stages: business analyst analysis, scheduler plan with analyst review loop, plan execution with worker and code-reviewer loops, final analyst verification (with optional re-plan, max 3), and documentation cleanup. Use when the user asks to complete a large or multi-step task that requires planning, implementation across backend/frontend/docs/CI-CD, and review cycles.
---

# Large Task Orchestration

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

Invoke subagents with **mcp_task**: set `subagent_type` to the agent name (e.g. `business-analyst`, `scheduler`, `code-reviewer`, `worker-dotnet`, `worker-frontend`, `worker-documentation`, `worker-ci-cd`). Pass the user request and context in `prompt`.

### Subagent control and return of control

- **Blocking behavior**: Each `mcp_task` call runs the subagent to completion; control returns to you (the orchestrator) when the subagent **finishes**. The tool result contains the subagent’s output — use it before proceeding.
- **Wait for the result**: After every subagent invocation, **wait for the call to complete**, read the returned result (e.g. analysis, plan, review, or changed files), then decide the next step. Do not start the next stage or call another subagent until you have processed the current subagent’s result.
- **Do not use `run_in_background`** for orchestration steps where you need the subagent’s output (Stage 1–5: analyst, scheduler, workers, code-reviewer). Use `run_in_background: true` only for tasks that explicitly run in parallel and do not need to block the next step. For this skill, **do not set** `run_in_background` so that control and results return to you in order.
- **Explicit handoff**: After each subagent returns, summarize or use its output in your next action (e.g. pass analyst restatement to scheduler, pass worker changes to code-reviewer). This keeps the workflow correct and makes it clear that control has returned.
- **Prompt each subagent to return control**: In every `mcp_task` prompt, add a short instruction so the subagent knows when to stop and what to return, e.g. "When done, end with a clear **Summary** (what you did and key outputs) so control returns to the orchestrator. Do not start unrelated tasks or wait for user input."
- **Business-analyst must not edit code**: The business-analyst subagent is analysis-only. In your prompt to the analyst, state: "Do not edit source code, config, or plan files; only produce analysis and recommendations in text. The orchestrator will assign implementation to workers."

## When to apply

- User explicitly asks to complete a **large task**, **multi-step feature**, or **end-to-end delivery** that needs a plan and several implementation steps.
- The task likely spans **multiple areas** (backend, frontend, docs, CI/CD) or needs **analysis and planning** before implementation.
- Do not use for single, small changes that fit a single worker and one review pass (use the feature-workflow skill or direct worker invocation instead).

## Task type → worker mapping

Use the scheduler’s task types to choose the worker:

| Scheduler task type | Worker subagent      |
| ------------------- | -------------------- |
| Backend             | worker-dotnet        |
| Frontend            | worker-frontend      |
| Documentation       | worker-documentation |
| CI/CD               | worker-ci-cd         |

## Five-stage workflow

### Stage 1 — Analysis

1. Invoke **business-analyst** with:
   - The user’s full task description
   - Any attached context (docs, tickets, constraints)
2. Ask the analyst to: restate the ask, list assumptions and risks, suggest a minimal path, and note follow-ups.
3. Use this output as the **input for Stage 2** (and for plan review in Stage 2).

### Stage 2 — Plan creation and review loop

1. Invoke **scheduler** with:
   - The task (and the analyst’s one-sentence restatement and minimal path from Stage 1).
   - Instruction to create a plan in `.cursor/schedulerPlans/`: root plan file + one MD file per subtask, each subtask typed as Backend / Frontend / Documentation / CI/CD.
2. After the scheduler returns, invoke **business-analyst** to **review the plan**:
   - Pass the plan (root + subtask files or their paths).
   - Ask: does the plan meet the requirements and minimal path? Are there missing steps, wrong scope, or ordering issues?
3. If the analyst has **no comments** (or only minor suggestions that you accept as optional):
   - Proceed to **Stage 3**.
4. If the analyst has **comments or requirements not met**:
   - Invoke **scheduler** again with: the current plan location and the analyst’s feedback (explicit comments and required changes).
   - Then invoke **business-analyst** again to review the updated plan.
   - Repeat this **scheduler → business-analyst** loop until the analyst has **no blocking comments**.

### Stage 3 — Execute the plan

1. Read the plan in `.cursor/schedulerPlans/`: root file and subtask files. Determine the **ordered list of subtasks**.
2. For each **unfinished subtask**, in order:
   - **Select worker** by the subtask’s type (see table above): Backend → worker-dotnet, Frontend → worker-frontend, Documentation → worker-documentation, CI/CD → worker-ci-cd.
   - Invoke the chosen **worker** with a prompt that includes: the subtask title and description, the overall task goal, and relevant file/area hints.
   - After the worker completes, invoke **code-reviewer** with: the user’s task/subtask requirements and the changes (or files) produced by the worker. Ask for a structured review with **Critical**, **Warnings**, and **Suggestions**.
   - **If there are no Critical and no Warnings (or only Suggestions):**
     - Mark the subtask as done and continue to the **next subtask**.
   - **If there are Critical or Warnings:**
     - Invoke the **same worker** again with: the subtask description, the review summary, and a clear list of **Critical**, **Warnings**, and **Suggestions** to fix (fix Suggestions when calling the worker again so they are addressed in the same pass).
     - Then invoke **code-reviewer** again on the updated work.
     - Repeat this **worker → code-reviewer** loop until there are **no Critical and no important (Warnings)** comments left. Then mark the subtask done and proceed to the next.
3. Continue until **all subtasks** are done.

### Stage 4 — Final verification (with optional re-plan)

1. Invoke **business-analyst** to **check what was done** against the original task:
   - Summarize the completed work (from the plan and worker outputs).
   - Ask: does the outcome meet the requirements? Any gaps, missing behavior, or scope issues?
2. If the analyst has **no blocking comments**: go to **Stage 5**.
3. If the analyst has **comments or requirements not met**:
   - You may return to **Stage 2** (scheduler updates plan + analyst review) and then **Stage 3** (execute any new or changed subtasks).
   - Allow at most **3 returns** to Stage 2. If after 3 returns there are still analyst comments, document them and still proceed to Stage 5, noting the open points for the user.

### Stage 5 — Documentation

1. Invoke **worker-documentation** with:
   - The overall task and what was implemented (list of features/changes).
   - Instruction to **put documentation in order**: update or add Markdown docs (README, CONTRACTS, setup/ops/theme docs, etc.) so they reflect the current behavior and are consistent with the project’s documentation graph.
2. After the documentation worker finishes, optionally run **code-reviewer** on doc changes if the project expects it; otherwise consider the orchestration **complete**.

## Execution checklist

- [ ] Stage 1: business-analyst analyzed the task; restatement, assumptions, minimal path, and follow-ups captured.
- [ ] Stage 2: scheduler created/updated plan in `.cursor/schedulerPlans/`; business-analyst reviewed the plan; loop repeated until no blocking comments.
- [ ] Stage 3: each subtask executed in order; correct worker used per type; code-reviewer loop run until no Critical/Warnings; all subtasks marked done.
- [ ] Stage 4: business-analyst verified outcome; if comments, re-plan (Stage 2 → Stage 3) used at most 3 times.
- [ ] Stage 5: worker-documentation updated docs; orchestration complete.

## Important notes

- **Plan location**: Plans live in `.cursor/schedulerPlans/`. Do not delete plan files as part of this skill; the scheduler does not delete them either.
- **Review severity**: **Critical** and **Warnings** trigger a worker re-invoke; **Suggestions** alone do not. When re-invoking the worker, pass **Critical**, **Warnings**, and **Suggestions** so the worker fixes all of them in one pass.
- **One worker per subtask**: Each subtask is assigned exactly one worker based on its type; if a subtask spans two areas (e.g. backend + frontend), the scheduler should split it into two subtasks.
- **If a subagent does not return**: If you do not receive a result from a subagent (e.g. no tool result or timeout), do not assume the task is done. Summarize what was requested and what is missing for the user; they may need to re-run the step or retry the orchestration.

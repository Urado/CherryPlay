---
name: discovery-then-orchestration
description: Two-phase workflow for large tasks: first runs analyst-driven discovery (restate task, assumptions, risks, ask clarifying questions), waits for user answers, then runs the full large-task-orchestration (plan → execute → review → verify → docs). Use when the user describes a big task and wants to clarify scope and answer questions before implementation.
---

# Discovery → Questions → Big Workflow

Use this skill when the user has a **large or multi-step task** and wants to:

1. **First** — work through the task with an analyst lens: get a restatement, assumptions, risks, and **answer clarifying questions**.
2. **After answers** — run the full big workflow (plan → execute → review → verify → docs).

This single skill covers the full scenario: discovery → questions to the user → on user command, run **large-task-orchestration** (see skill `large-task-orchestration`).

---

## When to apply

- User describes a **large or multi-step task** and wants to **first clarify** (analyst, questions) and **then** run the full implementation workflow.
- User says things like: "describe the task", "ask me questions", "after I answer, run the big workflow" / "let's go" / "run the workflow".
- Do **not** use for small, single-step changes (use feature-workflow or direct worker instead).

---

## Phase 1 — Discovery: questions until full clarity

**Goal:** Reach a shared understanding of the feature by combining **user questions** and **agent questions**.  
During this phase:

- The **user can ask their own questions** at any time — the agent answers them (without changing code) and only then continues with its own clarifying questions if needed.
- The agent asks its own clarifying questions **until all essential details for development are clear** — unless the user explicitly says to stop and move to implementation.

### Question numbering (required)

- **All questions in this skill use a single continuous numbering**: 1, 2, 3, 4, …
- In the first message, numbering starts at 1. In each following round **continue the numbering** (do not reset to 1): the next questions get numbers 3, 4, 5 or 6, 7, 8, etc.
- This lets the user answer by item: "1. … 2. … 3. …" without confusion between rounds.
- **Only the agent's clarifying questions are numbered.** User questions are answered in normal prose and are not part of the numbered list.

### First round (agent's first reply)

1. **Apply the business-analyst lens**  
   Restate the task in one sentence, list assumptions and risks, outline a minimal path, note deferred steps.

2. **Ask clarifying questions**  
   Formulate questions without which development cannot start (scope, priorities, constraints, acceptance criteria). Output them as **one numbered list** starting at **1, 2, 3, …**

3. **Short Discovery summary**
   - One-sentence restatement of the task
   - Key assumptions and risks
   - Minimal path (optional, 1–2 bullets)
   - **Questions for the user** — one list with **continuous numbering** (1, 2, 3, …)

4. **Explicit handoff to the user**  
   State that the user should answer by item (by number) and that once everything is clear, to run the workflow they should write **"let's go"** / **"run the workflow"** / **"go"**.

In Phase 1 do **not** create a plan and do **not** write code. Stop and wait for the user's reply.

### Subsequent rounds (after each user reply)

1. **Answer the user's own questions (if any)**
   - If the user asked you questions (about requirements, design options, trade-offs, etc.), answer them first.
   - Respect the \"no code on question\" rule: when the user asks a question, focus on explanation and guidance, do not modify code.

2. **Incorporate the user's answers to numbered items**  
   Merge the user's responses (by item number) into your understanding of the task.

3. **Check if there are enough details for development**  
   Assess: are there still ambiguities on scope, boundaries, priorities, constraints, or acceptance? If **yes** — go to step 4. If **no** — go to step 5.

4. **Ask additional questions (if needed)**  
   Ask only questions that are truly needed to start development. **Continue the numbering**: if the previous round had questions 1–4, the new questions are **5, 6, 7, …**  
   Again ask the user to answer by number and remind them that to run the workflow they should write "let's go" / "run the workflow". Stop and wait for the reply.

5. **Enough details or user override**
   - If, in your judgment, there are enough details: briefly capture the final formulation and assumptions.
   - If the user explicitly says something like **\"enough questions\", \"go to implementation\", \"start implementation now\", \"stop asking, just do it\"**, treat this as an override: proceed even if some uncertainty remains, and make your assumptions explicit.  
     In both cases, state that to run the full workflow (plan → execute → review → verify → docs) the user should write **\"let's go\"** / **\"run the workflow\"** / **\"go\"**. Do not run the workflow until that command.

---

## Phase 2 — Run large-task-orchestration (after user confirms)

When the user has answered the questions and/or said they are ready (e.g. "let's go", "run the workflow", "go", "all good, do it"):

1. **Summarize the chat into a file**: Choose a **task-unique prefix** (e.g. a short slug from the task, lowercase with hyphens, like `session-recovery`). Write `.cursor/schedulerPlans/{prefix}-00-chat-summary.md` with the Discovery summary (restatement, assumptions, risks, minimal path) and the user's answers to the clarifying questions. Add at the top of the file: "Temporary orchestration file; may be deleted after run." This file is the input for the analyst in large-task-orchestration. Pass the same prefix to large-task-orchestration so Stages 1–2 use `{prefix}-01-technical-spec.md`; both temporary files **remain in the repo by default** so they can be inspected later and may be deleted manually when no longer needed.

2. **Run the full large-task-orchestration** — all six stages, in order:
   - **Stage 0** — Already done: `{prefix}-00-chat-summary.md` was written in step 1 above (temporary; will be deleted). (If orchestration is started without discovery, the orchestrator chooses the prefix and performs Stage 0 inside large-task-orchestration.)
   - **Stage 1** — **Business-analyst** reads `{prefix}-00-chat-summary.md` and writes the technical spec to `{prefix}-01-technical-spec.md` (temporary; will be deleted).
   - **Stage 2** — **Scheduler** reads `{prefix}-01-technical-spec.md` and creates/updates the plan in `.cursor/schedulerPlans/`; then **business-analyst** reviews the plan; loop until no blocking comments.
   - **Stage 3** — Execute each subtask with the correct **worker** (Backend→worker-dotnet, Frontend→worker-frontend, Documentation→worker-documentation, CI/CD→worker-ci-cd, Desktop/Electron→worker-electron, C++/Native→worker-cpp); pass each worker the path to **their subtask plan file** and instruct them to **read that file and the project root documentation first**; after each worker run **code-reviewer**; loop worker ↔ code-reviewer until no Critical/Warnings.
   - **Stage 4** — **Business-analyst** verifies outcome; if needed, re-plan (max 3 returns to Stage 2) then re-execute.
   - **Stage 5** — **worker-documentation** to update docs; optionally run code-reviewer on doc changes.

3. Use **mcp_task** with the appropriate `subagent_type` for each step. Do not skip stages. Follow the detailed instructions in the **large-task-orchestration** skill (artifacts, subagent control, task type → worker mapping, review severity, return of control). Available workers: `worker-dotnet`, `worker-frontend`, `worker-documentation`, `worker-ci-cd`, `worker-electron`, `worker-cpp`.

4. After orchestration completes, summarize for the user: what was done, which workers ran, any open points or follow-ups.

---

## Summary

| Phase | What happens                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Discovery: analyst lens → restatement, assumptions, risks. Questions to the user — **single continuous numbering (1, 2, 3, …)**. After each answer: analyze whether there are enough details; if not — more questions **(continue numbering: 5, 6, 7…)**. Loop until full clarity. Then: "Write 'let's go' / 'run the workflow' to start."                                      |
| **2** | Choose task prefix; write `{prefix}-00-chat-summary.md` (temporary) with Discovery + user answers → run full large-task-orchestration (Stages 0–5): analyst writes `{prefix}-01-technical-spec.md` (temporary), scheduler reads spec and plans, workers read their subtask file and root docs first; temporary files are **kept by default** and may be deleted manually later. |

**Question numbering:** Throughout Phase 1 there is one shared numbered list (1, 2, 3, 4, …) so the user can answer by item ("1. … 2. … 3. …") without confusion between rounds.

This single skill covers: **apply analyst rules → describe the task → ask questions (continuous numbering) until full clarity → on command run the big workflow.**

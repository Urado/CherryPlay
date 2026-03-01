---
name: feature-workflow
description: Coordinates feature work by selecting the appropriate worker (worker-dotnet, worker-frontend, worker-documentation, or worker-ci-cd) for implementation, then invoking the code-reviewer subagent to review the changes and looping back to the worker to address any critical review feedback. Use when implementing or updating a feature end-to-end, including required documentation or CI/CD updates.
---

# Feature Workflow

## Purpose

Use this skill to coordinate **end-to-end feature work** across the `worker-dotnet`, `worker-frontend`, `worker-documentation`, `worker-ci-cd`, and `code-reviewer` subagents.

The workflow:

- **Analyzes the requested task**
- **Selects the appropriate worker** (`worker-dotnet`, `worker-frontend`, `worker-documentation`, or `worker-ci-cd`)
- **Delegates implementation to that worker** (invoke the worker subagent; do not implement the feature yourself)
- **Runs a code review** via `code-reviewer`
- **Loops back to the worker** to fix any **critical** review comments

## When to Apply This Skill

Apply this skill whenever:

- The user requests a **new feature**, **enhancement**, or **non-trivial bug fix**
- The work involves **.NET / C# backend**, **TypeScript/React frontend**, **documentation**, or **CI/CD / infrastructure** (Docker, docker-compose, GitHub Actions, deployment automation)
- You need a **structured flow**: implement → review → fix critical issues

Avoid this workflow for:

- Tiny, isolated text changes or config toggles that do not need review
- Purely exploratory questions (use ask/debug modes instead)

## Workflow

### 1. Understand and scope the task

1. Read the user request carefully and identify:
   - **You MUST treat this workflow as mandatory once started** — do not skip later steps because the change \"looks small\".
   - **Feature goal** (what the user ultimately wants)
   - **Scope** (files/areas likely impacted)
   - **Stack area**:
     - Backend/server-side **.NET / C#** work
     - Frontend/client-side **TypeScript/React** work
     - Both backend and frontend
2. Note any assumptions you make about requirements and behavior.

### 2. Choose the appropriate worker

Select the worker subagent based on task characteristics:

- Use **`worker-dotnet`** when:
  - Implementing or changing **APIs, services, EF Core, authentication**, or other server-side logic
  - Working primarily in C#/.NET projects

- Use **`worker-frontend`** when:
  - Implementing or changing **React/TypeScript components, hooks, styling, state management, or client-side logic**
  - Working primarily in frontend UI/UX code

- Use **`worker-documentation`** when:
  - Creating or updating **Markdown documentation** (setup guides, contracts, architecture docs, integration docs, ops/db docs, theme docs, glossary/terms)
  - The task is primarily about **clarifying behavior**, **documenting a workflow**, or **keeping docs in sync** with existing code
  - Code changes are _not_ required, but documentation accuracy and cross-linking are

- Use **`worker-ci-cd`** when:
  - Implementing or changing **CI/CD pipelines**, **GitHub Actions workflows**, or **deployment automation** under `.github/`
  - Adjusting or adding **Dockerfiles** and **docker-compose** configurations (including `docker-compose.debug.yml`, `docker-compose.yml`, `docker-compose.prod.yml`) as part of build/deploy flows
  - Evolving **infrastructure-related configuration** such as container image tags, environment variables for services, and health checks used by deployments

- If the task spans **both backend and frontend**:
  - Break the work into **clear sub-tasks** (e.g. "backend API support" then "frontend UI integration").
  - Run the workflow **separately for each sub-task**:
    1. Backend sub-task with `worker-dotnet` → `code-reviewer`
    2. Frontend sub-task with `worker-frontend` → `code-reviewer`

- If the task spans **code + documentation**:
  - Prefer implementing the code first (with `worker-dotnet`/`worker-frontend`) and reviewing it.
  - Then run a documentation sub-task with `worker-documentation` → `code-reviewer` to ensure docs are accurate and complete.

- If the task spans **application code + CI/CD or infrastructure**:
  - Break the work into **application** and **CI/CD** sub-tasks.
  - Use `worker-dotnet`/`worker-frontend` for application changes, then `worker-ci-cd` to update workflows/compose/Dockerfiles so they build, test, and deploy the new behavior.

### 3. Implement the feature with the worker

**You MUST delegate implementation to the worker subagent.** Do not implement the feature yourself (do not use search_replace, write, or similar edit tools for the feature code). Invoke the chosen worker via the subagent/task tool (e.g. `mcp_task` with the appropriate `subagent_type`: `worker-dotnet`, `worker-frontend`, `worker-documentation`, or `worker-ci-cd`).

For the chosen worker:

1. **Invoke the worker subagent** with a **clear, task-focused prompt** that includes:
   - The user’s original request
   - Any **assumptions or constraints**
   - Relevant **files, technologies, and patterns** used in the repo
2. Let the worker (the subagent) do the work:
   - Locate the relevant code paths
   - Implement the change following **existing conventions**
   - Add or adjust tests where meaningful
   - Keep changes tightly scoped to the task

Only after the worker returns and you have the implementation should you proceed to step 4 (code review). Optional, low-risk fixes (e.g. applying a non-critical suggestion from review) may be done by the orchestrator if they are trivial; the initial implementation and any critical fix loops must be done by the worker.

### 4. Run code review with `code-reviewer`

After the worker finishes:

1. Invoke the **`code-reviewer`** subagent.
2. Ask it to:
   - Review the new/changed code for **correctness, security, maintainability, and alignment with project standards**
   - Explicitly distinguish between:
     - **Critical issues** (must-fix before completion)
     - **Non-critical suggestions** (nice-to-have or style-only)
3. Capture and summarize the feedback.

### 5. Handle critical feedback and iterate

If `code-reviewer` reports **critical issues** (for example):

- Logic bugs, broken flows, or regressions
- Failing or missing essential tests
- Security problems or unsafe patterns
- API contracts broken or major style/architecture violations

Then:

1. Summarize the critical comments.
2. Re-invoke the **same worker** that did the implementation (`worker-dotnet` or `worker-frontend`) with:
   - The **original task description**
   - The **review summary**, highlighting **critical issues** to fix
   - **This step is NOT optional**: if there is at least one critical issue, you MUST re-run the worker without asking the user for confirmation, even if the issue seems \"tiny\" (e.g. a single prop fix).
3. Have the worker:
   - Apply fixes targeting the critical issues
   - Update or add tests as needed
4. **Re-run `code-reviewer`** to confirm that critical issues are resolved.
5. Repeat this loop **until there are no remaining critical issues**. Do not finalize the feature or report it as \"done\" while any critical item remains.

For **non-critical suggestions**:

- Apply straightforward, low-risk improvements directly when they are easy and clearly beneficial.
- Otherwise, mention them as **optional follow-ups** in your summary to the user.

### 6. Finalize and report to the user

When there are **no remaining critical review comments**:

1. Summarize for the user:
   - **What was implemented** at a high level
   - Which worker(s) were involved
   - Any **notable design choices or assumptions**
2. Briefly mention:
   - That `code-reviewer` validated the changes
   - Any remaining **optional** improvements (if relevant)
3. Provide basic guidance on **how to run or test** the changes locally, if applicable.

## Examples

### Example 1: Backend-only feature

- User asks to add a new API endpoint in a .NET service.
- Apply this skill:
  - Choose `worker-dotnet` to implement the endpoint and tests.
  - Invoke `code-reviewer` on the changes.
  - If critical issues are found (e.g. missing validation, incorrect status codes), call `worker-dotnet` again to fix them.
  - Re-run `code-reviewer` until no critical issues remain.

### Example 2: Frontend-only feature

- User asks to add a new React component with a playlist UI.
- Apply this skill:
  - Choose `worker-frontend` to implement the component, hook up state, and add tests/story if appropriate.
  - Run `code-reviewer` to evaluate quality and correctness.
  - If critical issues are reported (e.g. broken interactions, accessibility problems), re-run `worker-frontend` to address them.
  - Re-run `code-reviewer` until critical issues are cleared.

### Example 3: Full-stack feature

- User asks for a new feature that requires both an API change and a UI change.
- Apply this skill:
  - First, run the workflow for the **backend sub-task**:
    - Use `worker-dotnet` → `code-reviewer` → fix loop until clean.
  - Then, run the workflow for the **frontend sub-task**:
    - Use `worker-frontend` → `code-reviewer` → fix loop until clean.
  - Summarize the final result across both layers for the user.

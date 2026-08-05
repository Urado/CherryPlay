---
name: expert-evaluation
description: >-
  Runs a five-role expert/stakeholder panel on a product or UX idea and synthesizes
  a merged verdict. Use ONLY when the user explicitly asks for expert or multi-role
  stakeholder opinions. Do NOT use for ordinary here-and-now product advice or
  feasibility discussion without that ask. Not for implementation requests.
---

# Expert Evaluation

## Purpose

Use this skill when the user **explicitly** asks for a **structured multi-perspective expert panel** on a product idea, UX change, feature proposal, or positioning — without implementation.

Standard flow:

1. **Gather context** (question, constraints, relevant docs/todos if in-repo)
2. **Launch five parallel subagents** — one per role
3. **Synthesize** into a single report for the user

This skill is **analysis-only**. Do not edit code, docs, or configs unless the user explicitly asks to implement afterward.

---

## When to Apply

**Hard gate:** apply **only** when the user **explicitly requests expert / multi-role / multi-perspective opinion**. Casual product chat is **not** enough — even if the topic would benefit from a panel.

Apply when the message clearly asks for experts or roles, for example:

- «мнение экспертов», «собери панель», «экспертная оценка»
- «с разных сторон», «глазами X / Y / Z», «ролями»
- «panel», «roundtable», «multi-perspective review»
- explicit list of stakeholder lenses to weigh in before deciding

Do **not** apply for:

- ordinary advice / design discussion in the moment («можем так сделать?», «посоветуй», «что думаешь?», «норм идея?», «как лучше?») — answer yourself briefly from docs/context; do **not** launch the five-role panel
- pure implementation requests («сделай», «добавь», «исправь»)
- single-lens review already covered by another skill (e.g. code-reviewer only)
- questions answerable from one doc without an explicit ask for stakeholder debate

If unsure whether the user wants the panel: **do not** launch it — answer normally and optionally offer «могу собрать панель экспертов, если нужно».

---

## Phase 0: Prepare the Brief

Before launching subagents:

1. **Restate the idea** in 2–4 sentences: what is proposed, for whom, what problem it solves.
2. **List constraints** the user or project already stated (e.g. «не форсить Party layout», «акцент на сборку плейлиста»).
3. **Pull in-repo context** when relevant:
   - personal/beta todos: `docs/archive/personal-todos/`
   - product synthesis: `CherryPlayList/docs/online-mode-ux-synthesis.md`
   - module docs under `CherryPlayList/docs/modules/`
4. Pass the **same brief** to all five subagents so they argue from shared facts.

If the idea is underspecified, ask **one** clarifying question before launching — unless the user explicitly wants a speculative evaluation.

---

## Phase 1: Five Parallel Perspectives

Launch **exactly five** subagents in **one parallel** `Task` call.

| #   | Role                   | `subagent_type`  | Lens                                                                                   |
| --- | ---------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| 1   | **DJ / organizer**     | `generalPurpose` | Runs real parties: prepare playlist, preview, go live, guest page                      |
| 2   | **Design / UX expert** | `generalPurpose` | IA, cognitive load, progressive disclosure, consistency, session safety                |
| 3   | **Developer**          | `generalPurpose` | Architecture fit, cost, migration, maintainability, phased delivery                    |
| 4   | **Marketer**           | `generalPurpose` | Positioning, demo story, USP, messaging, onboarding                                    |
| 5   | **Regular user**       | `generalPurpose` | Non-expert: first visit, jargon fear, «сломаю ли я вечеринку», wants obvious next step |

### Subagent rules (all five)

- Respond **only in Russian**
- **No code, no file edits**
- Be concise but substantive (~8–15 short paragraphs or tight bullets)
- Use the **required output structure** for that role (below)
- `model`: **`inherit`** (required by project rule)

### Shared prompt skeleton

Pass each subagent:

```text
You are evaluating a product/UX idea. Respond ONLY in Russian. No code. No file edits.

## Idea under discussion
[2–4 sentence restatement]

## Constraints and context
[bullets: user constraints, relevant todos, synthesis principles, as-is behavior]

## Your role
[one of the five roles — see role-specific section below]

## Required output structure
[role-specific sections]
```

---

### Role 1 — DJ / organizer

**Focus:** prepare vs play mental model; Party/online placement; Collections/File Browser/AIMP in assembly; power-user custom layouts; session safety.

**Output structure:**

- **Verdict** (1–2 sentences)
- **Pros for DJs**
- **Cons / risks for DJs**
- **Fit with stated constraints** (if any named in brief)
- **Recommended refinement** (DJ POV)

---

### Role 2 — Design / UX expert

**Focus:** mode vs stages vs edit; header chrome overload; discoverability; mode switching mid-session; demo vs main player labeling.

**Output structure:**

- **Verdict**
- **IA assessment**
- **Mode vs stages vs edit** (or equivalent for non-mode ideas)
- **Placement of secondary flows** (e.g. Party, settings, advanced)
- **Risks**
- **Concrete design recommendation**

---

### Role 3 — Developer

**Focus:** fit with current architecture; new state vs constrained presets; persist/migration; effort order-of-magnitude; phased vs big-bang; cleaner alternatives.

**Output structure:**

- **Verdict** (build / phased / avoid)
- **Architecture fit**
- **Migration and risks**
- **Effort and phasing**
- **Preferred technical approach**
- **Conflict with stated principles** (if any)

---

### Role 4 — Marketer

**Focus:** landing/demo narrative; pro vs simple brand; USP vs competitors; messaging that reconciles conflicting product accents.

**Output structure:**

- **Verdict**
- **Story / demo impact**
- **Brand (pro vs simple)**
- **USP risk**
- **Messaging recommendation**
- **Fit with named stakeholders** (if in brief)

---

### Role 5 — Regular user

**Focus:** «я не диджей и не разработчик»; what is confusing on first open; scary buttons; unexplained words (layout, session, streaming); whether they know what to do next; fear of irreversible actions.

**Output structure:**

- **Verdict** (would I understand this? would I trust it?)
- **What feels clear**
- **What feels scary or confusing**
- **Words / UI I'd need explained**
- **One thing that would make me try vs quit**
- **Recommended simplification** (layperson POV)

---

## Phase 2: Synthesize for the User

After all five complete, the **parent agent** writes the final answer. Do not dump raw subagent logs.

### Final report structure

```markdown
## Общий вердикт

[2–4 sentences: consensus, main tension, recommended direction]

## Сводка по ролям

| Роль                 | Вердикт | Главный плюс | Главный риск |
| -------------------- | ------- | ------------ | ------------ |
| DJ                   | …       | …            | …            |
| Дизайн               | …       | …            | …            |
| Разработка           | …       | …            | …            |
| Маркетинг            | …       | …            | …            |
| Рядовой пользователь | …       | …            | …            |

## Где все согласны

- …

## Где мнения расходятся

- …

## Рекомендуемая формулировка / следующий шаг

- …
```

### Synthesis rules

- Lead with **verdict**, not process
- Highlight **regular user** confusion if experts disagree — layperson friction often predicts beta feedback
- If roles conflict, name the **trade-off** explicitly (e.g. simplicity vs USP visibility)
- Link subagent runs when useful: `[DJ](id)`, `[Design](id)`, etc.
- End with **one** concrete next step (prototype, copy test, phased MVP, or «нужно уточнить X»)

---

## Optional Phase 3: Implementation

Only if the user **explicitly** asks after the evaluation:

- «давай», «реализуй», «сделай план» → route to `discovery-then-orchestration` or `feature-workflow` / `large-task-orchestration` as appropriate
- Do **not** auto-start implementation after evaluation

---

## Anti-patterns

- Triggering this skill on «можем так сделать?», «посоветуй», «что думаешь?» without an explicit ask for experts / panel / multi-role review
- Launching the five-role panel because the idea is interesting or complex — complexity alone is not a trigger
- Launching fewer than five roles when user asked for full expert panel
- Sequential subagents when parallel is possible
- Editing product code during evaluation
- Ignoring regular user lens because «experts matter more»
- Omitting in-repo todos/synthesis when evaluating CherryPlay UX

---

## Examples

### Apply (explicit panel ask)

User: «Обсуди идею переключателя Сбор / Проигрывание в шапке — с разных сторон, включая рядового пользователя.»

Actions:

1. Read `sonya_todo.md`, `pasha_todo.md`, `online-mode-ux-synthesis.md` if not already in context
2. Launch five parallel `Task` subagents with shared brief
3. Synthesize merged report in Russian for Павел

### Do not apply (ordinary advice)

User: «Кажется тут есть проблемы с ✎. Можем так сделать: править пресеты, кнопка сброса, и если состав не менялся — ничего не сохранять?»

Actions:

1. Answer yourself from docs/code (as-is behavior, feasibility, one recommended model)
2. Do **not** launch expert subagents
3. Optionally: «Если нужно — могу собрать панель экспертов»

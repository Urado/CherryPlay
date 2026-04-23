---
name: ai-coding-best-practices
description: Researches and synthesizes modern best practices for coding with AI, agentic engineering workflows, and MCP-based tool ecosystems. Use when the user asks for up-to-date guidance, standards, or playbooks for AI-assisted software development, code quality, or secure tool integration.
---

# AI Coding Best Practices

## Purpose

Use this skill to produce **current, actionable best practices** for software development with AI systems, including:

- AI-assisted coding workflows
- Agent orchestration patterns
- MCP (Model Context Protocol) integration and security
- Code quality guardrails for autonomous and semi-autonomous coding

## Mandatory delegation rule

When this skill is applied, the orchestrator **must not perform web research directly**.

Instead, it must invoke the dedicated subagent:

- `worker-ai-research`

The subagent is responsible for external research and returns a concise synthesis with sources. The orchestrator then adapts that synthesis to the user task.

## When to apply

Apply this skill when the user asks for:

- Best practices for coding with AI assistants or coding agents
- Modern agent design patterns for software engineering
- MCP architecture, integration, or security recommendations
- Practical standards/checklists for production AI coding workflows

Do not apply this skill for:

- Purely local code edits that do not require current external guidance
- Narrow repository-only questions with no standards/research component

## When to not apply

- Implementation-only tasks where no current external guidance is needed.
- Repository-local refactors that can be completed from existing project context.

## Workflow

### 1) Define the research brief

Create a short brief for `worker-ai-research`:

- Target topic and scope
- Constraints (stack, team maturity, risk tolerance, compliance needs)
- Required output format (playbook, checklist, architecture guidance, etc.)

### 2) Delegate web research to subagent (required)

Invoke `worker-ai-research` with the brief and require:

- Source-grounded findings
- MCP-specific recommendations (tools/resources/prompts, auth, least privilege, HITL, audit)
- Security notes (prompt injection, tool poisoning, exfiltration, supply chain)
- Practical defaults that can be adopted immediately

### 3) Validate and normalize

After receiving the subagent output:

- Remove overlaps and contradictions
- Prioritize official/primary sources over secondary commentary
- Mark uncertain points explicitly

### 4) Convert to implementation guidance

Transform findings into one of these formats based on user intent:

- **Checklist** for team adoption
- **Decision matrix** (simple workflow vs agent, tooling choices)
- **Operating standard** for CI/CD and review gates
- **Playbook** for secure MCP rollout

### 5) Deliver concise final output

Provide:

- Actionable recommendations in priority order
- Clear "start here" baseline
- Source list (markdown links)
- Known trade-offs and residual risks

## Artifacts

- Research brief for `worker-ai-research`.
- Source-grounded synthesis from the research subagent.
- Final normalized output (checklist, matrix, standard, or playbook).

## Recommended baseline (default policy)

Unless the user requests otherwise, favor these defaults:

1. Start with simple workflows before autonomous agents.
2. Keep tool interfaces small, explicit, and schema-validated.
3. Enforce least privilege and explicit human approval for sensitive actions.
4. Require deterministic validation gates (tests, lint, static checks) for AI-made changes.
5. Use evaluator/reviewer loops for non-trivial code generation.
6. Log tool calls and maintain auditable traces for agent actions.
7. Treat tool outputs and external content as untrusted input.

## Prompt template for the research subagent

Use this template when invoking `worker-ai-research`:

```markdown
Research objective:

- [Describe exactly what to investigate]

Constraints:

- Project context: [stack/team/stage]
- Risk tolerance: [low/medium/high]
- Time horizon: [immediate practices vs strategic]

Required deliverable:

1. Key findings (actionable)
2. MCP-specific guidance
3. Agent workflow recommendations
4. Recommended defaults
5. Sources (official/security/research/secondary)
6. Gaps/uncertainty

Quality bar:

- Prefer official docs, standards, and primary research
- Mark uncertain claims explicitly
- Keep output concise and implementation-ready
```

## Output quality checklist

- [ ] Research was delegated to `worker-ai-research`
- [ ] Guidance is source-grounded and current
- [ ] MCP security and governance are covered
- [ ] Recommendations are actionable and prioritized
- [ ] Residual risks and unknowns are explicit

## Return of control

- Return a concise final recommendation set with sources and uncertainties.
- Do not start repository edits unless the user explicitly asks for implementation.

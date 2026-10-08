# CherryPlay Codex integration

## Canonical instructions

The original Cursor files remain the source of truth. Do not copy, rewrite, or
delete them as part of integration maintenance.

At the start of work, discover `.cursor/rules/*.mdc` and read each rule's
frontmatter. Read and follow the complete body of every `alwaysApply: true`
rule. Read other rules when their `globs` match the files involved, their
`description` matches the task, or the user explicitly invokes them. Recheck
applicable rules when the task scope changes. Treat frontmatter as selection
metadata, not application source.

Resolve rule paths relative to this repository. Some Cursor globs were written
for the parent CherryPlayUnion workspace: remove a leading `CherryPlay/` when
matching paths in this repository. Keep the original rule files unchanged.

User instructions and higher-priority system/developer instructions take
precedence. Report a material tool or instruction conflict instead of silently
skipping a required workflow step.

## Skills and roles

`.agents/skills/` links to the original `.cursor/skills/` folders and the local
graph plugin's skill. Apply their original selection criteria and workflows.
If a linked skill has not yet appeared in the skill catalog, read its original
`SKILL.md` directly when applicable. Read referenced resources from the original
skill directory so relative links and scripts keep working.

When a workflow requires a named Cursor role, read the complete corresponding
`.cursor/agents/<role>.md` and pass its role instructions, the applicable rules,
repository path, and concrete task to a Codex collaboration subagent. A role file
defines a prompt; it does not register a native Codex agent automatically.

Map Cursor's `Task`/`subagent_type` to the available collaboration tools. Map
`model: inherit` to omitting the Codex model and reasoning overrides, which
inherits the parent settings. Never send the unsupported literal model names
`inherit` or `auto`. Keep workflow review loops and return-of-control criteria.
Respect the available concurrency limit when scheduling workers.

Map Cursor file tools to available agent file tools: `rg` for discovery and
search, file reading through the available read tool (or `Get-Content` when no
dedicated read tool exists), and `apply_patch` for text edits. Terminal builds,
tests, lint, git, and MCP processes remain terminal operations. Filesystem link
creation is integration setup, not a shell replacement for editing source.

## MCP and graph plugin

Project MCP configuration lives in `.codex/config.toml`; Context7 is already
configured in the user Codex profile. The graph plugin's original skill and
scripts remain in the Cursor plugin directory.

For `graph-driven-refactor`, the product root is this repository, including
`.code-graph/` and `slnmap.db`. Use the connected `code-graph` and `slnmap` tools
in place of the Cursor plugin enablement UI. Configuration alone does not prove
that a server connected; check available tools before claiming graph access.
If tools are unavailable, report the missing server and refresh the local Codex
session before relying on it. Do not index the Kanban or Union root.

Keep credentials out of repository configuration. Do not overwrite unrelated
user MCP servers, skills, or plugins.

## Docker from the sandbox

The `workspace-write` sandbox may block access to Docker Desktop's daemon named
pipe (`npipe://./pipe/docker_engine`). Writable workspace roots do not grant
daemon access. When a task needs local Docker, request narrow, command-level
sandbox escalation or user approval for the specific Docker command. Avoid
recommending Full Access for routine Docker use; Windows elevated sandbox mode
alone does not guarantee access to the Docker pipe.

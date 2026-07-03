import type { Layout } from './layout';

/** Built-in layout preset identifiers (factory layouts). */
export type LayoutPreset =
  | 'simple'
  | 'complex'
  | 'collections'
  | 'collections-vertical'
  | 'player'
  | 'party'
  | 'aimp-party';

/** Stable id for built-ins: `builtin:${LayoutPreset}` */
export type BuiltinWorkspaceId = `builtin:${LayoutPreset}`;

export type ActiveWorkspace =
  | { kind: 'builtin'; preset: LayoutPreset }
  | { kind: 'user'; id: string }
  | { kind: 'scratch' };

export type WorkspaceRef = { kind: 'builtin'; preset: LayoutPreset } | { kind: 'user'; id: string };

export interface UserWorkspace {
  id: string;
  name: string;
  layout: Layout;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspacePersistSlice {
  activeWorkspace: ActiveWorkspace;
  userWorkspaces: UserWorkspace[];
  layout: Layout;
}

export const DEFAULT_BUILTIN_PRESET: LayoutPreset = 'collections';

/** Display name for auto-created user workspaces until the user renames them. */
export const UNNAMED_WORKSPACE_NAME = 'Без имени';

const UNNAMED_WORKSPACE_NAME_PREFIX = `${UNNAMED_WORKSPACE_NAME} `;

/** True for auto-generated names: «Без имени», «Без имени 2», … */
export function isUnnamedWorkspaceName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed === UNNAMED_WORKSPACE_NAME) {
    return true;
  }
  if (!trimmed.startsWith(UNNAMED_WORKSPACE_NAME_PREFIX)) {
    return false;
  }
  const suffix = trimmed.slice(UNNAMED_WORKSPACE_NAME_PREFIX.length);
  if (!/^\d+$/.test(suffix)) {
    return false;
  }
  const index = Number(suffix);
  return Number.isInteger(index) && index >= 2;
}

/** First unnamed workspace is «Без имени»; further ones get «Без имени 2», «Без имени 3», … */
export function allocateUnnamedWorkspaceName(existingNames: readonly string[]): string {
  const trimmedNames = existingNames.map((name) => name.trim());
  if (!trimmedNames.includes(UNNAMED_WORKSPACE_NAME)) {
    return UNNAMED_WORKSPACE_NAME;
  }

  let suffix = 2;
  while (trimmedNames.includes(`${UNNAMED_WORKSPACE_NAME} ${suffix}`)) {
    suffix += 1;
  }
  return `${UNNAMED_WORKSPACE_NAME} ${suffix}`;
}

export function toBuiltinWorkspaceId(preset: LayoutPreset): BuiltinWorkspaceId {
  return `builtin:${preset}`;
}

export function isBuiltinWorkspaceId(id: string): id is BuiltinWorkspaceId {
  return id.startsWith('builtin:');
}

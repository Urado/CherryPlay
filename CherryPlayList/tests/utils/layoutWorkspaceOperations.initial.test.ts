import type { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';
import {
  addInitialWorkspaceToLayout,
  canAddInitialWorkspace,
  getAddWorkspaceErrorMessage,
} from '@shared/utils/layoutWorkspaceOperations';

const stubWorkspaceComponent = () => null;

const TEST_WORKSPACE_MODULES: IWorkspaceModule[] = [
  {
    id: 'playlist-workspace',
    type: 'playlist',
    name: 'Playlist',
    component: stubWorkspaceComponent,
    minWidth: 280,
    minHeight: 200,
  },
];

describe('addInitialWorkspaceToLayout min-size feasibility', () => {
  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    TEST_WORKSPACE_MODULES.forEach((module) => workspaceRegistry.register(module));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('adds the first workspace when the viewport can satisfy its mins', () => {
    const result = addInitialWorkspaceToLayout('playlist', { width: 400, height: 300 });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected addInitialWorkspaceToLayout to succeed');
    }
    expect(result.layout.rootZone.type).toBe('workspace');
  });

  it('rejects with min_size_violation when the viewport is too small', () => {
    const result = addInitialWorkspaceToLayout('playlist', { width: 200, height: 150 });

    expect(result).toMatchObject({ ok: false, reason: 'min_size_violation' });
  });

  it('rejects with min_size_violation when the viewport is null', () => {
    const result = addInitialWorkspaceToLayout('playlist', null);

    expect(result).toMatchObject({ ok: false, reason: 'min_size_violation' });
  });

  it('skips the feasibility check when the viewport argument is omitted', () => {
    expect(addInitialWorkspaceToLayout('playlist').ok).toBe(true);
  });

  it('exposes canAddInitialWorkspace as a probe helper', () => {
    expect(canAddInitialWorkspace('playlist', { width: 400, height: 300 })).toBe(true);
    expect(canAddInitialWorkspace('playlist', { width: 100, height: 100 })).toBe(false);
  });

  it('returns the action-hint message for min_size_violation', () => {
    expect(getAddWorkspaceErrorMessage('min_size_violation')).toBe(
      'Недостаточно места. Увеличьте окно или измените пропорции разделителями.',
    );
  });
});

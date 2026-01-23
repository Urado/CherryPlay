import { ContainerZone, WorkspaceZone } from '../../src/types/layout';
import {
  cleanupContainers,
  findParentZone,
  findZoneById,
  validateLayout,
} from '../../src/utils/layoutUtils';

const createWorkspace = (id: string, size = 50): WorkspaceZone => ({
  id: `${id}-zone`,
  type: 'workspace',
  workspaceId: id,
  workspaceType: 'test',
  size,
});

describe('layoutUtils helpers', () => {
  it('finds zones and their parents in nested trees', () => {
    const child = createWorkspace('child');
    const container: ContainerZone = {
      id: 'container',
      type: 'container',
      direction: 'horizontal',
      zones: [child],
      sizes: [100],
    };

    expect(findZoneById(container, child.id)).toEqual(child);
    expect(findParentZone(container, child.id)).toEqual(container);
  });

  it('validates layout constraints for simple container', () => {
    const left = createWorkspace('left', 60);
    const right = createWorkspace('right', 40);
    const root: ContainerZone = {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      zones: [left, right],
      sizes: [60, 40],
    };

    expect(validateLayout(root, 1200, 800)).toBe(true);
  });

  it('fails validation when child sizes are below minimum percent', () => {
    const small = createWorkspace('tiny', 0.5);
    const large = createWorkspace('large', 99.5);
    const root: ContainerZone = {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      zones: [small, large],
      sizes: [0.5, 99.5],
    };

    expect(validateLayout(root, 1000, 800)).toBe(false);
  });

  it('removes single-child containers recursively', () => {
    const leaf = createWorkspace('final', 100);
    const nested: ContainerZone = {
      id: 'nested',
      type: 'container',
      direction: 'vertical',
      zones: [leaf],
      sizes: [100],
    };
    const root: ContainerZone = {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      zones: [nested],
      sizes: [100],
    };

    const cleaned = cleanupContainers(root);
    expect(cleaned.type).toBe('workspace');
    expect((cleaned as WorkspaceZone).workspaceId).toBe('final');
  });
});

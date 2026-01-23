import { useLayoutStore } from '../../src/state/layoutStore';
import { ContainerZone, Layout, WorkspaceZone } from '../../src/types/layout';

describe('layoutStore basic behaviors', () => {
  beforeEach(() => {
    useLayoutStore.getState().setLayoutPreset('simple');
  });

  it('rebalances sibling sizes when a zone is resized', () => {
    const initialRoot = useLayoutStore.getState().layout.rootZone as ContainerZone;
    const targetZoneId = initialRoot.zones[0].id;

    useLayoutStore.getState().updateZoneSize(targetZoneId, 70);

    const updatedRoot = useLayoutStore.getState().layout.rootZone as ContainerZone;
    expect(updatedRoot.sizes[0]).toBeCloseTo(70, 2);
    expect(updatedRoot.sizes[1]).toBeCloseTo(30, 2);
    expect(updatedRoot.sizes.reduce((sum, size) => sum + size, 0)).toBeCloseTo(100, 5);
  });

  it('adds new zones evenly within a container', () => {
    const rootId = useLayoutStore.getState().layout.rootZone.id;
    useLayoutStore.getState().addZone(rootId, 'extra-workspace', 'test');

    const updatedRoot = useLayoutStore.getState().layout.rootZone as ContainerZone;
    expect(updatedRoot.zones).toHaveLength(3);
    const newZone = updatedRoot.zones.find(
      (zone) => zone.type === 'workspace' && zone.workspaceId === 'extra-workspace',
    ) as WorkspaceZone | undefined;
    expect(newZone).toBeDefined();

    updatedRoot.sizes.forEach((size) => {
      expect(size).toBeCloseTo(100 / 3, 1);
    });
  });

  it('collapses single-child containers during cleanup', () => {
    const leafZone: WorkspaceZone = {
      id: 'leaf-zone',
      type: 'workspace',
      workspaceId: 'leaf-workspace',
      workspaceType: 'playlist',
      size: 100,
    };
    const singleChildContainer: ContainerZone = {
      id: 'single-container',
      type: 'container',
      direction: 'horizontal',
      zones: [leafZone],
      sizes: [100],
    };
    const layout: Layout = {
      version: 1,
      rootZone: {
        id: 'root-container',
        type: 'container',
        direction: 'horizontal',
        zones: [singleChildContainer],
        sizes: [100],
      },
    };

    useLayoutStore.setState({ layout });
    useLayoutStore.getState().cleanupEmptyContainers();

    const result = useLayoutStore.getState().layout.rootZone;
    expect(result.type).toBe('workspace');
    expect((result as WorkspaceZone).workspaceId).toBe('leaf-workspace');
  });
});

import { projectService } from '../../../src/shared/services/projectService';
import { validateProjectFile } from '../../../src/shared/utils/projectValidation';

describe('project collection serialization', () => {
  const projectData = {
    name: 'Showcase',
    items: [],
    settings: {
      defaultPauseBetweenTracks: 0,
      defaultActionAfterTrack: 'next' as const,
      plannedEndTime: null,
      portableMode: false,
    },
    trackSettings: new Map(),
    groupSettings: new Map(),
    collections: [
      {
        id: 'collection-a',
        name: 'Opening',
        items: [
          {
            id: 'group-a',
            name: 'Intro',
            items: [{ id: 'track-a', path: 'D:/music/a.mp3', name: 'A', duration: 15 }],
          },
        ],
      },
      { id: 'collection-b', name: 'Empty', items: [] },
    ],
    collectionViewState: { bindings: { 'window-a': 'collection-a' } },
  };

  it('round-trips populated and empty collections with window bindings in project version 2.1', async () => {
    const file = projectService.serializeProject(projectData);

    expect(file.version).toBe('2.1');
    expect(file.collections).toHaveLength(2);
    expect(file.collections?.[1]).toEqual({ id: 'collection-b', name: 'Empty', items: [], rootItems: [] });
    const loaded = await projectService.loadProjectFromData(file, '');
    expect(loaded.collections).toEqual(projectData.collections);
    expect(loaded.collectionViewState).toEqual(projectData.collectionViewState);
  });

  it('continues to accept project version 2.0 without collection fields', () => {
    const file = projectService.serializeProject({ ...projectData, collections: undefined, collectionViewState: undefined });
    const legacyFile = { ...file, version: '2.0' };
    delete (legacyFile as Partial<typeof legacyFile>).collections;

    const result = validateProjectFile(legacyFile);

    expect(result.isValid).toBe(true);
    expect(result.data?.version).toBe('2.0');
    expect(result.data?.collections).toBeUndefined();
  });

  it('rejects collections with duplicate stable identities', () => {
    const file = projectService.serializeProject(projectData);
    const duplicateIdFile = {
      ...file,
      collections: [file.collections?.[0], { ...file.collections?.[1], id: 'collection-a' }],
    };

    const result = validateProjectFile(duplicateIdFile);

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ').toLowerCase()).toContain('duplicate');
  });

  it('rejects invalid collection references and cyclic group graphs', () => {
    const file = projectService.serializeProject(projectData);
    const collection = file.collections?.[0];
    if (!collection) throw new Error('Test collection was not serialized');
    const invalidReferences = {
      ...file,
      collections: [{ ...collection, rootItems: ['missing-root'] }],
    };
    const cyclicGroups = {
      ...file,
      collections: [
        {
          ...collection,
          items: [
            { type: 'group' as const, id: 'group-one', name: 'One', items: ['group-two'] },
            { type: 'group' as const, id: 'group-two', name: 'Two', items: ['group-one'] },
          ],
          rootItems: ['group-one'],
        },
      ],
    };

    expect(validateProjectFile(invalidReferences).isValid).toBe(false);
    const cycleResult = validateProjectFile(cyclicGroups);
    expect(cycleResult.isValid).toBe(false);
    expect(cycleResult.errors.join(' ').toLowerCase()).toMatch(/cycle|multiple parents/);
  });
});

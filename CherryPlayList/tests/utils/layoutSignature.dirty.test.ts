import type { Layout } from '../../src/core/types/layout';
import { computeIsWorkspaceDirty } from '../../src/shared/stores/layoutStore';
import { getLayoutZoneSignature } from '../../src/shared/utils/layoutSignature';

/**
 * Regression coverage for dirty detection of same-type zone changes.
 * `getLayoutZoneSignature` must encode `workspaceId` so that reordering two
 * zones of the same `workspaceType`, or changing a zone's `workspaceId`,
 * is detected as dirty (otherwise auto-commit/persist silently loses changes).
 */
describe('getLayoutZoneSignature dirty detection', () => {
  const makeCollectionLayout = (firstId: string, secondId: string): Layout => ({
    version: 1,
    rootZone: {
      id: 'root',
      type: 'container',
      direction: 'horizontal',
      sizes: [50, 50],
      zones: [
        {
          id: 'zone-a',
          type: 'workspace',
          workspaceId: firstId,
          workspaceType: 'collection',
          size: 50,
        },
        {
          id: 'zone-b',
          type: 'workspace',
          workspaceId: secondId,
          workspaceType: 'collection',
          size: 50,
        },
      ],
    },
  });

  it('detects swapping two same-type zones as dirty', () => {
    const baseline = makeCollectionLayout('collection-1', 'collection-2');
    const swapped = makeCollectionLayout('collection-2', 'collection-1');

    expect(getLayoutZoneSignature(baseline.rootZone)).not.toBe(
      getLayoutZoneSignature(swapped.rootZone),
    );
    expect(computeIsWorkspaceDirty(swapped, baseline)).toBe(true);
  });

  it('detects a workspaceId change as dirty', () => {
    const baseline = makeCollectionLayout('collection-1', 'collection-2');
    const changed = makeCollectionLayout('collection-1', 'collection-9');

    expect(getLayoutZoneSignature(baseline.rootZone)).not.toBe(
      getLayoutZoneSignature(changed.rootZone),
    );
    expect(computeIsWorkspaceDirty(changed, baseline)).toBe(true);
  });

  it('treats identical layouts as not dirty', () => {
    const baseline = makeCollectionLayout('collection-1', 'collection-2');
    const identical = makeCollectionLayout('collection-1', 'collection-2');

    expect(getLayoutZoneSignature(baseline.rootZone)).toBe(
      getLayoutZoneSignature(identical.rootZone),
    );
    expect(computeIsWorkspaceDirty(identical, baseline)).toBe(false);
  });
});

import { isProjectBindingCurrent } from '../../../src/shared/utils/projectBinding';

describe('isProjectBindingCurrent', () => {
  it('rejects a delayed party URL when another project is active', () => {
    expect(
      isProjectBindingCurrent(
        {
          filePath: 'D:/projects/b.cherry',
          linkedParty: null,
        },
        'D:/projects/a.cherry',
        'party-a',
      ),
    ).toBe(false);
  });

  it('accepts a delayed party URL only while its project and party are still active', () => {
    expect(
      isProjectBindingCurrent(
        {
          filePath: 'D:/projects/a.cherry',
          linkedParty: { id: 'party-a', shortCode: 'alpha' },
        },
        'D:/projects/a.cherry',
        'party-a',
      ),
    ).toBe(true);
  });
});

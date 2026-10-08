import { canDiscardUnsavedProjectChanges } from '../../../src/shared/utils/projectNavigationGuard';

describe('project navigation guard', () => {
  it('allows navigation without prompting when the project is clean', () => {
    const confirmDiscard = jest.fn(() => false);

    expect(canDiscardUnsavedProjectChanges(false, confirmDiscard)).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('blocks navigation when discarding unsaved changes is declined', () => {
    const confirmDiscard = jest.fn(() => false);

    expect(canDiscardUnsavedProjectChanges(true, confirmDiscard)).toBe(false);
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });

  it('allows navigation when discarding unsaved changes is confirmed', () => {
    const confirmDiscard = jest.fn(() => true);

    expect(canDiscardUnsavedProjectChanges(true, confirmDiscard)).toBe(true);
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });
});

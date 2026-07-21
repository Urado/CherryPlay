import {
  allocateUnnamedWorkspaceName,
  isUnnamedWorkspaceName,
  UNNAMED_WORKSPACE_NAME,
} from '@core/types/workspacePreset';

describe('workspacePreset naming', () => {
  it('isUnnamedWorkspaceName matches base and numbered variants', () => {
    expect(isUnnamedWorkspaceName('Без имени')).toBe(true);
    expect(isUnnamedWorkspaceName('Без имени 2')).toBe(true);
    expect(isUnnamedWorkspaceName('Без имени 10')).toBe(true);
    expect(isUnnamedWorkspaceName('Мой DJ')).toBe(false);
    expect(isUnnamedWorkspaceName('Без имени extra')).toBe(false);
  });

  it('allocateUnnamedWorkspaceName uses base first then increments', () => {
    expect(allocateUnnamedWorkspaceName([])).toBe(UNNAMED_WORKSPACE_NAME);
    expect(allocateUnnamedWorkspaceName(['Без имени'])).toBe('Без имени 2');
    expect(allocateUnnamedWorkspaceName(['Без имени', 'Без имени 2'])).toBe('Без имени 3');
    expect(allocateUnnamedWorkspaceName(['Мой', 'Без имени 2'])).toBe(UNNAMED_WORKSPACE_NAME);
  });
});

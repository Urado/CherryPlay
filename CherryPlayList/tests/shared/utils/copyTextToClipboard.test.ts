import { copyTextToClipboard } from '../../../src/shared/utils/copyTextToClipboard';
import {
  resolvePartyCatalogLabel,
  resolvePartyCatalogToggleHint,
} from '../../../src/workspaces/party/partyCatalogLabels';

describe('copyTextToClipboard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses navigator.clipboard when available', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyTextToClipboard('https://example.test/party');

    expect(writeText).toHaveBeenCalledWith('https://example.test/party');
  });

  it('falls back to execCommand when clipboard write fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest.fn().mockRejectedValue(new Error('denied')),
      },
    });
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    await copyTextToClipboard('https://example.test/fallback');

    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});

describe('partyCatalogLabels', () => {
  it('returns shared catalog labels', () => {
    expect(resolvePartyCatalogLabel(true)).toBe('В каталоге');
    expect(resolvePartyCatalogLabel(false)).toBe('По ссылке');
  });

  it('returns shared catalog toggle hints', () => {
    expect(resolvePartyCatalogToggleHint(true)).toContain('общем каталоге');
    expect(resolvePartyCatalogToggleHint(false)).toContain('только по ссылке');
  });
});

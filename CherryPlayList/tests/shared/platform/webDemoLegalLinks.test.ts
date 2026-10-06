import { WebDemoPlatform } from '../../../src/shared/platform/webDemoPlatform';

describe('WebDemoPlatform legal links', () => {
  const platform = new WebDemoPlatform();
  const originalWebBaseUrl = process.env.VITE_WEB_BASE_URL;

  beforeEach(() => {
    process.env.VITE_WEB_BASE_URL = 'https://staging.example.test';
  });

  afterEach(() => {
    if (originalWebBaseUrl === undefined) {
      delete process.env.VITE_WEB_BASE_URL;
    } else {
      process.env.VITE_WEB_BASE_URL = originalWebBaseUrl;
    }
  });

  it('opens legal documents on the configured override origin', async () => {
    const openMock = jest.spyOn(window, 'open').mockImplementation(() => null);

    await expect(platform.invoke('config:getWebBaseUrl')).resolves.toEqual({
      success: true,
      data: 'https://staging.example.test',
    });
    await expect(platform.invoke('legal:openDocument', { document: 'privacy' })).resolves.toEqual({
      success: true,
    });

    expect(openMock).toHaveBeenCalledWith(
      'https://staging.example.test/privacy',
      '_blank',
      'noopener,noreferrer',
    );
    openMock.mockRestore();
  });

  it('rejects unknown legal documents without opening a window', async () => {
    const openMock = jest.spyOn(window, 'open').mockImplementation(() => null);

    await expect(platform.invoke('legal:openDocument', { document: 'terms' })).resolves.toEqual({
      success: false,
      error: 'Invalid legal document',
    });

    expect(openMock).not.toHaveBeenCalled();
    openMock.mockRestore();
  });

  it('preserves the configured development port for the operator page', async () => {
    process.env.VITE_WEB_BASE_URL = 'http://localhost:3000';
    const openMock = jest.spyOn(window, 'open').mockImplementation(() => null);

    await expect(platform.invoke('legal:openDocument', { document: 'legal' })).resolves.toEqual({
      success: true,
    });

    expect(openMock).toHaveBeenCalledWith(
      'http://localhost:3000/legal',
      '_blank',
      'noopener,noreferrer',
    );
    openMock.mockRestore();
  });
});

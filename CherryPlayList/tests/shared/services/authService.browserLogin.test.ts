import { AuthHttpError } from '@cherryplay/components';
import { clearServerUrlCache } from '@shared/config/serverConfig';
import { DEMO_ACCESS_TOKEN } from '@shared/demo/demoAuthFixture';
import * as guardDemoAuth from '@shared/demo/guardDemoAuth';
import { ElectronPlatform } from '@shared/platform/electronPlatform';
import { resetPlatformForTests, setPlatform } from '@shared/platform/platformContext';
import { WebDemoPlatform } from '@shared/platform/webDemoPlatform';
import { authService, buildDesktopAuthReturnTo } from '@shared/services/authService';
import { useAuthStore } from '@shared/stores/authStore';

const getWebBaseUrlMock = jest.fn<Promise<string>, unknown[]>();
const getServerUrlMock = jest.fn<Promise<string>, unknown[]>();
const apiFetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
const mockWindowOpen = jest.fn();
const invokeMock = jest.fn<
  Promise<{ success: boolean; error?: string }>,
  [string, { url: string }]
>();

jest.mock('@shared/config/serverConfig', () => {
  const actual = jest.requireActual<typeof import('@shared/config/serverConfig')>(
    '@shared/config/serverConfig',
  );
  return {
    ...actual,
    getWebBaseUrl: (...args: unknown[]) => getWebBaseUrlMock(...args),
    getServerUrl: (...args: unknown[]) => getServerUrlMock(...args),
  };
});

jest.mock('@shared/utils/apiFetch', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...(args as [string, RequestInit?])),
}));

const mockResponse = (status: number, body: unknown): Response => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  } as Response;
};

describe('authService browser SSO', () => {
  const originalOpen = window.open.bind(window);

  beforeEach(() => {
    clearServerUrlCache();
    useAuthStore.getState().clearAuth();
    getWebBaseUrlMock.mockReset();
    getServerUrlMock.mockReset();
    apiFetchMock.mockReset();
    getWebBaseUrlMock.mockResolvedValue('https://web.example.com/');
    getServerUrlMock.mockResolvedValue('https://api.example.com');
    mockWindowOpen.mockReset();
    window.open = mockWindowOpen;
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ success: true });
    setPlatform(new ElectronPlatform(), 'electron');
    (window as unknown as { api: { invoke: jest.Mock } }).api = {
      invoke: invokeMock,
    };
  });

  afterEach(() => {
    window.open = originalOpen;
    useAuthStore.getState().clearAuth();
    resetPlatformForTests();
    delete (window as unknown as { api?: unknown }).api;
    jest.restoreAllMocks();
  });

  describe('buildDesktopAuthReturnTo', () => {
    it('uses dev callback when isDev', () => {
      expect(buildDesktopAuthReturnTo(true, 'http://localhost:5173')).toBe(
        'http://localhost:5173/auth/callback',
      );
    });

    it('uses deep link when not dev', () => {
      expect(buildDesktopAuthReturnTo(false, 'http://localhost:5173')).toBe(
        'cherryplaylist://auth',
      );
    });
  });

  describe('startBrowserLogin', () => {
    it('builds /login?client=desktop&return_to= deep link under test transform', async () => {
      await authService.startBrowserLogin();

      const call = invokeMock.mock.calls[0] as [string, { url: string }];
      expect(call[0]).toBe('auth:openExternal');
      expect(call[1].url).toMatch(/^https:\/\/web\.example\.com\/login\?client=desktop&return_to=/);
      const url = call[1].url;
      expect(url).toContain(`return_to=${encodeURIComponent('cherryplaylist://auth')}`);
    });

    it('throws when auth:openExternal fails', async () => {
      (
        window as unknown as { api: { invoke: typeof invokeMock } }
      ).api.invoke.mockResolvedValueOnce({
        success: false,
        error: 'blocked by OS',
      });

      await expect(authService.startBrowserLogin()).rejects.toThrow('blocked by OS');
    });

    it('falls back to window.open when platform missing', async () => {
      jest.spyOn(guardDemoAuth, 'isDemoAuthMode').mockReturnValue(false);
      resetPlatformForTests();

      await authService.startBrowserLogin();

      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('/login?client=desktop&return_to='),
        '_blank',
      );
    });

    it('demo mode short-circuits without opening browser', async () => {
      setPlatform(new WebDemoPlatform(), 'demo');

      await authService.startBrowserLogin();

      expect(mockWindowOpen).not.toHaveBeenCalled();
      expect(useAuthStore.getState().accessToken).toBe(DEMO_ACCESS_TOKEN);
      expect(useAuthStore.getState().organizer?.name).toBe('Demo Organizer');
    });
  });

  describe('exchangeDesktopCode', () => {
    it('POSTs { code } only and parses accessToken', async () => {
      apiFetchMock.mockResolvedValueOnce(
        mockResponse(200, { accessToken: 'desktop-access-token' }),
      );

      const token = await authService.exchangeDesktopCode('one-time-code');

      expect(token).toBe('desktop-access-token');
      expect(apiFetchMock).toHaveBeenCalledWith(
        'https://api.example.com/auth/desktop/exchange',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: 'one-time-code' }),
        }),
      );
    });

    it('throws AuthHttpError on HTTP error', async () => {
      apiFetchMock.mockResolvedValueOnce(mockResponse(400, { message: 'Invalid code' }));

      const exchange = authService.exchangeDesktopCode('bad');
      await expect(exchange).rejects.toBeInstanceOf(AuthHttpError);
      await expect(exchange).rejects.toMatchObject({ status: 400 });
    });

    it('demo exchange returns demo token', async () => {
      setPlatform(new WebDemoPlatform(), 'demo');

      const token = await authService.exchangeDesktopCode('ignored');

      expect(token).toBe(DEMO_ACCESS_TOKEN);
      expect(apiFetchMock).not.toHaveBeenCalled();
    });
  });
});

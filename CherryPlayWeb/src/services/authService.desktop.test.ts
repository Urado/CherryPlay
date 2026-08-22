/**
 * @vitest-environment jsdom
 */
import { AuthHttpError } from '@cherryplay/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '../utils/apiFetch';
import {
  DESKTOP_CLIENT_HEADER,
  DESKTOP_CLIENT_VALUE,
  setDesktopClientMode,
} from '../utils/desktopClientMode';

import { authService } from './authService';

vi.mock('../utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('authService desktop', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('login / register', () => {
    it('attaches desktop header and returns code in desktop mode', async () => {
      setDesktopClientMode(true);
      vi.mocked(apiFetch).mockResolvedValueOnce(mockJsonResponse(200, { code: 'desk-login' }));

      const code = await authService.login('a@b.c', 'secret');

      expect(code).toBe('desk-login');
      const init = vi.mocked(apiFetch).mock.calls[0]?.[1];
      const headers = init?.headers as Record<string, string>;
      expect(headers[DESKTOP_CLIENT_HEADER]).toBe(DESKTOP_CLIENT_VALUE);
    });

    it('attaches desktop header and returns code on register in desktop mode', async () => {
      setDesktopClientMode(true);
      vi.mocked(apiFetch).mockResolvedValueOnce(mockJsonResponse(200, { code: 'desk-reg' }));

      const code = await authService.register('a@b.c', 'secret', 'Name');

      expect(code).toBe('desk-reg');
      const init = vi.mocked(apiFetch).mock.calls[0]?.[1];
      const headers = init?.headers as Record<string, string>;
      expect(headers[DESKTOP_CLIENT_HEADER]).toBe(DESKTOP_CLIENT_VALUE);
    });

    it('omits desktop header and does not return code when not desktop', async () => {
      setDesktopClientMode(false);
      vi.mocked(apiFetch).mockResolvedValueOnce(mockJsonResponse(200, { code: 'ignored' }));

      const loginResult = await authService.login('a@b.c', 'secret');
      expect(loginResult).toBeUndefined();

      const loginHeaders = vi.mocked(apiFetch).mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(loginHeaders[DESKTOP_CLIENT_HEADER]).toBeUndefined();

      vi.mocked(apiFetch).mockResolvedValueOnce(mockJsonResponse(200, { code: 'ignored' }));
      const registerResult = await authService.register('a@b.c', 'secret', 'Name');
      expect(registerResult).toBeUndefined();

      const registerHeaders = vi.mocked(apiFetch).mock.calls[1]?.[1]?.headers as Record<
        string,
        string
      >;
      expect(registerHeaders[DESKTOP_CLIENT_HEADER]).toBeUndefined();
    });
  });

  describe('issueDesktopAuthCode', () => {
    it('POSTs /auth/desktop/code and returns code', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce(mockJsonResponse(200, { code: 'issued' }));

      await expect(authService.issueDesktopAuthCode()).resolves.toBe('issued');

      const [url, init] = vi.mocked(apiFetch).mock.calls[0] ?? [];
      expect(String(url)).toContain('/auth/desktop/code');
      expect(init?.method).toBe('POST');
    });

    it('throws AuthHttpError when code is empty', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce(mockJsonResponse(200, { code: '  ' }));

      await expect(authService.issueDesktopAuthCode()).rejects.toBeInstanceOf(AuthHttpError);
    });

    it('throws AuthHttpError on 401', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce(
        mockJsonResponse(401, { message: 'Unauthorized' }),
      );

      try {
        await authService.issueDesktopAuthCode();
        expect.unreachable('should throw');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthHttpError);
        expect((error as AuthHttpError).status).toBe(401);
      }
    });
  });

  describe('startOAuthFlow', () => {
    it('uses /web?client=desktop and optional return_to in desktop mode', async () => {
      setDesktopClientMode(true);
      const hrefHolder = { value: '' };
      vi.stubGlobal('location', {
        get href() {
          return hrefHolder.value;
        },
        set href(next: string) {
          hrefHolder.value = next;
        },
        search: '?return_to=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback',
      });

      await authService.startOAuthFlow('vk');

      expect(hrefHolder.value).toContain('/auth/vk/web?');
      expect(hrefHolder.value).toContain('client=desktop');
      expect(hrefHolder.value).toContain(
        'return_to=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback',
      );
    });

    it('uses plain /web when not desktop', async () => {
      setDesktopClientMode(false);
      const hrefHolder = { value: '' };
      vi.stubGlobal('location', {
        get href() {
          return hrefHolder.value;
        },
        set href(next: string) {
          hrefHolder.value = next;
        },
        search: '',
      });

      await authService.startOAuthFlow('telegram');

      expect(hrefHolder.value).toContain('/auth/telegram/web');
      expect(hrefHolder.value).not.toContain('client=desktop');
      expect(hrefHolder.value).not.toContain('?');
    });
  });
});

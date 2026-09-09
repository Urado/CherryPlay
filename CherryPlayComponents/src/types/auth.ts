import type { ConsentInput } from '../constants/legalDocuments';

export interface OrganizerDto {
  id: string;
  name: string;
  logoUrl?: string | null;
  links?: Record<string, string> | null;
  defaultPartyThemeId?: string | null;
  defaultCustomizationSettings?: Record<string, string | number> | null;
  timeZone?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export type OAuthProviderId = 'telegram' | 'vk' | 'mailru';

export interface AuthExchangeRequest {
  code: string;
  provider: string;
  deviceId?: string;
  state?: string;
}

export interface AuthExchangeResponse {
  accessToken: string;
}

export interface CreateOAuthAccountRequest {
  provider: OAuthProviderId;
  code: string;
  consents: ConsentInput[];
  redirectUri?: string;
  deviceId?: string;
}

export interface CreateOAuthAccountResponse {
  id: string;
  email: string;
  providerSubject: string;
  accessToken: string;
}

export interface DesktopAuthCodeResponse {
  code: string;
}

export interface DesktopAuthExchangeRequest {
  code: string;
}

export const DESKTOP_AUTH_DEEP_LINK_BASE = 'cherryplaylist://auth';

export function buildAuthReturnUrl(returnTo: string, code: string): string {
  const base = returnTo.trim();
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}code=${encodeURIComponent(code)}`;
}

export function buildDesktopAuthDeepLink(code: string): string {
  return buildAuthReturnUrl(DESKTOP_AUTH_DEEP_LINK_BASE, code);
}

export function isAllowedAuthReturnTo(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith(`${DESKTOP_AUTH_DEEP_LINK_BASE}`)) {
    return true;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:') {
      return false;
    }
    const hostOk = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const pathOk = url.pathname === '/auth/callback';
    const port = url.port ? Number(url.port) : 80;
    return hostOk && pathOk && [5173, 5174].includes(port);
  } catch {
    return false;
  }
}

export function resolveDesktopAuthReturnTo(value: string | null | undefined): string {
  if (isAllowedAuthReturnTo(value)) {
    return value!.trim();
  }
  return DESKTOP_AUTH_DEEP_LINK_BASE;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  consents: ConsentInput[];
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export class AuthHttpError extends Error {
  readonly status: number;

  constructor(status: number, message = '') {
    super(message);
    this.name = 'AuthHttpError';
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isAuthHttpError(error: unknown): error is AuthHttpError {
  return error instanceof AuthHttpError;
}

export function getAuthHttpStatus(error: unknown): number | undefined {
  if (isAuthHttpError(error)) {
    return error.status;
  }
  if (error !== null && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number' && Number.isFinite(status)) {
      return status;
    }
  }
  return undefined;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

export interface AuthService {
  login(email: string, password: string): Promise<string | void>;
  register(
    email: string,
    password: string,
    name: string,
    consents: ConsentInput[],
  ): Promise<string | void>;
  forgotPassword?(email: string): Promise<ForgotPasswordResponse | void>;
  resetPassword?(token: string, newPassword: string): Promise<void>;
  changePassword?(oldPassword: string, newPassword: string): Promise<void>;
  checkAuth?(): Promise<OrganizerDto | null>;
  getCurrentOrganizer?(): Promise<OrganizerDto>;
  logout?(): Promise<void>;
  startOAuthFlow?(provider: OAuthProviderId): Promise<void>;
  createOAuthAccount?(request: CreateOAuthAccountRequest): Promise<CreateOAuthAccountResponse>;
  exchangeCode?(code: string, provider: string, deviceId?: string): Promise<string>;
}

export type ForgotPasswordAuthService = {
  forgotPassword: NonNullable<AuthService['forgotPassword']>;
};

export type ResetPasswordAuthService = {
  resetPassword: NonNullable<AuthService['resetPassword']>;
};

export type ChangePasswordAuthService = {
  changePassword: NonNullable<AuthService['changePassword']>;
};

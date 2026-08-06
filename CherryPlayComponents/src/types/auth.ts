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

export interface AuthExchangeRequest {
  code: string;
  provider: string;
  deviceId?: string;
  state?: string;
}

export interface AuthExchangeResponse {
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
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

/** Structured auth failure for Web/List hosts: throw with HTTP `status` (+ `message`). Password forms map by status. */
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
  register(email: string, password: string, name: string): Promise<string | void>;
  forgotPassword?(email: string): Promise<ForgotPasswordResponse | void>;
  resetPassword?(token: string, newPassword: string): Promise<void>;
  changePassword?(oldPassword: string, newPassword: string): Promise<void>;
  checkAuth?(): Promise<OrganizerDto | null>;
  getCurrentOrganizer?(): Promise<OrganizerDto>;
  logout?(): Promise<void>;
  startOAuthFlow?(provider: 'telegram' | 'vk' | 'mailru'): Promise<void>;
  exchangeCode?(code: string, provider: string, deviceId?: string): Promise<string>;
}

/** Host must throw AuthHttpError (status) on HTTP failure when status is known. */
export type ForgotPasswordAuthService = {
  forgotPassword: NonNullable<AuthService['forgotPassword']>;
};

/** Host must throw AuthHttpError (status) on HTTP failure when status is known. */
export type ResetPasswordAuthService = {
  resetPassword: NonNullable<AuthService['resetPassword']>;
};

/** Host must throw AuthHttpError (status) on HTTP failure when status is known. */
export type ChangePasswordAuthService = {
  changePassword: NonNullable<AuthService['changePassword']>;
};

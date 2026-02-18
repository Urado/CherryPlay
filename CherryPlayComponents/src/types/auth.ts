/**
 * Authentication-related types
 * Shared between CherryPlayWeb and CherryPlayList
 */

export interface OrganizerDto {
  id: string;
  name: string;
  logoUrl?: string | null;
  links?: Record<string, string> | null;
  defaultThemeId?: string | null;
  defaultCustomizationSettings?: Record<string, string | number> | null;
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

/**
 * Auth service interface for dependency injection
 */
export interface AuthService {
  login(email: string, password: string): Promise<string | void>;
  register(email: string, password: string, name: string): Promise<string | void>;
  checkAuth?(): Promise<OrganizerDto | null>;
  getCurrentOrganizer?(): Promise<OrganizerDto>;
  logout?(): Promise<void>;
  startOAuthFlow?(provider: 'telegram' | 'vk' | 'mailru'): Promise<void>;
  exchangeCode?(code: string, provider: string, deviceId?: string): Promise<string>;
}

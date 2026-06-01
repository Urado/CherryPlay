import { getAppMode } from '../platform';

export function isDemoAuthMode(): boolean {
  return getAppMode() === 'demo';
}

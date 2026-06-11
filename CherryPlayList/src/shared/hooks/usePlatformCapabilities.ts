import { useMemo } from 'react';

import {
  getPlatformCapabilities,
  type PlatformCapabilities,
} from '../platform/platformCapabilities';

/** Stable snapshot of platform capabilities for React components (mode does not change at runtime). */
export function usePlatformCapabilities(): PlatformCapabilities {
  return useMemo(() => getPlatformCapabilities(), []);
}

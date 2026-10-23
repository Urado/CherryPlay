import { useMemo } from 'react';

import {
  getPlatformCapabilities,
  type PlatformCapabilities,
} from '../platform/platformCapabilities';

export const usePlatformCapabilities = (): PlatformCapabilities => {
  return useMemo(() => getPlatformCapabilities(), []);
};

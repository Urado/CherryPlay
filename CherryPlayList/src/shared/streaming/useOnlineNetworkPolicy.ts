import { useSettingsStore } from '@shared/stores/settingsStore';
import { useMemo } from 'react';

import { getOnlineNetworkPolicy, type OnlineNetworkPolicy } from './onlineNetworkPolicy';

export const useOnlineNetworkPolicy = (): OnlineNetworkPolicy => {
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  return useMemo(() => getOnlineNetworkPolicy({ enableStreaming }), [enableStreaming]);
};

import { useSettingsStore } from '@shared/stores';
import { useMemo } from 'react';


import { getOnlineNetworkPolicy, type OnlineNetworkPolicy } from './onlineNetworkPolicy';

export function useOnlineNetworkPolicy(): OnlineNetworkPolicy {
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  return useMemo(() => getOnlineNetworkPolicy({ enableStreaming }), [enableStreaming]);
}

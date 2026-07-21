import { useMemo } from 'react';

import { useSettingsStore } from '@shared/stores';

import { getOnlineNetworkPolicy, type OnlineNetworkPolicy } from './onlineNetworkPolicy';

/** Reactive snapshot of internal online/network policy (not user-facing beyond «Онлайн»). */
export function useOnlineNetworkPolicy(): OnlineNetworkPolicy {
  const enableStreaming = useSettingsStore((state) => state.enableStreaming);
  return useMemo(() => getOnlineNetworkPolicy({ enableStreaming }), [enableStreaming]);
}

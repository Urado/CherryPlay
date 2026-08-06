import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { usePartyWorkspaceRuntime } from './usePartyWorkspace';

export type PartyWorkspaceRuntimeValue = ReturnType<typeof usePartyWorkspaceRuntime>;

const PartyWorkspaceRuntimeContext = createContext<PartyWorkspaceRuntimeValue | null>(null);

const providerRegistry = new Set<symbol>();
const providerElectionListeners = new Set<() => void>();

function notifyProviderElection() {
  providerElectionListeners.forEach((listener) => listener());
}

const runtimeStore = {
  runtime: null as PartyWorkspaceRuntimeValue | null,
  epoch: 0,
};

const runtimeStoreListeners = new Set<() => void>();

function subscribeRuntimeStore(listener: () => void) {
  runtimeStoreListeners.add(listener);
  return () => runtimeStoreListeners.delete(listener);
}

function getRuntimeStoreEpoch() {
  return runtimeStore.epoch;
}

function setSharedRuntime(runtime: PartyWorkspaceRuntimeValue | null) {
  if (runtimeStore.runtime === runtime) {
    return;
  }
  runtimeStore.runtime = runtime;
  runtimeStore.epoch += 1;
  runtimeStoreListeners.forEach((listener) => listener());
}

function PartyWorkspaceRuntimeHost() {
  const runtime = usePartyWorkspaceRuntime();

  useLayoutEffect(() => {
    setSharedRuntime(runtime);
  }, [runtime]);

  useEffect(() => {
    return () => {
      setSharedRuntime(null);
    };
  }, []);

  return null;
}

function useIsElectedHost(): boolean {
  const providerIdRef = useRef(Symbol('party-workspace-runtime-provider'));
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const providerId = providerIdRef.current;

    const updateElection = () => {
      const first = providerRegistry.values().next().value;
      setIsHost(first === providerId);
    };

    providerRegistry.add(providerId);
    providerElectionListeners.add(updateElection);
    updateElection();

    return () => {
      providerRegistry.delete(providerId);
      providerElectionListeners.delete(updateElection);
      notifyProviderElection();
    };
  }, []);

  return isHost;
}

/**
 * Shares one `usePartyWorkspaceRuntime` instance when Party Editor and Preview
 * zones are mounted together. The first mounted provider runs the runtime hook;
 * siblings consume the published runtime via context.
 */
export function PartyWorkspaceRuntimeProvider({ children }: { children: React.ReactNode }) {
  useSyncExternalStore(subscribeRuntimeStore, getRuntimeStoreEpoch, getRuntimeStoreEpoch);
  const isHost = useIsElectedHost();
  const runtime = runtimeStore.runtime;

  return (
    <>
      {isHost ? <PartyWorkspaceRuntimeHost /> : null}
      {runtime ? (
        <PartyWorkspaceRuntimeContext.Provider value={runtime}>
          {children}
        </PartyWorkspaceRuntimeContext.Provider>
      ) : null}
    </>
  );
}

export function usePartyWorkspaceRuntimeContext(): PartyWorkspaceRuntimeValue {
  const context = useContext(PartyWorkspaceRuntimeContext);
  if (!context) {
    throw new Error(
      'usePartyWorkspaceRuntimeContext must be used within PartyWorkspaceRuntimeProvider',
    );
  }
  return context;
}

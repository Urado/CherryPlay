import { partyService, type CreatePartyDto } from '@shared/services/partyService';

import type { PartyWorkspaceState } from './partyWorkspaceStore';
import { ERROR_CONNECTION } from './partyWorkspaceUtils';

const ERROR_PARTY_CREATED_THEME_ACCESS_FAILED =
  'Вечеринка создана, но не удалось обновить доступ к темам. Попробуйте обновить или переподключиться.';
const ERROR_PARTY_CREATED_URL_FAILED =
  'Вечеринка создана, но не удалось получить ссылку. Попробуйте обновить или переподключиться.';

type PartyStore = PartyWorkspaceState;

export type FinalizePartyCreationDeps = {
  loadThemeAccess: (forceRefresh?: boolean) => Promise<void>;
  checkPartyExists: (partyId: string) => Promise<boolean>;
  setLinkedParty: (party: { id: string; shortCode: string; url: string }) => void;
  markAsDirty: () => void;
  addNotification: (notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
  }) => void;
};

export type HandlePartyCreationFailureDeps = {
  addNotification: FinalizePartyCreationDeps['addNotification'];
  startReconnectTimer: (linkedParty: { id: string; shortCode: string } | null) => void;
};

export async function finalizePartyCreation(
  store: PartyStore,
  createData: CreatePartyDto,
  successMessage: string,
  deps: FinalizePartyCreationDeps,
): Promise<void> {
  const party = await partyService.createParty(createData);

  try {
    await deps.loadThemeAccess(true);
  } catch (error) {
    console.error('Failed to load theme access after party creation:', error);
    deps.addNotification({ type: 'error', message: ERROR_PARTY_CREATED_THEME_ACCESS_FAILED });
    return;
  }

  const exists = await deps.checkPartyExists(party.id);
  if (!exists) {
    deps.addNotification({
      type: 'error',
      message: 'Вечеринка создана, но сервер недоступен',
    });
    return;
  }

  let url: string;
  try {
    url = await partyService.getPartyUrl(party.shortCode);
  } catch (error) {
    console.error('Failed to get party URL after creation:', error);
    deps.addNotification({ type: 'error', message: ERROR_PARTY_CREATED_URL_FAILED });
    return;
  }

  deps.setLinkedParty({ id: party.id, shortCode: party.shortCode, url });
  store.setPartyVerified(true);
  store.setPartyLifecycleState(party.partyLifecycleState);
  store.setIsListedInCatalog(party.isListedInCatalog ?? createData.isListedInCatalog ?? false);
  deps.markAsDirty();
  deps.addNotification({ type: 'success', message: successMessage });
}

export async function handlePartyCreationFailure(
  store: PartyStore,
  deps: HandlePartyCreationFailureDeps,
  errorMessage: string,
): Promise<void> {
  const reachable = await partyService.checkServerReachable();
  if (!reachable) {
    store.setServerUnreachable(true);
    deps.startReconnectTimer(null);
  } else {
    store.setServerError(ERROR_CONNECTION);
  }
  store.setPartyVerified(false);
  deps.addNotification({ type: 'error', message: errorMessage });
}

import {
  Button,
  Disclosure,
  formatDateInTimeZone,
  getDefaultTimeZone,
  IconButton,
  sortPartiesByEventDateDesc,
} from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useModalKeyboard } from '@shared/hooks';
import {
  InvalidPartyLifecycleTransitionError,
  partyService,
  type PartyDto,
  type PartyLifecycleState,
} from '@shared/services/partyService';
import {
  useAimpStore,
  useAuthStore,
  useClientOutdatedStore,
  usePlayerAudioStore,
  useProjectStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming/useOnlineNetworkPolicy';
import { PartyLifecycleControls } from '@workspaces/party/components/PartyLifecycleControls';
import {
  resolvePartyCatalogLabel,
  resolvePartyCatalogToggleHint,
} from '@workspaces/party/partyCatalogLabels';
import { resolvePartyLifecycleServerBadgeLabel } from '@workspaces/party/partyEditorPhase';
import { markPartyPublishCatalogVisibilitySynced } from '@workspaces/party/partyPublishSync';
import { partyWorkspaceOneShotGuards } from '@workspaces/party/partyWorkspaceReconnectRefs';
import { resetPartyLinkState, usePartyWorkspaceStore } from '@workspaces/party/partyWorkspaceStore';
import {
  PARTY_ARCHIVE_CONFIRM_MESSAGE,
  resolvePartyArchiveAvailability,
} from '@workspaces/party/resolvePartyArchiveAvailability';

function syncLinkedPartyWorkspaceFields(party: PartyDto): void {
  const store = usePartyWorkspaceStore.getState();
  if (party.name) {
    store.setPartyName(party.name);
  }
  store.setPartyLifecycleState(party.partyLifecycleState);
  store.setIsListedInCatalog(party.isListedInCatalog ?? false);
}

export const MyPartiesList: React.FC = () => {
  const { addNotification } = useUIStore();
  const linkedParty = useProjectStore((state) => state.meta.linkedParty);
  const sessionMode = useProjectStore((state) => state.sessionState.mode);
  const setLinkedParty = useProjectStore((state) => state.setLinkedParty);
  const markAsDirty = useProjectStore((state) => state.markAsDirty);
  const playbackStatus = usePlayerAudioStore((state) => state.status);
  const streamingSource = useSettingsStore((state) => state.streamingSource);
  const aimpLiveStreamStarted = useAimpStore((state) => state.bridgeState.liveStreamStarted);
  const aimpPlaybackStatus = useAimpStore(
    (state) => state.bridgeState.playbackSnapshot?.status ?? null,
  );

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const { networkEnabled } = useOnlineNetworkPolicy();
  const { isOutdated: isClientOutdated } = useClientOutdatedStore();

  const [parties, setParties] = useState<PartyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bindingId, setBindingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [transitioningTarget, setTransitioningTarget] = useState<PartyLifecycleState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartyDto | null>(null);

  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement | null>(null);

  const loadParties = useCallback(async () => {
    if (!isAuthenticated || !networkEnabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await partyService.getParties();
      setParties(sortPartiesByEventDateDesc(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить список вечеринок');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, networkEnabled]);

  useEffect(() => {
    void loadParties();
  }, [loadParties]);

  useEffect(() => {
    if (!deleteTarget) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      deleteCancelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [deleteTarget]);

  const restoreDeleteTriggerFocus = useCallback(() => {
    const trigger = deleteTriggerRef.current;
    deleteTriggerRef.current = null;
    if (trigger?.isConnected) {
      queueMicrotask(() => {
        trigger.focus();
      });
    }
  }, []);

  const handleDeleteDismiss = useCallback(() => {
    setDeleteTarget(null);
    restoreDeleteTriggerFocus();
  }, [restoreDeleteTriggerFocus]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || !networkEnabled) {
      return;
    }

    const party = deleteTarget;
    setDeletingId(party.id);
    try {
      await partyService.deleteParty(party.id);
      setParties((current) => current.filter((item) => item.id !== party.id));

      if (linkedParty?.id === party.id) {
        resetPartyLinkState();
        partyWorkspaceOneShotGuards.loadedPartyMetadataId = null;
        setLinkedParty(null);
        markAsDirty();
      }

      setDeleteTarget(null);
      deleteTriggerRef.current = null;
    } catch (e) {
      addNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Не удалось удалить вечеринку',
      });
    } finally {
      setDeletingId(null);
    }
  }, [addNotification, deleteTarget, linkedParty?.id, markAsDirty, networkEnabled, setLinkedParty]);

  const { handleOverlayKeyDown: handleDeleteOverlayKeyDown } = useModalKeyboard({
    enabled: deleteTarget !== null,
    onCancel: handleDeleteDismiss,
    onPrimary: () => {
      void handleDeleteConfirm();
    },
    primaryDisabled: deletingId !== null,
  });

  if (isClientOutdated) {
    return null;
  }

  const handleOpenDeleteConfirm = (party: PartyDto, trigger: HTMLButtonElement) => {
    deleteTriggerRef.current = trigger;
    setDeleteTarget(party);
  };

  const handleBind = async (party: PartyDto) => {
    if (!networkEnabled) {
      return;
    }
    setBindingId(party.id);
    try {
      const url = await partyService.getPartyUrl(party.shortCode);
      partyWorkspaceOneShotGuards.loadedPartyMetadataId = null;
      setLinkedParty({ id: party.id, shortCode: party.shortCode, url });
      syncLinkedPartyWorkspaceFields(party);
      markAsDirty();
    } catch (e) {
      addNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Ошибка при привязке к вечеринке',
      });
    } finally {
      setBindingId(null);
    }
  };

  const handleToggleListed = async (party: PartyDto, listed: boolean) => {
    if (!networkEnabled) {
      return;
    }
    const previous = party.isListedInCatalog ?? false;
    if (previous === listed) {
      return;
    }

    setTogglingId(party.id);
    setParties((current) =>
      current.map((item) => (item.id === party.id ? { ...item, isListedInCatalog: listed } : item)),
    );

    try {
      await partyService.updateParty(party.id, { isListedInCatalog: listed });
      if (linkedParty?.id === party.id) {
        usePartyWorkspaceStore.getState().setIsListedInCatalog(listed);
        markPartyPublishCatalogVisibilitySynced(listed);
      }
    } catch (e) {
      setParties((current) =>
        current.map((item) =>
          item.id === party.id ? { ...item, isListedInCatalog: previous } : item,
        ),
      );
      addNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Не удалось изменить видимость в каталоге',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleLifecycleTransition = async (party: PartyDto, targetState: PartyLifecycleState) => {
    if (!networkEnabled) {
      return;
    }

    if (targetState === 'completed') {
      const isCurrentLinked = linkedParty?.id === party.id;
      if (isCurrentLinked) {
        const availability = resolvePartyArchiveAvailability({
          partyLifecycleState: party.partyLifecycleState,
          sessionMode,
          playbackStatus: sessionMode === 'session' ? playbackStatus : null,
          aimpLiveStreamStarted,
          aimpPlaybackStatus,
          streamingSource,
        });
        if (availability.isBlockedByLive) {
          window.alert(
            availability.blockedExplanation ?? 'Сейчас нельзя отправить вечеринку в архив',
          );
          return;
        }
      }
      if (!window.confirm(PARTY_ARCHIVE_CONFIRM_MESSAGE)) {
        return;
      }
    }

    setTransitioningId(party.id);
    setTransitioningTarget(targetState);
    try {
      const updated = await partyService.transitionPartyLifecycle(party.id, targetState);
      setParties((current) => current.map((item) => (item.id === party.id ? updated : item)));
      if (linkedParty?.id === party.id) {
        syncLinkedPartyWorkspaceFields(updated);
      }
    } catch (e) {
      addNotification({
        type: 'error',
        message:
          e instanceof InvalidPartyLifecycleTransitionError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Не удалось изменить статус вечеринки',
      });
    } finally {
      setTransitioningId(null);
      setTransitioningTarget(null);
    }
  };

  const networkActionsDisabled = !networkEnabled;
  const showOfflineStub = !networkEnabled;
  const networkDisabledTitle = 'Включите «Онлайн» в настройках';

  return (
    <>
      <section className="account-disclosure-card" aria-label="Мои вечеринки">
        <Disclosure title="Мои вечеринки" className="account-disclosure" defaultExpanded={false}>
          {!isAuthenticated ? (
            <div className="my-parties-panel-auth-stub" role="status">
              <p className="my-parties-panel-auth-stub-text">
                Для управления вечеринками необходимо войти в аккаунт.
              </p>
            </div>
          ) : (
            <>
              {showOfflineStub && (
                <div className="my-parties-panel-offline-stub" role="status" aria-live="polite">
                  <span className="my-parties-panel-offline-stub-title">
                    Онлайн-функции отключены
                  </span>
                  <span className="my-parties-panel-offline-stub-hint">
                    Включите «Онлайн» в настройках для загрузки списка и действий с сервером.
                  </span>
                </div>
              )}

              {loading && (
                <div className="my-parties-panel-loading">Загрузка списка вечеринок...</div>
              )}
              {error && (
                <div className="my-parties-panel-error" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && networkEnabled && parties.length === 0 && (
                <div className="my-parties-panel-empty">У вас пока нет вечеринок на сервере.</div>
              )}
              {!loading && !error && parties.length > 0 && (
                <ul className="my-parties-panel-list" aria-label="Список вечеринок">
                  {parties.map((party) => {
                    const isLinked = linkedParty?.id === party.id;
                    const isListed = party.isListedInCatalog ?? false;
                    const canToggleCatalog =
                      party.partyLifecycleState === 'ready' ||
                      party.partyLifecycleState === 'completed';
                    const isRowBusy =
                      bindingId === party.id ||
                      deletingId === party.id ||
                      togglingId === party.id ||
                      transitioningId === party.id;

                    return (
                      <li
                        key={party.id}
                        className={`my-parties-panel-item${isLinked ? ' my-parties-panel-item--linked' : ''}`}
                      >
                        <div className="my-parties-panel-item-main">
                          <div className="my-parties-panel-item-info">
                            <span className="my-parties-panel-item-name">{party.name}</span>
                            <span className="my-parties-panel-item-code">
                              Код: {party.shortCode}
                            </span>
                            {party.eventDateTime ? (
                              <span className="my-parties-panel-item-date">
                                {formatDateInTimeZone(
                                  party.eventDateTime,
                                  party.timeZone ?? getDefaultTimeZone(),
                                )}
                              </span>
                            ) : null}
                          </div>

                          <div className="my-parties-panel-item-badges">
                            <span className="my-parties-panel-badge my-parties-panel-badge--lifecycle">
                              {resolvePartyLifecycleServerBadgeLabel(
                                party.partyLifecycleState,
                                isLinked ? sessionMode : undefined,
                              )}
                            </span>
                            {isLinked && (
                              <span className="my-parties-panel-badge my-parties-panel-badge--linked">
                                Привязана
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="my-parties-panel-item-actions">
                          <PartyLifecycleControls
                            partyLifecycleState={party.partyLifecycleState}
                            layout="header"
                            sessionMode={isLinked ? sessionMode : undefined}
                            hideUnarchive
                            isTransitioning={transitioningId === party.id}
                            pendingTransition={
                              transitioningId === party.id ? transitioningTarget : null
                            }
                            disabled={
                              networkActionsDisabled ||
                              bindingId === party.id ||
                              deletingId === party.id ||
                              togglingId === party.id
                            }
                            onTransition={(targetState) =>
                              void handleLifecycleTransition(party, targetState)
                            }
                          />

                          {canToggleCatalog ? (
                            <Button
                              type="button"
                              className={`my-parties-panel-catalog-toggle-btn${isListed ? ' my-parties-panel-catalog-toggle-btn--listed' : ''}`}
                              disabled={networkActionsDisabled || isRowBusy}
                              loading={togglingId === party.id}
                              aria-pressed={isListed}
                              aria-label={`Каталог: ${resolvePartyCatalogLabel(isListed)}`}
                              title={
                                networkActionsDisabled
                                  ? networkDisabledTitle
                                  : resolvePartyCatalogToggleHint(isListed)
                              }
                              onClick={() => void handleToggleListed(party, !isListed)}
                              variant="secondary"
                              size="sm"
                            >
                              {resolvePartyCatalogLabel(isListed)}
                            </Button>
                          ) : null}

                          <Button
                            type="button"
                            className="modal-button my-parties-panel-bind-btn"
                            onClick={() => void handleBind(party)}
                            disabled={networkActionsDisabled || isRowBusy || isLinked}
                            loading={bindingId === party.id}
                            title={
                              networkActionsDisabled
                                ? networkDisabledTitle
                                : isLinked
                                  ? 'Уже привязана к проекту'
                                  : `Привязать к проекту: ${party.name}`
                            }
                            aria-label={`Привязать к проекту: ${party.name}`}
                            variant="primary"
                            size="sm"
                            startIcon={<LinkOutlinedIcon fontSize="small" />}
                          >
                            Привязать
                          </Button>

                          <IconButton
                            type="button"
                            className="modal-button my-parties-panel-delete-btn"
                            onClick={(event) => handleOpenDeleteConfirm(party, event.currentTarget)}
                            disabled={networkActionsDisabled || isRowBusy}
                            title={networkActionsDisabled ? networkDisabledTitle : 'Удалить'}
                            aria-label={`Удалить вечеринку ${party.name}`}
                            variant="ghost"
                            size="sm"
                            icon={<DeleteOutlineIcon fontSize="small" />}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </Disclosure>
      </section>

      {deleteTarget && (
        <div
          className="modal-overlay my-parties-panel-delete-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleDeleteDismiss();
            }
          }}
          onKeyDown={handleDeleteOverlayKeyDown}
          role="presentation"
        >
          <div
            className="modal-content workspace-delete-dialog"
            role="alertdialog"
            aria-modal
            aria-labelledby="my-parties-delete-title"
            aria-describedby="my-parties-delete-description"
          >
            <div className="modal-header">
              <h2 className="modal-title" id="my-parties-delete-title">
                Удалить вечеринку?
              </h2>
              <IconButton
                className="modal-close"
                type="button"
                onClick={handleDeleteDismiss}
                aria-label="Закрыть"
                icon={<CloseIcon />}
                variant="ghost"
                size="md"
              ></IconButton>
            </div>

            <div className="modal-body">
              <p className="workspace-delete-dialog__message" id="my-parties-delete-description">
                Вечеринка «{deleteTarget.name}» будет удалена с сервера без возможности
                восстановления.
              </p>
            </div>

            <div className="modal-footer">
              <Button
                ref={deleteCancelRef}
                className="modal-button"
                type="button"
                onClick={handleDeleteDismiss}
                disabled={deletingId !== null}
                variant="secondary"
                size="sm"
              >
                Отмена
              </Button>
              <Button
                className="modal-button"
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={deletingId !== null}
                loading={deletingId !== null}
                loadingLabel="Удаление..."
                variant="danger"
                size="sm"
              >
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import {
  formatDateInTimeZone,
  getDefaultTimeZone,
  sortPartiesByEventDateDesc,
} from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import React, { useCallback, useEffect, useState } from 'react';

import { OnlineUnavailablePanel } from '@shared/components';
import { useModalKeyboard } from '@shared/hooks';
import { partyService, type PartyDto } from '@shared/services/partyService';
import { useAuthStore, useClientOutdatedStore, useProjectStore, useUIStore } from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming/useOnlineNetworkPolicy';
import { PARTY_EDITOR_LIFECYCLE_BADGE_LABELS } from '@workspaces/party/partyEditorPhase';
import { partyWorkspaceOneShotGuards } from '@workspaces/party/partyWorkspaceReconnectRefs';
import { resetPartyLinkState, usePartyWorkspaceStore } from '@workspaces/party/partyWorkspaceStore';

function syncLinkedPartyWorkspaceFields(party: PartyDto): void {
  const store = usePartyWorkspaceStore.getState();
  if (party.name) {
    store.setPartyName(party.name);
  }
  store.setPartyLifecycleState(party.partyLifecycleState);
  store.setIsListedInCatalog(party.isListedInCatalog ?? false);
}

export const MyPartiesPanel: React.FC = () => {
  const { modal, closeModal, openModal, addNotification } = useUIStore();
  const linkedParty = useProjectStore((state) => state.meta.linkedParty);
  const setLinkedParty = useProjectStore((state) => state.setLinkedParty);
  const markAsDirty = useProjectStore((state) => state.markAsDirty);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const { networkEnabled } = useOnlineNetworkPolicy();
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();

  const [parties, setParties] = useState<PartyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bindingId, setBindingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartyDto | null>(null);

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
    if (modal === 'myParties') {
      void loadParties();
    } else {
      setDeleteTarget(null);
    }
  }, [modal, loadParties]);

  const handleCancel = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const handleDeleteDismiss = useCallback(() => {
    setDeleteTarget(null);
  }, []);

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

      addNotification({
        type: 'success',
        message: `Вечеринка «${party.name}» удалена`,
      });
      setDeleteTarget(null);
    } catch (e) {
      addNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Не удалось удалить вечеринку',
      });
    } finally {
      setDeletingId(null);
    }
  }, [addNotification, deleteTarget, linkedParty?.id, markAsDirty, networkEnabled, setLinkedParty]);

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: modal === 'myParties' && !deleteTarget,
    onCancel: handleCancel,
  });

  const { handleOverlayKeyDown: handleDeleteOverlayKeyDown } = useModalKeyboard({
    enabled: modal === 'myParties' && deleteTarget !== null,
    onCancel: handleDeleteDismiss,
    onPrimary: () => {
      void handleDeleteConfirm();
    },
    primaryDisabled: deletingId !== null,
  });

  if (modal !== 'myParties') {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  const handleOpenAccount = () => {
    openModal('account');
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
      addNotification({
        type: 'success',
        message: `Проект привязан к вечеринке «${party.name}»`,
      });
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
      }
      addNotification({
        type: 'success',
        message: listed ? 'Вечеринка добавлена в каталог' : 'Вечеринка доступна только по ссылке',
      });
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

  const networkActionsDisabled = !networkEnabled;
  const networkDisabledTitle = 'Включите «Онлайн» в настройках';

  return (
    <>
      <div
        className="modal-overlay"
        onClick={handleOverlayClick}
        onKeyDown={handleOverlayKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Закрыть окно «Мои вечеринки»"
      >
        <div className="modal-content my-parties-panel-content">
          <div className="modal-header">
            <h2 className="modal-title">Мои вечеринки</h2>
            <button
              type="button"
              className="modal-close"
              onClick={handleCancel}
              aria-label="Закрыть"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="modal-body">
            {isClientOutdated ? (
              <OnlineUnavailablePanel reason="outdated" requiredVersion={clientRequiredVersion} />
            ) : !isAuthenticated ? (
              <div className="my-parties-panel-auth-stub" role="status">
                <p className="my-parties-panel-auth-stub-text">
                  Для управления вечеринками необходимо войти в аккаунт.
                </p>
                <button type="button" className="modal-button primary" onClick={handleOpenAccount}>
                  Войти
                </button>
              </div>
            ) : (
              <>
                {networkActionsDisabled && (
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
                      const isRowBusy =
                        bindingId === party.id ||
                        deletingId === party.id ||
                        togglingId === party.id;

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
                                {PARTY_EDITOR_LIFECYCLE_BADGE_LABELS[party.partyLifecycleState]}
                              </span>
                              <span
                                className={`my-parties-panel-badge my-parties-panel-badge--catalog${isListed ? ' my-parties-panel-badge--listed' : ''}`}
                              >
                                {isListed ? 'В каталоге' : 'По ссылке'}
                              </span>
                              {isLinked && (
                                <span className="my-parties-panel-badge my-parties-panel-badge--linked">
                                  Привязана
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="my-parties-panel-item-actions">
                            <button
                              type="button"
                              className={`my-parties-panel-catalog-toggle-btn${isListed ? ' my-parties-panel-catalog-toggle-btn--listed' : ''}`}
                              disabled={networkActionsDisabled || isRowBusy}
                              aria-pressed={isListed}
                              aria-label={`Каталог: ${isListed ? 'В каталоге' : 'По ссылке'}`}
                              title={
                                networkActionsDisabled
                                  ? networkDisabledTitle
                                  : isListed
                                    ? 'В каталоге. Нажмите, чтобы оставить только по ссылке.'
                                    : 'По ссылке. Нажмите, чтобы добавить в каталог.'
                              }
                              onClick={() => void handleToggleListed(party, !isListed)}
                            >
                              {isListed ? 'В каталоге' : 'По ссылке'}
                            </button>

                            <button
                              type="button"
                              className="modal-button primary my-parties-panel-bind-btn"
                              onClick={() => void handleBind(party)}
                              disabled={networkActionsDisabled || isRowBusy || isLinked}
                              title={
                                networkActionsDisabled
                                  ? networkDisabledTitle
                                  : isLinked
                                    ? 'Уже привязана к проекту'
                                    : `Привязать к проекту: ${party.name}`
                              }
                              aria-label={`Привязать к проекту: ${party.name}`}
                            >
                              <LinkIcon fontSize="small" />
                              {bindingId === party.id ? 'Привязка...' : 'Привязать'}
                            </button>

                            <button
                              type="button"
                              className="modal-button danger my-parties-panel-delete-btn"
                              onClick={() => setDeleteTarget(party)}
                              disabled={networkActionsDisabled || isRowBusy}
                              title={networkActionsDisabled ? networkDisabledTitle : 'Удалить'}
                              aria-label={`Удалить вечеринку ${party.name}`}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="modal-button secondary" onClick={handleCancel}>
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div
          className="modal-overlay my-parties-panel-delete-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleDeleteDismiss();
            }
          }}
          onKeyDown={handleDeleteOverlayKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Закрыть подтверждение удаления"
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
              <button
                className="modal-close"
                type="button"
                onClick={handleDeleteDismiss}
                aria-label="Закрыть"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <p className="workspace-delete-dialog__message" id="my-parties-delete-description">
                Вечеринка «{deleteTarget.name}» будет удалена с сервера без возможности
                восстановления.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="modal-button secondary"
                type="button"
                onClick={handleDeleteDismiss}
                disabled={deletingId !== null}
              >
                Отмена
              </button>
              <button
                className="modal-button danger"
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

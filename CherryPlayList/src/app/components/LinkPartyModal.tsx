import {
  Button,
  formatDateInTimeZone,
  getDefaultTimeZone,
  IconButton,
  sortPartiesByEventDateDesc,
} from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import React, { useState, useEffect, useCallback } from 'react';

import { OnlineUnavailablePanel } from '@shared/components';
import { useModalKeyboard } from '@shared/hooks';
import { partyService } from '@shared/services/partyService';
import type { PartyDto } from '@shared/services/partyService';
import { useClientOutdatedStore, useProjectStore, useUIStore } from '@shared/stores';
import { convertPlaylistForApi } from '@shared/utils';

export const LinkPartyModal: React.FC = () => {
  const { modal, closeModal, addNotification } = useUIStore();
  const items = useProjectStore((state) => state.items);
  const partyTrackDisplay = useProjectStore((state) => state.meta.partyTrackDisplay);
  const setLinkedParty = useProjectStore((state) => state.setLinkedParty);
  const markAsDirty = useProjectStore((state) => state.markAsDirty);

  const [parties, setParties] = useState<PartyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [uploadPlaylist, setUploadPlaylist] = useState(true);
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();

  const loadParties = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (modal === 'linkParty') {
      loadParties();
    }
  }, [modal, loadParties]);

  const handleCancel = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: modal === 'linkParty',
    onCancel: handleCancel,
  });

  if (modal !== 'linkParty') {
    return null;
  }

  const handleLink = async (party: PartyDto) => {
    setLinkingId(party.id);
    try {
      const url = await partyService.getPartyUrl(party.shortCode);
      const partyData = { id: party.id, shortCode: party.shortCode, url };
      setLinkedParty(partyData);
      markAsDirty();

      if (uploadPlaylist && items.length > 0) {
        const playlistForApi = convertPlaylistForApi(items, partyTrackDisplay);
        await partyService.updatePartyPlaylist(party.id, playlistForApi);
      }
      closeModal();
    } catch (e) {
      addNotification({
        type: 'error',
        message: e instanceof Error ? e.message : 'Ошибка при привязке к вечеринке',
      });
    } finally {
      setLinkingId(null);
    }
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Закрыть окно привязки к вечеринке"
    >
      <div className="modal-content link-party-modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Привязать существующую вечеринку</h2>
          <IconButton
            type="button"
            className="modal-close"
            onClick={handleCancel}
            aria-label="Закрыть"
            icon={<CloseIcon />}
            variant="ghost"
            size="md"
          />
        </div>

        <div className="modal-body">
          {isClientOutdated ? (
            <OnlineUnavailablePanel reason="outdated" requiredVersion={clientRequiredVersion} />
          ) : (
            <>
              <p className="link-party-modal-description">
                Выберите вечеринку, уже созданную на сервере, чтобы привязать её к текущему проекту.
                Новая вечеринка не создаётся, трансляция не запускается.
              </p>

              {loading && (
                <div className="link-party-modal-loading">Загрузка списка вечеринок...</div>
              )}
              {error && (
                <div className="link-party-modal-error" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && parties.length === 0 && (
                <div className="link-party-modal-empty">У вас пока нет вечеринок на сервере.</div>
              )}
              {!loading && !error && parties.length > 0 && (
                <>
                  <label className="link-party-modal-checkbox">
                    <input
                      type="checkbox"
                      checked={uploadPlaylist}
                      onChange={(e) => setUploadPlaylist(e.target.checked)}
                    />
                    <span>Сразу отправить текущий плейлист на сервер</span>
                  </label>
                  <ul className="link-party-modal-list" aria-label="Список вечеринок">
                    {parties.map((party) => (
                      <li key={party.id} className="link-party-modal-item">
                        <div className="link-party-modal-item-info">
                          <span className="link-party-modal-item-name">{party.name}</span>
                          <span className="link-party-modal-item-code">Код: {party.shortCode}</span>
                          {party.eventDateTime ? (
                            <span className="link-party-modal-item-date">
                              {formatDateInTimeZone(
                                party.eventDateTime,
                                party.timeZone ?? getDefaultTimeZone(),
                              )}
                            </span>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          className="modal-button link-party-modal-link-btn"
                          onClick={() => handleLink(party)}
                          disabled={linkingId !== null}
                          loading={linkingId === party.id}
                          loadingLabel="Привязка..."
                          aria-label={`Привязать вечеринку ${party.name}`}
                          title="Привязать эту вечеринку на сервере к текущему проекту"
                          variant="primary"
                          size="sm"
                          startIcon={<LinkOutlinedIcon fontSize="small" />}
                        >
                          Привязать
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <Button
            type="button"
            className="modal-button"
            onClick={handleCancel}
            variant="secondary"
            size="sm"
          >
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
};

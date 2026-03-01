import { formatDateInTimeZone, getDefaultTimeZone } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import React, { useState, useEffect, useCallback } from 'react';

import { partyService } from '@shared/services/partyService';
import type { PartyDto } from '@shared/services/partyService';
import { useProjectStore, useUIStore } from '@shared/stores';
import { convertPlaylistForApi } from '@shared/utils';

export const LinkPartyModal: React.FC = () => {
  const { modal, closeModal, addNotification } = useUIStore();
  const items = useProjectStore((state) => state.items);
  const setLinkedParty = useProjectStore((state) => state.setLinkedParty);
  const markAsDirty = useProjectStore((state) => state.markAsDirty);

  const [parties, setParties] = useState<PartyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [uploadPlaylist, setUploadPlaylist] = useState(true);

  const loadParties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await partyService.getParties();
      setParties(list);
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
        const playlistForApi = convertPlaylistForApi(items);
        await partyService.updatePartyPlaylist(party.id, playlistForApi);
        addNotification({
          type: 'success',
          message: `Плейлист привязан к вечеринке «${party.name}» и отправлен на сервер`,
        });
      } else {
        addNotification({
          type: 'success',
          message: `Плейлист привязан к вечеринке «${party.name}»`,
        });
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

  const handleCancel = () => {
    closeModal();
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
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
          <h2 className="modal-title">Привязать к вечеринке</h2>
          <button type="button" className="modal-close" onClick={handleCancel} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <p className="link-party-modal-description">
            Выберите вечеринку, созданную на сервере, чтобы связать с ней текущий плейлист.
          </p>

          {loading && <div className="link-party-modal-loading">Загрузка списка вечеринок...</div>}
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
                    <button
                      type="button"
                      className="modal-button primary link-party-modal-link-btn"
                      onClick={() => handleLink(party)}
                      disabled={linkingId !== null}
                      aria-label={`Привязать к вечеринке ${party.name}`}
                    >
                      <LinkIcon fontSize="small" />
                      {linkingId === party.id ? 'Привязка...' : 'Привязать'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-button secondary" onClick={handleCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

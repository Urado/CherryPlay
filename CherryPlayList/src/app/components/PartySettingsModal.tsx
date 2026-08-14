import { IconButton } from '@cherryplay/components';
import CloseIcon from '@mui/icons-material/Close';
import React, { useCallback, useEffect, useRef } from 'react';

import { OnlineUnavailablePanel } from '@shared/components';
import { useModalKeyboard } from '@shared/hooks';
import { useClientOutdatedStore, useUIStore } from '@shared/stores';

import { PartySettingsContent } from '../../workspaces/party/components/PartySettingsContent';
import {
  PartyWorkspaceRuntimeEphemeralHost,
  type PartyWorkspaceRuntimeValue,
  useSharedPartyWorkspaceRuntime,
} from '../../workspaces/party/partyWorkspaceRuntimeContext';
import { usePartyWorkspaceStore } from '../../workspaces/party/partyWorkspaceStore';

import './PartySettingsModal.css';

interface PartySettingsModalOpenProps {
  runtime: PartyWorkspaceRuntimeValue | null;
  isClientOutdated: boolean;
  clientRequiredVersion: string | null;
  onClose: () => void;
  onOpenLinkParty: () => void;
}

const PartySettingsModalOpen: React.FC<PartySettingsModalOpenProps> = ({
  runtime,
  isClientOutdated,
  clientRequiredVersion,
  onClose,
  onOpenLinkParty,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const themeEntitlementModal = usePartyWorkspaceStore((state) => state.themeEntitlementModal);
  const setThemeEntitlementModal = usePartyWorkspaceStore(
    (state) => state.setThemeEntitlementModal,
  );

  useModalKeyboard({
    enabled: true,
    onCancel: onClose,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <>
      <PartyWorkspaceRuntimeEphemeralHost />
      <div className="modal-overlay" onClick={handleOverlayClick} role="presentation">
        <div
          ref={dialogRef}
          className="modal-content party-settings-modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="party-settings-modal-title"
          tabIndex={-1}
        >
          <div className="modal-header">
            <h2 className="modal-title" id="party-settings-modal-title">
              Настройки вечеринки
            </h2>
            <IconButton
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Закрыть"
              icon={<CloseIcon />}
              variant="ghost"
              size="md"
            />
          </div>

          <div className="modal-body party-settings-modal-body">
            {isClientOutdated ? (
              <OnlineUnavailablePanel reason="outdated" requiredVersion={clientRequiredVersion} />
            ) : runtime ? (
              <PartySettingsContent runtime={runtime} onOpenLinkParty={onOpenLinkParty} />
            ) : (
              <div className="party-settings-modal-loading">Загрузка настроек вечеринки...</div>
            )}
          </div>
        </div>
      </div>

      {themeEntitlementModal ? (
        <div className="party-editor-locked-theme-modal-overlay" role="dialog" aria-modal="true">
          <div className="party-editor-locked-theme-modal">
            <h4 className="party-editor-locked-theme-title">Тема недоступна</h4>
            <p className="party-editor-locked-theme-text">
              {themeEntitlementModal.message} Можно подключить быстро, если нужно.
            </p>
            {themeEntitlementModal.safeContactUrl ? (
              <a
                href={themeEntitlementModal.safeContactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="party-editor-locked-theme-cta"
              >
                Напиши в ВК
              </a>
            ) : (
              <p className="party-editor-locked-theme-text">
                Ссылка на ВК сейчас недоступна. Попробуй чуть позже.
              </p>
            )}
            <button
              type="button"
              className="party-editor-button party-editor-button-secondary"
              onClick={() => setThemeEntitlementModal(null)}
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};

export const PartySettingsModal: React.FC = () => {
  const { modal, closeModal, openModal } = useUIStore();
  const runtime = useSharedPartyWorkspaceRuntime();
  const setThemeEntitlementModal = usePartyWorkspaceStore(
    (state) => state.setThemeEntitlementModal,
  );
  const { isOutdated: isClientOutdated, requiredVersion: clientRequiredVersion } =
    useClientOutdatedStore();

  const isOpen = modal === 'partySettings';

  const handleClose = useCallback(() => {
    setThemeEntitlementModal(null);
    closeModal();
  }, [closeModal, setThemeEntitlementModal]);

  if (!isOpen) {
    return null;
  }

  return (
    <PartySettingsModalOpen
      runtime={runtime}
      isClientOutdated={isClientOutdated}
      clientRequiredVersion={clientRequiredVersion}
      onClose={handleClose}
      onOpenLinkParty={() => openModal('linkParty')}
    />
  );
};

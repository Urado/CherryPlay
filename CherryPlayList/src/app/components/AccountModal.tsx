import React from 'react';

import { useModalKeyboard } from '@shared/hooks';
import { useUIStore } from '@shared/stores';

import { AccountView } from './AccountView';

export const AccountModal: React.FC = () => {
  const { modal, closeModal } = useUIStore();

  const { handleOverlayKeyDown } = useModalKeyboard({
    enabled: modal === 'account',
    onCancel: closeModal,
  });

  if (modal !== 'account') {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Закрыть окно аккаунта"
    >
      <div
        className="modal-content account-modal-content"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          zIndex: 1001,
          padding: 0,
          maxWidth: '90%',
          maxHeight: '90%',
          overflow: 'auto',
        }}
      >
        <div className="account-modal-header">
          <h2 className="account-modal-title">Аккаунт</h2>
          <button
            type="button"
            onClick={closeModal}
            className="account-modal-close"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="account-modal-body">
          <AccountView />
        </div>
      </div>
    </div>
  );
};

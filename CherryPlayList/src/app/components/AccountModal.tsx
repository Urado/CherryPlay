import { useUIStore } from '@shared/stores';
import React, { useEffect } from 'react';

import { requestAccountPopoverOpen } from './accountPopoverEvents';

export const AccountModal: React.FC = () => {
  const { modal, closeModal } = useUIStore();

  useEffect(() => {
    if (modal !== 'account') return;
    closeModal();
    requestAccountPopoverOpen();
  }, [modal, closeModal]);

  return null;
};

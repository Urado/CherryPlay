import BlockIcon from '@mui/icons-material/Block';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

export interface DisableButtonProps {
  onToggle?: () => void;
}

export const DisableButton: React.FC<DisableButtonProps> = ({ onToggle }) => {
  const { baseClassName, isDisabled } = useListRowContext();
  const title = isDisabled
    ? 'Снова включить трек в проигрывание'
    : 'Пропустить трек на вечеринке (можно снова включить)';

  return (
    <ActionButton
      onClick={() => onToggle?.()}
      className={`${baseClassName}-disable`}
      title={title}
      aria-label={title}
      icon={<BlockIcon style={{ fontSize: '18px' }} />}
      variant="ghost"
      size="sm"
    />
  );
};

DisableButton.displayName = 'ListRow.DisableButton';

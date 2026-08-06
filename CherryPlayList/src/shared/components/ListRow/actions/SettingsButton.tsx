import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

export interface SettingsButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  indicator?: React.ReactNode;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({
  onClick,
  title = 'Настройки',
  indicator,
}) => {
  const { baseClassName } = useListRowContext();

  return (
    <span className={`${baseClassName}-settings-wrap`}>
      <ActionButton
        onClick={(e) => onClick?.(e)}
        className={`${baseClassName}-settings`}
        title={title}
        aria-label={title}
        icon={<SettingsIcon style={{ fontSize: '18px' }} />}
        variant="ghost"
        size="sm"
      />
      {indicator ? <span className="player-settings-indicator">{indicator}</span> : null}
    </span>
  );
};

SettingsButton.displayName = 'ListRow.SettingsButton';

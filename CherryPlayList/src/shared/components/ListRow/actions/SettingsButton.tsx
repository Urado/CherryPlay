import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

import { ActionButton } from './ActionButton';

/**
 * Props for SettingsButton component
 */
export interface SettingsButtonProps {
  /** Called when settings is clicked */
  onClick?: (e: React.MouseEvent) => void;
  /** Title/tooltip */
  title?: string;
  /** Optional indicator content (e.g., emoji for action type) */
  indicator?: React.ReactNode;
}

/**
 * SettingsButton - Button to open item settings
 *
 * Used to configure track/group settings like pause duration, action after track, etc.
 */
export const SettingsButton: React.FC<SettingsButtonProps> = ({
  onClick,
  title = 'Settings',
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

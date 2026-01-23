import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for SettingsButton component
 */
export interface SettingsButtonProps {
  /** Called when settings is clicked */
  onClick?: () => void;
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <button
      type="button"
      className={`${baseClassName}-settings`}
      onClick={handleClick}
      title={title}
      aria-label={title}
    >
      <SettingsIcon style={{ fontSize: '18px' }} />
      {indicator && <span className="player-settings-indicator">{indicator}</span>}
    </button>
  );
};

SettingsButton.displayName = 'ListRow.SettingsButton';

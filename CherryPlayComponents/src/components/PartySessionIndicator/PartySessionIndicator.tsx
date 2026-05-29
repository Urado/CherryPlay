import React from 'react';

import type { PartyViewerStatus } from '../../constants/partyViewerStatus';

import './PartySessionIndicator.css';

export interface PartySessionIndicatorProps {
  status: PartyViewerStatus;
  className?: string;
}

export const PartySessionIndicator: React.FC<PartySessionIndicatorProps> = ({
  status,
  className = '',
}) => {
  return (
    <div
      className={`party-session-indicator party-session-indicator--${status.id} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={status.ariaLabel}
      data-viewer-status={status.id}
    >
      <span className="party-session-indicator-dot" aria-hidden />
      <span className="party-session-indicator-label">{status.label}</span>
    </div>
  );
};

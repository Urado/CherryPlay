import { Button } from '@cherryplay/components';
import React from 'react';

import type { PartyArchiveAvailability } from '../resolvePartyArchiveAvailability';
import { PARTY_ARCHIVE_CONFIRM_MESSAGE } from '../resolvePartyArchiveAvailability';

import './PartyEditorDangerZone.css';

export interface PartyEditorDangerZoneProps {
  availability: PartyArchiveAvailability;
  disabled?: boolean;
  isTransitioning?: boolean;
  onArchive: () => void;
}

export const PartyEditorDangerZone: React.FC<PartyEditorDangerZoneProps> = ({
  availability,
  disabled = false,
  isTransitioning = false,
  onArchive,
}) => {
  if (!availability.showDangerSection) {
    return null;
  }

  const handleClick = () => {
    if (availability.isBlockedByLive) {
      window.alert(availability.blockedExplanation ?? 'Сейчас нельзя отправить в архив');
      return;
    }
    if (!availability.canArchive || disabled || isTransitioning) {
      return;
    }
    if (!window.confirm(PARTY_ARCHIVE_CONFIRM_MESSAGE)) {
      return;
    }
    onArchive();
  };

  const title = availability.isBlockedByLive
    ? (availability.blockedExplanation ?? undefined)
    : availability.isQuiet
      ? 'Можно отправить в архив, но сначала лучше остановить проигрывание'
      : 'Перевести вечеринку в архив';

  const controlDisabled = disabled || isTransitioning;
  const blockedClass = availability.isBlockedByLive
    ? ' party-editor-danger-zone__archive--blocked'
    : '';
  const quietClass = availability.isQuiet ? ' party-editor-danger-zone__archive--quiet' : '';

  return (
    <Button
      type="button"
      className={`party-editor-danger-zone__archive${quietClass}${blockedClass}`}
      variant="secondary"
      size="sm"
      disabled={controlDisabled}
      aria-disabled={availability.isBlockedByLive || controlDisabled}
      loading={isTransitioning}
      title={title}
      onClick={handleClick}
    >
      В архив
    </Button>
  );
};

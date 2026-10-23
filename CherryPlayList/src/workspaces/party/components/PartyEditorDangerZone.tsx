import { Button } from '@cherryplay/components';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { dialogService } from '@shared/services/dialogService';
import React, { useRef } from 'react';

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
  const confirmingRef = useRef(false);
  const requestStateRef = useRef({ availability, disabled, isTransitioning, onArchive });
  requestStateRef.current = { availability, disabled, isTransitioning, onArchive };

  if (!availability.showDangerSection) {
    return null;
  }

  const handleClick = async () => {
    if (confirmingRef.current) return;
    if (availability.isBlockedByLive) {
      confirmingRef.current = true;
      await dialogService.alert({
        title: 'Нельзя отправить вечеринку в архив',
        message: availability.blockedExplanation ?? 'Сейчас нельзя отправить в архив',
      });
      confirmingRef.current = false;
      return;
    }
    if (!availability.canArchive || disabled || isTransitioning) {
      return;
    }
    confirmingRef.current = true;
    try {
      const accepted = await dialogService.confirm({
        title: 'Отправить вечеринку в архив?',
        message: PARTY_ARCHIVE_CONFIRM_MESSAGE,
        confirmLabel: 'В архив',
        destructive: true,
      });
      const currentState = requestStateRef.current;
      if (
        accepted &&
        currentState.availability.canArchive &&
        !currentState.availability.isBlockedByLive &&
        !currentState.disabled &&
        !currentState.isTransitioning
      ) {
        currentState.onArchive();
      }
    } finally {
      confirmingRef.current = false;
    }
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
  const hintText = availability.isBlockedByLive
    ? (availability.blockedExplanation ?? 'Сейчас идёт эфир — архив недоступен')
    : availability.isQuiet
      ? 'Сейчас пауза — архив возможен'
      : null;

  return (
    <div className="party-editor-danger-zone">
      <Button
        type="button"
        className={`party-editor-danger-zone__archive${quietClass}${blockedClass}`}
        variant="secondary"
        size="sm"
        disabled={controlDisabled}
        aria-disabled={availability.isBlockedByLive || controlDisabled}
        loading={isTransitioning}
        title={title}
        onClick={() => void handleClick()}
      >
        {availability.isBlockedByLive ? (
          <WarningAmberOutlinedIcon
            className="party-editor-danger-zone__archive-icon"
            fontSize="inherit"
            aria-hidden
          />
        ) : null}
        В архив
      </Button>
      {hintText ? <span className="party-editor-danger-zone__hint">{hintText}</span> : null}
    </div>
  );
};

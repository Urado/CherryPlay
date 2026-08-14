import { Button } from '@cherryplay/components';
import React from 'react';

import type { ProjectSessionMode } from '@core/types/project';
import type { PartyLifecycleState } from '@shared/services/partyService';

import { resolvePartyLifecycleServerBadgeLabel } from '../partyEditorPhase';

import './PartyLifecycleControls.css';

export type PartyLifecycleControlSlot = 'all' | 'accent' | 'secondary';

export interface PartyLifecycleControlsProps {
  partyLifecycleState: PartyLifecycleState;
  isTransitioning?: boolean;
  pendingTransition?: PartyLifecycleState | null;
  disabled?: boolean;
  onTransition: (targetState: PartyLifecycleState) => void;
  layout?: 'default' | 'header';
  sessionMode?: ProjectSessionMode;
  slot?: PartyLifecycleControlSlot;
  hideUnarchive?: boolean;
}

function isLoadingForTarget(
  target: PartyLifecycleState,
  isTransitioning: boolean,
  pendingTransition?: PartyLifecycleState | null,
): boolean {
  return isTransitioning && pendingTransition === target;
}

export const PartyLifecycleControls: React.FC<PartyLifecycleControlsProps> = ({
  partyLifecycleState,
  isTransitioning = false,
  pendingTransition = null,
  disabled = false,
  onTransition,
  layout = 'default',
  sessionMode,
  slot = 'all',
  hideUnarchive = false,
}) => {
  const isDisabled = disabled || isTransitioning;
  const isHeader = layout === 'header';
  const showAccentPublish =
    partyLifecycleState === 'draft' && (slot === 'all' || slot === 'accent');
  const showSecondaryReady =
    partyLifecycleState === 'ready' && (slot === 'all' || slot === 'secondary');
  const showSecondaryUnarchive =
    !hideUnarchive &&
    partyLifecycleState === 'completed' &&
    (slot === 'all' || slot === 'secondary');

  if (!showAccentPublish && !showSecondaryReady && !showSecondaryUnarchive) {
    return null;
  }

  const transitionButtons = (
    <>
      {showAccentPublish && (
        <Button
          type="button"
          className="party-lifecycle-action"
          disabled={isDisabled}
          loading={isLoadingForTarget('ready', isTransitioning, pendingTransition)}
          onClick={() => onTransition('ready')}
          title="Снять черновик и перевести в «Ждёт начала». Это не публикация в каталоге."
          variant="primary"
          size="sm"
        >
          Сделать доступной
        </Button>
      )}

      {showSecondaryReady && (
        <Button
          type="button"
          className="party-lifecycle-action party-lifecycle-action--complete"
          disabled={isDisabled}
          loading={isLoadingForTarget('completed', isTransitioning, pendingTransition)}
          onClick={() => onTransition('completed')}
          title="Перевести вечеринку в архив"
          variant="secondary"
          size="sm"
        >
          В архив
        </Button>
      )}

      {showSecondaryUnarchive && (
        <Button
          type="button"
          className="party-lifecycle-action"
          disabled={isDisabled}
          loading={isLoadingForTarget('ready', isTransitioning, pendingTransition)}
          onClick={() => onTransition('ready')}
          title="Вернуть вечеринку из архива в статус «Ждёт начала»"
          variant="primary"
          size="sm"
        >
          Вернуть из архива
        </Button>
      )}
    </>
  );

  if (isHeader) {
    return (
      <div
        className="party-lifecycle-actions party-lifecycle-actions--header"
        role="group"
        aria-label="Состояние вечеринки"
      >
        {transitionButtons}
      </div>
    );
  }

  return (
    <section className="party-lifecycle" aria-label="Состояние вечеринки">
      <div className="party-lifecycle-header">
        <span className="party-lifecycle-header-label">Статус вечеринки</span>
        <span className={`party-lifecycle-badge party-lifecycle-badge--${partyLifecycleState}`}>
          {resolvePartyLifecycleServerBadgeLabel(partyLifecycleState, sessionMode)}
        </span>
      </div>
      <p className="party-lifecycle-hint">
        Статус на сайте. Каталог («В каталоге» / «По ссылке») настраивается отдельно.
      </p>

      <div className="party-lifecycle-actions">{transitionButtons}</div>
    </section>
  );
};

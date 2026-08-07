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
}) => {
  if (partyLifecycleState === 'completed') {
    return null;
  }

  const isDisabled = disabled || isTransitioning;
  const isHeader = layout === 'header';
  const showAccentPublish =
    partyLifecycleState === 'draft' && (slot === 'all' || slot === 'accent');
  const showSecondaryReady =
    partyLifecycleState === 'ready' && (slot === 'all' || slot === 'secondary');

  if (!showAccentPublish && !showSecondaryReady) {
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
          title="Опубликовать вечеринку на сайте (статус «Ждёт начала»)"
          variant="primary"
          size="sm"
        >
          Опубликовать
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

      <div className="party-lifecycle-actions">{transitionButtons}</div>
    </section>
  );
};

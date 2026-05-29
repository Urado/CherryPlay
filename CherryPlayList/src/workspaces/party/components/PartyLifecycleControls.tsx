import React from 'react';

import type { PartyLifecycleState } from '@shared/services/partyService';

import './PartyLifecycleControls.css';

const LIFECYCLE_STATUS_LABELS: Record<PartyLifecycleState, string> = {
  draft: 'Черновик',
  ready: 'Готова',
  completed: 'Завершена',
};

export interface PartyLifecycleControlsProps {
  partyLifecycleState: PartyLifecycleState;
  isTransitioning?: boolean;
  disabled?: boolean;
  onTransition: (targetState: PartyLifecycleState) => void;
}

export const PartyLifecycleControls: React.FC<PartyLifecycleControlsProps> = ({
  partyLifecycleState,
  isTransitioning = false,
  disabled = false,
  onTransition,
}) => {
  const isDisabled = disabled || isTransitioning;

  return (
    <section className="party-lifecycle" aria-label="Состояние вечеринки">
      <div className="party-lifecycle-header">
        <span className="party-lifecycle-header-label">Статус вечеринки</span>
        <span className={`party-lifecycle-badge party-lifecycle-badge--${partyLifecycleState}`}>
          {LIFECYCLE_STATUS_LABELS[partyLifecycleState]}
        </span>
      </div>

      <div className="party-lifecycle-actions">
        {partyLifecycleState === 'draft' && (
          <button
            type="button"
            className="party-editor-button party-editor-button-primary party-lifecycle-action"
            disabled={isDisabled}
            onClick={() => onTransition('ready')}
          >
            {isTransitioning ? 'Публикация...' : 'Опубликовать'}
          </button>
        )}

        {partyLifecycleState === 'ready' && (
          <>
            <button
              type="button"
              className="party-editor-button party-editor-button-secondary party-lifecycle-action"
              disabled={isDisabled}
              onClick={() => onTransition('draft')}
            >
              {isTransitioning ? 'Сохранение...' : 'Сделать черновиком'}
            </button>
            <button
              type="button"
              className="party-editor-button party-editor-button-secondary party-lifecycle-action party-lifecycle-action--complete"
              disabled={isDisabled}
              onClick={() => onTransition('completed')}
            >
              {isTransitioning ? 'Сохранение...' : 'Завершить'}
            </button>
          </>
        )}

        {partyLifecycleState === 'completed' && (
          <button
            type="button"
            className="party-editor-button party-editor-button-secondary party-lifecycle-action"
            disabled={isDisabled}
            onClick={() => onTransition('ready')}
            title="Вернуть вечеринку в состояние «Готова»"
          >
            {isTransitioning ? 'Сохранение...' : 'Вернуть'}
          </button>
        )}
      </div>
    </section>
  );
};

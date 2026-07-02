import React from 'react';

import type { PartyLifecycleState } from '@shared/services/partyService';

import { PARTY_EDITOR_LIFECYCLE_BADGE_LABELS } from '../partyEditorPhase';

import './PartyLifecycleControls.css';

export interface PartyLifecycleControlsProps {
  partyLifecycleState: PartyLifecycleState;
  isTransitioning?: boolean;
  disabled?: boolean;
  onTransition: (targetState: PartyLifecycleState) => void;
  /** Compact horizontal layout for shell header. */
  layout?: 'default' | 'header';
}

export const PartyLifecycleControls: React.FC<PartyLifecycleControlsProps> = ({
  partyLifecycleState,
  isTransitioning = false,
  disabled = false,
  onTransition,
  layout = 'default',
}) => {
  const isDisabled = disabled || isTransitioning;
  const isHeader = layout === 'header';

  const transitionButtons = (
    <>
      {partyLifecycleState === 'draft' && (
        <button
          type="button"
          className="party-editor-button party-editor-button-primary party-lifecycle-action"
          disabled={isDisabled}
          onClick={() => onTransition('ready')}
          title="Перевести вечеринку в статус «Готова к мероприятию»"
        >
          {isTransitioning
            ? 'Обновление...'
            : isHeader
              ? 'Подготовить'
              : 'Подготовить к мероприятию'}
        </button>
      )}

      {partyLifecycleState === 'ready' && (
        <>
          <button
            type="button"
            className="party-editor-button party-editor-button-secondary party-lifecycle-action"
            disabled={isDisabled}
            onClick={() => onTransition('draft')}
            title="Сделать черновиком"
          >
            {isTransitioning ? 'Обновление...' : isHeader ? 'В черновик' : 'Сделать черновиком'}
          </button>
          <button
            type="button"
            className="party-editor-button party-editor-button-secondary party-lifecycle-action party-lifecycle-action--complete"
            disabled={isDisabled}
            onClick={() => onTransition('completed')}
            title="Завершить вечеринку"
          >
            {isTransitioning ? 'Обновление...' : 'Завершить'}
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
          {isTransitioning ? 'Обновление...' : 'Вернуть'}
        </button>
      )}
    </>
  );

  if (isHeader) {
    return (
      <div
        className="party-editor-shell-header-group party-editor-shell-header-group--transitions"
        role="group"
        aria-label="Подготовка вечеринки"
      >
        <div className="party-lifecycle-actions party-lifecycle-actions--header">
          {transitionButtons}
        </div>
      </div>
    );
  }

  return (
    <section className="party-lifecycle" aria-label="Состояние вечеринки">
      <div className="party-lifecycle-header">
        <span className="party-lifecycle-header-label">Статус вечеринки</span>
        <span className={`party-lifecycle-badge party-lifecycle-badge--${partyLifecycleState}`}>
          {PARTY_EDITOR_LIFECYCLE_BADGE_LABELS[partyLifecycleState]}
        </span>
      </div>

      <div className="party-lifecycle-actions">{transitionButtons}</div>
    </section>
  );
};

import { LIFECYCLE_STATUS_LABELS } from '../constants/partyLifecycle';
import type { PartyLifecycleState } from '../types/api';

import './PartyLifecycleControls.css';

export interface PartyLifecycleControlsProps {
  partyLifecycleState: PartyLifecycleState;
  isTransitioning?: boolean;
  disabled?: boolean;
  onTransition: (targetState: PartyLifecycleState) => void;
}

export function PartyLifecycleControls({
  partyLifecycleState,
  isTransitioning = false,
  disabled = false,
  onTransition,
}: PartyLifecycleControlsProps) {
  const isDisabled = disabled || isTransitioning;

  return (
    <section className="cabinet-lifecycle" aria-label="Состояние вечеринки">
      <div className="cabinet-lifecycle-header">
        <span className="cabinet-lifecycle-header-label">Статус вечеринки</span>
        <span className={`cabinet-lifecycle-badge cabinet-lifecycle-badge--${partyLifecycleState}`}>
          {LIFECYCLE_STATUS_LABELS[partyLifecycleState]}
        </span>
      </div>

      <div className="cabinet-lifecycle-actions">
        {partyLifecycleState === 'draft' && (
          <button
            type="button"
            className="cabinet-btn cabinet-btn-primary cabinet-btn-sm cabinet-lifecycle-action"
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
              className="cabinet-btn cabinet-btn-sm cabinet-lifecycle-action"
              disabled={isDisabled}
              onClick={() => onTransition('draft')}
            >
              {isTransitioning ? 'Сохранение...' : 'Сделать черновиком'}
            </button>
            <button
              type="button"
              className="cabinet-btn cabinet-btn-sm cabinet-lifecycle-action cabinet-lifecycle-action--complete"
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
            className="cabinet-btn cabinet-btn-sm cabinet-lifecycle-action"
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
}

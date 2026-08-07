import { Button } from '@cherryplay/components';

import { LIFECYCLE_STATUS_LABELS } from '../constants/partyLifecycle';
import type { PartyLifecycleState } from '../types/api';

import './PartyLifecycleControls.css';

export interface PartyLifecycleControlsProps {
  partyLifecycleState: PartyLifecycleState;
  isTransitioning?: boolean;
  pendingTransition?: PartyLifecycleState | null;
  disabled?: boolean;
  onTransition: (targetState: PartyLifecycleState) => void;
}

function isLoadingForTarget(
  target: PartyLifecycleState,
  isTransitioning: boolean,
  pendingTransition?: PartyLifecycleState | null,
): boolean {
  return isTransitioning && pendingTransition === target;
}

export function PartyLifecycleControls({
  partyLifecycleState,
  isTransitioning = false,
  pendingTransition = null,
  disabled = false,
  onTransition,
}: PartyLifecycleControlsProps) {
  const isDisabled = disabled || isTransitioning;
  const showActions =
    partyLifecycleState === 'draft' ||
    partyLifecycleState === 'ready' ||
    partyLifecycleState === 'completed';

  return (
    <section className="cabinet-lifecycle" aria-label="Состояние вечеринки">
      <div className="cabinet-lifecycle-header">
        <span className="cabinet-lifecycle-header-label">Статус вечеринки</span>
        <span className={`cabinet-lifecycle-badge cabinet-lifecycle-badge--${partyLifecycleState}`}>
          {LIFECYCLE_STATUS_LABELS[partyLifecycleState]}
        </span>
      </div>
      <p className="cabinet-lifecycle-hint">
        Статус на сайте. Каталог («В каталоге» / по ссылке) настраивается отдельно.
      </p>

      {showActions && (
        <div className="cabinet-lifecycle-actions">
          {partyLifecycleState === 'draft' && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              fullWidth
              className="cabinet-lifecycle-action"
              disabled={isDisabled}
              loading={isLoadingForTarget('ready', isTransitioning, pendingTransition)}
              onClick={() => onTransition('ready')}
              title="Снять черновик и перевести в «Ждёт начала». Это не публикация в каталоге."
            >
              Сделать доступной
            </Button>
          )}

          {partyLifecycleState === 'ready' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              fullWidth
              className="cabinet-lifecycle-action cabinet-lifecycle-action--complete"
              disabled={isDisabled}
              loading={isLoadingForTarget('completed', isTransitioning, pendingTransition)}
              onClick={() => onTransition('completed')}
              title="Перевести вечеринку в архив"
            >
              В архив
            </Button>
          )}

          {partyLifecycleState === 'completed' && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              fullWidth
              className="cabinet-lifecycle-action"
              disabled={isDisabled}
              loading={isLoadingForTarget('ready', isTransitioning, pendingTransition)}
              onClick={() => onTransition('ready')}
              title="Вернуть вечеринку из архива в статус «Ждёт начала»"
            >
              Вернуть из архива
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

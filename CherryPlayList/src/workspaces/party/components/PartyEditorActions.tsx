import { Button } from '@cherryplay/components';
import React from 'react';

import type { PartyEditorPhase } from '../partyEditorPhase';

import './PartyEditor.css';

export interface PartyEditorActionsProps {
  phase: PartyEditorPhase;
  isAuthenticated: boolean;
  isCreating: boolean;
  isSaving?: boolean;
  networkDisabled?: boolean;
  createBlockedByTheme?: boolean;
  createBlockedByThemeTitle?: string;
  showSave?: boolean;
  showMakeReady?: boolean;
  isMakeReadyLoading?: boolean;
  secondaryExtra?: React.ReactNode;
  onCreateParty?: () => void;
  onOpenLinkParty?: () => void;
  onSaveMetadata?: () => void;
  onMakeReady?: () => void;
}

export function getPartyEditorActionVisibility(
  phase: PartyEditorPhase,
  options: {
    isAuthenticated: boolean;
    hasOnOpenLinkParty: boolean;
  },
): { showCreate: boolean; showLinkParty: boolean; showSave: boolean; showMakeReady: boolean } {
  const showCreate = phase === 'draft-unlinked';
  const showLinkParty =
    phase === 'draft-unlinked' && options.hasOnOpenLinkParty && options.isAuthenticated;
  const showSave = phase === 'draft-linked' || phase === 'ready';
  const showMakeReady = phase === 'draft-linked';

  return { showCreate, showLinkParty, showSave, showMakeReady };
}

export function shouldShowPartyLifecycleControls(
  phase: PartyEditorPhase,
  linkedParty: { id: string; shortCode: string } | null | undefined,
): boolean {
  return (
    (phase === 'draft-linked' || phase === 'ready' || phase === 'completed') && linkedParty != null
  );
}

export function shouldShowPartyCatalogVisibilityControl(phase: PartyEditorPhase): boolean {
  return phase === 'draft-unlinked' || phase === 'ready' || phase === 'completed';
}

export const PartyEditorActions: React.FC<PartyEditorActionsProps> = ({
  phase,
  isAuthenticated,
  isCreating,
  isSaving = false,
  networkDisabled = false,
  createBlockedByTheme = false,
  createBlockedByThemeTitle = 'Выберите тему, доступную в вашем тарифе',
  showSave = false,
  showMakeReady = false,
  isMakeReadyLoading = false,
  secondaryExtra,
  onCreateParty,
  onOpenLinkParty,
  onSaveMetadata,
  onMakeReady,
}) => {
  if (phase === 'completed' && !secondaryExtra) {
    return null;
  }

  const { showCreate, showLinkParty } = getPartyEditorActionVisibility(
    phase === 'completed' ? 'ready' : phase,
    {
      isAuthenticated,
      hasOnOpenLinkParty: Boolean(onOpenLinkParty),
    },
  );

  const effectiveShowCreate = phase !== 'completed' && showCreate;
  const effectiveShowLink = phase !== 'completed' && showLinkParty;
  const effectiveShowSave = phase !== 'completed' && showSave;
  const effectiveShowMakeReady = phase !== 'completed' && showMakeReady;

  const actionDisabled = isCreating || isSaving || isMakeReadyLoading || networkDisabled;

  const networkDisabledTitle = 'Включите «Онлайн» в настройках';

  const hasPrimaryCluster =
    effectiveShowCreate || effectiveShowLink || effectiveShowSave || effectiveShowMakeReady;
  const hasSecondary = Boolean(secondaryExtra);

  if (!hasPrimaryCluster && !hasSecondary) {
    return null;
  }

  return (
    <div className="party-editor-actions" aria-busy={isCreating || isSaving} aria-live="polite">
      {effectiveShowCreate && onCreateParty && (
        <Button
          className="party-editor-actions__action"
          onClick={onCreateParty}
          disabled={!isAuthenticated || actionDisabled || createBlockedByTheme}
          loading={isCreating}
          loadingLabel="Создание..."
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : !isAuthenticated
                ? 'Требуется авторизация'
                : createBlockedByTheme
                  ? createBlockedByThemeTitle
                  : 'Создать запись вечеринки на сервере'
          }
          variant="primary"
          size="sm"
        >
          Создать
        </Button>
      )}
      {effectiveShowLink && onOpenLinkParty && (
        <Button
          className="party-editor-actions__action"
          onClick={onOpenLinkParty}
          disabled={actionDisabled}
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : 'Привязать существующую вечеринку на сервере к этому проекту (не создаёт новую и не запускает трансляцию)'
          }
          variant="secondary"
          size="sm"
        >
          Привязать
        </Button>
      )}
      {effectiveShowSave && onSaveMetadata && (
        <Button
          className="party-editor-actions__action"
          type="button"
          onClick={() => void onSaveMetadata()}
          disabled={actionDisabled}
          loading={isSaving}
          loadingLabel="Обновление..."
          variant="primary"
          size="sm"
          title={
            networkDisabled
              ? networkDisabledTitle
              : 'Обновить название, описание и другие поля на сервере (без обновления плейлиста)'
          }
        >
          Обновить
        </Button>
      )}
      {effectiveShowMakeReady && onMakeReady && (
        <Button
          className="party-editor-actions__action"
          type="button"
          onClick={() => void onMakeReady()}
          disabled={actionDisabled}
          loading={isMakeReadyLoading}
          variant="secondary"
          size="sm"
          title={
            networkDisabled
              ? networkDisabledTitle
              : 'Снять черновик и перевести в «Ждёт начала». Это не публикация в каталоге.'
          }
        >
          Сделать доступной
        </Button>
      )}
      {hasSecondary ? <div className="party-editor-actions__trailing">{secondaryExtra}</div> : null}
    </div>
  );
};

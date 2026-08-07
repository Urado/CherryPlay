import { Button } from '@cherryplay/components';
import React from 'react';

import type { PartyEditorPhase } from '../partyEditorPhase';

import './PartyEditor.css';

export type PartyEditorActionSlot = 'all' | 'accent' | 'secondary';

export interface PartyEditorActionsProps {
  phase: PartyEditorPhase;
  partyName: string;
  linkedParty?: { id: string; shortCode: string } | null;
  isAuthenticated: boolean;
  isCreating: boolean;
  isPublishing: boolean;
  networkDisabled?: boolean;
  networkOffline?: boolean;
  createBlockedByTheme?: boolean;
  createBlockedByThemeTitle?: string;
  onCreateParty?: () => void;
  onPublish?: () => void;
  onOpenLinkParty?: () => void;
  compact?: boolean;
  slot?: PartyEditorActionSlot;
}

export function getPartyEditorActionVisibility(
  phase: PartyEditorPhase,
  options: {
    isAuthenticated: boolean;
    hasOnPublish: boolean;
    hasOnOpenLinkParty: boolean;
  },
): { showPublish: boolean; showCreate: boolean; showLinkParty: boolean } {
  const showPublish = options.hasOnPublish && (phase === 'draft-linked' || phase === 'ready');
  const showCreate = phase === 'draft-unlinked';
  const showLinkParty =
    phase === 'draft-unlinked' && options.hasOnOpenLinkParty && options.isAuthenticated;

  return { showPublish, showCreate, showLinkParty };
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
  return phase === 'ready' || phase === 'completed';
}

export const PartyEditorActions: React.FC<PartyEditorActionsProps> = ({
  phase,
  partyName: _partyName,
  linkedParty: _linkedParty,
  isAuthenticated,
  isCreating,
  isPublishing,
  networkDisabled = false,
  networkOffline = false,
  createBlockedByTheme = false,
  createBlockedByThemeTitle = 'Выберите тему, доступную в вашем тарифе',
  onCreateParty,
  onPublish,
  onOpenLinkParty,
  compact = false,
  slot = 'all',
}) => {
  if (phase === 'completed') {
    return null;
  }

  const { showPublish, showCreate, showLinkParty } = getPartyEditorActionVisibility(phase, {
    isAuthenticated,
    hasOnPublish: Boolean(onPublish),
    hasOnOpenLinkParty: Boolean(onOpenLinkParty),
  });

  const showAccentCreate = showCreate && (slot === 'all' || slot === 'accent');
  const showSecondaryLink = showLinkParty && (slot === 'all' || slot === 'secondary');
  const showAccentPublish =
    showPublish && phase === 'ready' && (slot === 'all' || slot === 'accent');
  const showSecondaryPublish =
    showPublish && phase === 'draft-linked' && (slot === 'all' || slot === 'secondary');

  if (!showAccentCreate && !showSecondaryLink && !showAccentPublish && !showSecondaryPublish) {
    return null;
  }

  const actionDisabled = isCreating || isPublishing || networkDisabled;

  const networkDisabledTitle = networkOffline
    ? 'Включите «Онлайн» в настройках'
    : 'Недоступно без подключения к серверу';

  return (
    <div
      className="party-editor-actions party-editor-actions--header"
      aria-busy={isCreating || isPublishing}
      aria-live="polite"
    >
      {showAccentCreate && onCreateParty && (
        <Button
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
          {compact ? 'Создать' : 'Новая вечеринка на сервере'}
        </Button>
      )}
      {showSecondaryLink && onOpenLinkParty && (
        <Button
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
          {compact ? 'Привязать…' : 'Привязать существующую…'}
        </Button>
      )}
      {(showAccentPublish || showSecondaryPublish) && onPublish && (
        <Button
          onClick={onPublish}
          disabled={actionDisabled}
          loading={isPublishing || isCreating}
          loadingLabel="Обновление..."
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : 'Обновить плейлист и настройки, которые видят гости'
          }
          variant={showAccentPublish ? 'primary' : 'secondary'}
          size="sm"
        >
          {compact ? 'Обновить на сайте' : 'Обновить для гостей'}
        </Button>
      )}
    </div>
  );
};

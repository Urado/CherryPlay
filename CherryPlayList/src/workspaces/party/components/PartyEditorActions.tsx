import { Button } from '@cherryplay/components';
import React from 'react';

import type { PartyEditorPhase } from '../partyEditorPhase';

import './PartyEditor.css';

export interface PartyEditorActionsProps {
  phase: PartyEditorPhase;
  partyName: string;
  linkedParty?: { id: string; shortCode: string } | null;
  isAuthenticated: boolean;
  isCreating: boolean;
  isPublishing: boolean;
  /** When false, network-only actions (create, publish, link) are disabled. */
  networkDisabled?: boolean;
  /** When true, `networkDisabled` is due to «Онлайн» being off (not server reachability). */
  networkOffline?: boolean;
  onCreateParty?: () => void;
  onPublish?: () => void;
  onOpenLinkParty?: () => void;
  /** Shorter labels and header group wrapper for shell toolbar. */
  compact?: boolean;
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
  return phase !== 'draft-unlinked' && linkedParty != null;
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
  onCreateParty,
  onPublish,
  onOpenLinkParty,
  compact = false,
}) => {
  if (phase === 'completed') {
    return null;
  }

  const { showPublish, showCreate, showLinkParty } = getPartyEditorActionVisibility(phase, {
    isAuthenticated,
    hasOnPublish: Boolean(onPublish),
    hasOnOpenLinkParty: Boolean(onOpenLinkParty),
  });

  if (!showPublish && !showCreate && !showLinkParty) {
    return null;
  }

  const actionDisabled = isCreating || isPublishing || networkDisabled;

  const networkDisabledTitle = networkOffline
    ? 'Включите «Онлайн» в настройках'
    : 'Недоступно без подключения к серверу';

  const actions = (
    <div
      className="party-editor-actions party-editor-actions--header"
      aria-busy={isCreating || isPublishing}
      aria-live="polite"
    >
      {showPublish && onPublish && (
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
          variant={compact && phase === 'draft-linked' ? 'secondary' : 'primary'}
          size="sm"
        >
          {compact ? 'Обновить на сайте' : 'Обновить для гостей'}
        </Button>
      )}
      {showCreate && onCreateParty && (
        <Button
          onClick={onCreateParty}
          disabled={!isAuthenticated || actionDisabled}
          loading={isCreating}
          loadingLabel="Создание..."
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : !isAuthenticated
                ? 'Требуется авторизация'
                : 'Создать запись вечеринки на сервере'
          }
          variant="secondary"
          size="sm"
        >
          {compact ? 'Создать' : 'Новая вечеринка на сервере'}
        </Button>
      )}
      {showLinkParty && onOpenLinkParty && (
        <Button
          onClick={onOpenLinkParty}
          disabled={networkDisabled}
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : 'Подключить текущий плейлист к вечеринке, уже созданной на сервере'
          }
          variant="secondary"
          size="sm"
        >
          {compact ? 'Подключить' : 'Подключить к существующей'}
        </Button>
      )}
    </div>
  );

  return actions;
};

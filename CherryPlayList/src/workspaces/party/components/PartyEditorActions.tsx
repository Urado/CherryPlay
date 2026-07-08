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
        <button
          className={`party-editor-button ${
            compact && phase === 'draft-linked'
              ? 'party-editor-button-secondary'
              : 'party-editor-button-primary'
          }`}
          onClick={onPublish}
          disabled={actionDisabled}
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : 'Обновить плейлист и настройки, которые видят гости'
          }
        >
          {isPublishing || isCreating
            ? 'Обновление...'
            : compact
              ? 'Обновить на сайте'
              : 'Обновить для гостей'}
        </button>
      )}
      {showCreate && onCreateParty && (
        <button
          className="party-editor-button party-editor-button-secondary"
          onClick={onCreateParty}
          disabled={!isAuthenticated || actionDisabled}
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : !isAuthenticated
                ? 'Требуется авторизация'
                : 'Создать запись вечеринки на сервере'
          }
        >
          {isCreating ? 'Создание...' : compact ? 'Создать' : 'Новая вечеринка на сервере'}
        </button>
      )}
      {showLinkParty && onOpenLinkParty && (
        <button
          className="party-editor-button party-editor-button-secondary"
          onClick={onOpenLinkParty}
          disabled={networkDisabled}
          type="button"
          title={
            networkDisabled
              ? networkDisabledTitle
              : 'Подключить текущий плейлист к вечеринке, уже созданной на сервере'
          }
        >
          {compact ? 'Подключить' : 'Подключить к существующей'}
        </button>
      )}
    </div>
  );

  return actions;
};

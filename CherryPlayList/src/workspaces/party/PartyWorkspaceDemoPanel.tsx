import { type PartyThemeId } from '@cherryplay/components';
import React, { useState } from 'react';

import { PartyDesignSettingsBlock } from './components/PartyDesignSettingsBlock';
import type { PartyEditorBlockedReason } from './partyEditorPhase';
import {
  demoSyncPreviewWithActual,
  demoResetToDefault,
  demoSetBlockedOverride,
  demoSetPreviewCustomizationSettings,
  demoSetLinkedLifecycle,
  demoSetPartyNotFound,
  demoSetPreviewConnectionBreak,
  demoSetPreviewLifecycle,
  demoSetPreviewLive,
  demoSetPreviewTheme,
  demoSetPreviewTrackNumber,
  demoSetUnlinkedDraft,
  type DemoPreviewConnectionScenario,
} from './partyWorkspaceDemoActions';
import { usePartyWorkspaceStore } from './partyWorkspaceStore';

import './PartyWorkspaceDemoPanel.css';

export type PartyWorkspaceDemoPanelMode = 'editor' | 'preview';

interface PartyWorkspaceDemoPanelProps {
  mode: PartyWorkspaceDemoPanelMode;
  previewTrackCount?: number;
  previewThemeId?: PartyThemeId;
  previewDesignOptions?: Array<{ id: PartyThemeId; name: string; isAvailable: boolean }>;
  previewCustomizationSettings?: Record<string, unknown>;
}

const BLOCKED_SCENARIOS: {
  label: string;
  reason: PartyEditorBlockedReason;
  onClick?: () => void;
}[] = [
  { label: 'Нет авторизации', reason: 'auth' },
  { label: 'Устаревший клиент', reason: 'outdated' },
  { label: 'Загрузка', reason: 'checking' },
  { label: 'Сервер недоступен', reason: 'unreachable' },
  { label: 'Вечеринка удалена', reason: 'party-not-found', onClick: demoSetPartyNotFound },
];

const PREVIEW_CONNECTION_SCENARIOS: {
  label: string;
  scenario: DemoPreviewConnectionScenario;
}[] = [
  { label: 'Подключение…', scenario: 'connecting' },
  { label: 'Нет связи', scenario: 'server_unreachable' },
  { label: 'Переподключение…', scenario: 'reconnecting' },
  { label: 'Организатор не в сети', scenario: 'organizer_offline' },
  { label: 'Вечеринка удалена', scenario: 'party_not_found' },
];

export const PartyWorkspaceDemoPanel: React.FC<PartyWorkspaceDemoPanelProps> = ({
  mode,
  previewTrackCount = 0,
  previewThemeId = 'cyberpunk',
  previewDesignOptions = [],
  previewCustomizationSettings = {},
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const previewCurrentTrackNumber = usePartyWorkspaceStore(
    (state) => state.previewCurrentTrackNumber,
  );
  const hasPreviewTracks = previewTrackCount > 0;
  const boundedTrackNumber = hasPreviewTracks
    ? Math.min(Math.max(previewCurrentTrackNumber ?? 1, 1), previewTrackCount)
    : 1;

  const handlePreviewTrackChange = (nextValue: number | null) => {
    if (!hasPreviewTracks) {
      return;
    }
    if (nextValue == null) {
      demoSetPreviewTrackNumber(1);
      return;
    }
    const bounded = Math.min(Math.max(nextValue, 1), previewTrackCount);
    demoSetPreviewTrackNumber(bounded);
  };

  return (
    <aside
      className={`party-workspace-demo-panel${
        isCollapsed ? ' party-workspace-demo-panel--collapsed' : ''
      }`}
      aria-label="Демо-сценарии вечеринки"
    >
      <button
        type="button"
        className="party-workspace-demo-panel-grip"
        onClick={() => setIsCollapsed((value) => !value)}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Развернуть сценарии превью' : 'Свернуть сценарии превью'}
        title={isCollapsed ? 'Развернуть демо-панель' : 'Свернуть демо-панель'}
      >
        {isCollapsed ? '▴' : '▾'}
      </button>
      <div className="party-workspace-demo-panel-header">
        <span className="party-workspace-demo-panel-badge">
          {mode === 'preview' ? 'Сценарии' : 'Демо'}
        </span>
        <span className="party-workspace-demo-panel-title">
          {mode === 'editor' ? 'Сценарии редактора' : 'Сценарии превью'}
        </span>
      </div>

      <div className="party-workspace-demo-panel-body">
        {mode === 'editor' && (
          <>
            <div className="party-workspace-demo-panel-group">
              <span className="party-workspace-demo-panel-group-label">Фазы редактора</span>
              <div className="party-workspace-demo-panel-buttons">
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={demoSetUnlinkedDraft}
                >
                  Создание (без привязки)
                </button>
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={() => demoSetLinkedLifecycle('draft')}
                >
                  Черновик (привязана)
                </button>
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={() => demoSetLinkedLifecycle('ready')}
                >
                  Готова к мероприятию
                </button>
                <button
                  type="button"
                  className="party-workspace-demo-panel-button"
                  onClick={() => demoSetLinkedLifecycle('completed')}
                >
                  Завершена
                </button>
              </div>
            </div>

            <div className="party-workspace-demo-panel-group">
              <span className="party-workspace-demo-panel-group-label">Блокирующие оверлеи</span>
              <div className="party-workspace-demo-panel-buttons">
                {BLOCKED_SCENARIOS.map(({ label, reason, onClick }) => (
                  <button
                    key={reason}
                    type="button"
                    className="party-workspace-demo-panel-button party-workspace-demo-panel-button--blocked"
                    onClick={onClick ?? (() => demoSetBlockedOverride(reason))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="party-workspace-demo-panel-group">
              <button
                type="button"
                className="party-workspace-demo-panel-button party-workspace-demo-panel-button--reset"
                onClick={demoSyncPreviewWithActual}
              >
                Синхронизировать с актуальным
              </button>
            </div>

            <div className="party-workspace-demo-panel-group">
              <button
                type="button"
                className="party-workspace-demo-panel-button party-workspace-demo-panel-button--reset"
                onClick={demoResetToDefault}
              >
                Сброс демо
              </button>
            </div>
          </>
        )}

        {mode === 'preview' && (
          <>
            <details className="party-workspace-demo-panel-accordion" open>
              <summary className="party-workspace-demo-panel-accordion-summary">
                Режим превью
              </summary>
              <div className="party-workspace-demo-panel-accordion-content">
                <div className="party-workspace-demo-panel-buttons">
                  <button
                    type="button"
                    className="party-workspace-demo-panel-button"
                    onClick={() => demoSetPreviewLifecycle('draft')}
                  >
                    Черновик
                  </button>
                  <button
                    type="button"
                    className="party-workspace-demo-panel-button"
                    onClick={() => demoSetPreviewLifecycle('ready')}
                  >
                    Скоро начнём
                  </button>
                  <button
                    type="button"
                    className="party-workspace-demo-panel-button"
                    onClick={() => demoSetPreviewLifecycle('completed')}
                  >
                    Вечеринка окончена
                  </button>
                  <button
                    type="button"
                    className="party-workspace-demo-panel-button party-workspace-demo-panel-button--live"
                    onClick={demoSetPreviewLive}
                  >
                    Эфир (live)
                  </button>
                </div>
                <div className="party-workspace-demo-panel-track-row">
                  <span className="party-workspace-demo-panel-track-label">Трек в эфире:</span>
                  <button
                    type="button"
                    className="party-workspace-demo-panel-stepper"
                    onClick={() => handlePreviewTrackChange(boundedTrackNumber - 1)}
                    disabled={!hasPreviewTracks}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, previewTrackCount)}
                    value={boundedTrackNumber}
                    className="party-workspace-demo-panel-track-input"
                    onChange={(event) => handlePreviewTrackChange(Number(event.target.value))}
                    disabled={!hasPreviewTracks}
                  />
                  <button
                    type="button"
                    className="party-workspace-demo-panel-stepper"
                    onClick={() => handlePreviewTrackChange(boundedTrackNumber + 1)}
                    disabled={!hasPreviewTracks}
                  >
                    +
                  </button>
                  <span className="party-workspace-demo-panel-track-total">
                    / {previewTrackCount}
                  </span>
                </div>
                {previewDesignOptions.length > 0 && (
                  <PartyDesignSettingsBlock
                    key={`preview-design-${previewThemeId}`}
                    themeId={previewThemeId}
                    customizationSettings={previewCustomizationSettings}
                    onThemeIdChange={demoSetPreviewTheme}
                    onCustomizationSettingsChange={demoSetPreviewCustomizationSettings}
                    visibleThemeIds={previewDesignOptions
                      .filter((item) => item.isAvailable)
                      .map((item) => item.id)}
                    lockedThemes={previewDesignOptions
                      .filter((item) => !item.isAvailable)
                      .map((item) => ({
                        themeId: item.id,
                        packageCode: 'preview-unavailable',
                        packageName: 'Недоступно',
                      }))}
                    allowLockedSelection
                    showApplyButton
                    applyButtonLabel="Изменить дизайн"
                  />
                )}
              </div>
            </details>

            <details className="party-workspace-demo-panel-accordion">
              <summary className="party-workspace-demo-panel-accordion-summary">
                Разрыв соединения
              </summary>
              <div className="party-workspace-demo-panel-accordion-content">
                <div className="party-workspace-demo-panel-buttons">
                  {PREVIEW_CONNECTION_SCENARIOS.map(({ label, scenario }) => (
                    <button
                      key={scenario}
                      type="button"
                      className="party-workspace-demo-panel-button party-workspace-demo-panel-button--blocked"
                      onClick={() => demoSetPreviewConnectionBreak(scenario)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </details>

            <div className="party-workspace-demo-panel-group">
              <button
                type="button"
                className="party-workspace-demo-panel-button party-workspace-demo-panel-button--reset"
                onClick={demoResetToDefault}
              >
                Сброс демо
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

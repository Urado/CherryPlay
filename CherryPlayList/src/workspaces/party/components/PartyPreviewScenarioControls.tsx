import { type PartyThemeId, type PlaybackState } from '@cherryplay/components';
import { Button, Disclosure } from '@cherryplay/components';
import React, { useMemo } from 'react';

import type { PartyLifecycleState } from '@shared/services/partyService';

import {
  resetPreviewScenario,
  setPreviewConnectionBreak,
  setPreviewCustomizationSettings,
  setPreviewLifecycleOverride,
  setPreviewMockLive,
  setPreviewTheme,
  setPreviewTrackNumber,
  type PreviewConnectionScenario,
} from '../partyPreviewScenarioActions';
import { usePartyPreviewScenarioStore } from '../partyPreviewScenarioStore';

import { PartyDesignSettingsBlock } from './PartyDesignSettingsBlock';

import '../PartyWorkspaceDemoPanel.css';

export type PartyPreviewScenarioControlsVariant = 'toolbar' | 'panel';

export type PartyPreviewScenarioControlsSection = 'quick' | 'expanded' | 'all';

export interface PartyPreviewDesignOption {
  id: PartyThemeId;
  name: string;
  isAvailable: boolean;
}

export interface PartyPreviewScenarioPlaybackContext {
  isSynchronized: boolean;
  previewLifecycleState: PartyLifecycleState | null;
  effectivePlaybackState: PlaybackState | null;
}

interface PartyPreviewScenarioControlsProps {
  variant: PartyPreviewScenarioControlsVariant;
  section?: PartyPreviewScenarioControlsSection;
  previewTrackIds: readonly string[];
  playbackContext: PartyPreviewScenarioPlaybackContext;
  previewThemeId: PartyThemeId;
  previewCustomizationSettings: Record<string, unknown>;
  previewDesignOptions: PartyPreviewDesignOption[];
}

const LIFECYCLE_PRESETS: { label: string; lifecycle: PartyLifecycleState }[] = [
  { label: 'Не на сайте', lifecycle: 'draft' },
  { label: 'Опубликована', lifecycle: 'ready' },
  { label: 'Архив', lifecycle: 'completed' },
];

const CONNECTION_SCENARIOS: { label: string; scenario: PreviewConnectionScenario }[] = [
  { label: 'Подключение…', scenario: 'connecting' },
  { label: 'Нет связи с сервером', scenario: 'server_unreachable' },
  { label: 'Переподключение…', scenario: 'reconnecting' },
  { label: 'Организатор не в сети', scenario: 'organizer_offline' },
];

function shouldShowSection(
  section: PartyPreviewScenarioControlsSection,
  target: 'quick' | 'expanded',
): boolean {
  if (section === 'all') {
    return true;
  }
  return section === target;
}

export const PartyPreviewScenarioControls: React.FC<PartyPreviewScenarioControlsProps> = ({
  variant,
  section = 'all',
  previewTrackIds,
  playbackContext,
  previewThemeId,
  previewCustomizationSettings,
  previewDesignOptions,
}) => {
  const { isSynchronized, previewLifecycleState, effectivePlaybackState } = playbackContext;

  const lifecycleOverride = usePartyPreviewScenarioStore((state) => state.lifecycleOverride);
  const mockLiveEnabled = usePartyPreviewScenarioStore((state) => state.mockLiveEnabled);
  const currentTrackNumber = usePartyPreviewScenarioStore((state) => state.currentTrackNumber);

  const hasPreviewTracks = previewTrackIds.length > 0;
  const activeLifecycle = isSynchronized ? previewLifecycleState : lifecycleOverride;
  const activeMockLive = isSynchronized
    ? effectivePlaybackState?.status === 'playing'
    : mockLiveEnabled;

  const displayTrackNumber = useMemo(() => {
    if (isSynchronized) {
      if (!hasPreviewTracks || !effectivePlaybackState?.currentTrackId) {
        return 1;
      }
      const index = previewTrackIds.indexOf(effectivePlaybackState.currentTrackId);
      return index >= 0 ? index + 1 : 1;
    }
    if (!hasPreviewTracks) {
      return 1;
    }
    return Math.min(Math.max(currentTrackNumber ?? 1, 1), previewTrackIds.length);
  }, [
    isSynchronized,
    hasPreviewTracks,
    previewTrackIds,
    effectivePlaybackState,
    currentTrackNumber,
  ]);

  const handlePreviewTrackChange = (nextValue: number | null) => {
    if (!hasPreviewTracks) {
      return;
    }
    if (nextValue == null) {
      setPreviewTrackNumber(1);
      return;
    }
    const bounded = Math.min(Math.max(nextValue, 1), previewTrackIds.length);
    setPreviewTrackNumber(bounded);
  };

  const buttonClassName = (isActive = false, modifier?: string) => {
    const base = 'party-workspace-demo-panel-button';
    const classes = [base];
    if (modifier) {
      classes.push(`${base}--${modifier}`);
    }
    if (isActive && variant === 'toolbar') {
      classes.push('party-preview-scenario-controls-button--active');
    }
    return classes.join(' ');
  };

  const lifecycleBlock = (
    <div
      className={`party-preview-scenario-controls-group${
        variant === 'toolbar' ? ' party-preview-scenario-controls-group--inline' : ''
      }`}
    >
      {variant === 'panel' && (
        <span className="party-workspace-demo-panel-group-label">Режим превью</span>
      )}
      <div className="party-workspace-demo-panel-buttons">
        {LIFECYCLE_PRESETS.map(({ label, lifecycle }) => (
          <Button
            key={lifecycle}
            type="button"
            className={buttonClassName(activeLifecycle === lifecycle)}
            onClick={() => setPreviewLifecycleOverride(lifecycle)}
            variant="secondary"
            size="sm"
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          className={buttonClassName(activeMockLive, 'live')}
          onClick={setPreviewMockLive}
          variant="secondary"
          size="sm"
        >
          Эфир (live)
        </Button>
      </div>
    </div>
  );

  const trackBlock = (
    <div className="party-workspace-demo-panel-track-row">
      <span className="party-workspace-demo-panel-track-label">Трек в эфире:</span>
      <button
        type="button"
        className="party-workspace-demo-panel-stepper"
        onClick={() => handlePreviewTrackChange(displayTrackNumber - 1)}
        disabled={!hasPreviewTracks}
        aria-label="Предыдущий трек"
      >
        -
      </button>
      <input
        type="number"
        min={1}
        max={Math.max(1, previewTrackIds.length)}
        value={displayTrackNumber}
        className="party-workspace-demo-panel-track-input"
        onChange={(event) => handlePreviewTrackChange(Number(event.target.value))}
        disabled={!hasPreviewTracks}
        aria-label="Номер трека в эфире"
      />
      <button
        type="button"
        className="party-workspace-demo-panel-stepper"
        onClick={() => handlePreviewTrackChange(displayTrackNumber + 1)}
        disabled={!hasPreviewTracks}
        aria-label="Следующий трек"
      >
        +
      </button>
      <span className="party-workspace-demo-panel-track-total">/ {previewTrackIds.length}</span>
    </div>
  );

  const connectionBlock =
    variant === 'panel' ? (
      <Disclosure
        title="Разрыв соединения"
        className="party-workspace-demo-panel-accordion party-preview-scenario-controls-connection-accordion"
      >
        <div className="party-workspace-demo-panel-accordion-content">
          <div className="party-workspace-demo-panel-buttons">
            {CONNECTION_SCENARIOS.map(({ label, scenario }) => (
              <Button
                key={scenario}
                type="button"
                className="party-workspace-demo-panel-button party-workspace-demo-panel-button--blocked"
                onClick={() => setPreviewConnectionBreak(scenario)}
                variant="secondary"
                size="sm"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Disclosure>
    ) : (
      <div className="party-preview-scenario-controls-group">
        <span className="party-workspace-demo-panel-group-label">Разрыв соединения</span>
        <div className="party-workspace-demo-panel-buttons">
          {CONNECTION_SCENARIOS.map(({ label, scenario }) => (
            <Button
              key={scenario}
              type="button"
              className="party-workspace-demo-panel-button party-workspace-demo-panel-button--blocked"
              onClick={() => setPreviewConnectionBreak(scenario)}
              variant="secondary"
              size="sm"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    );

  const designBlock =
    previewDesignOptions.length > 0 ? (
      <PartyDesignSettingsBlock
        key={`preview-design-${previewThemeId}`}
        themeId={previewThemeId}
        customizationSettings={previewCustomizationSettings}
        onThemeIdChange={setPreviewTheme}
        onCustomizationSettingsChange={setPreviewCustomizationSettings}
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
    ) : null;

  const resetBlock = (
    <div className="party-workspace-demo-panel-group">
      <Button
        type="button"
        className="party-workspace-demo-panel-button party-workspace-demo-panel-button--reset"
        onClick={resetPreviewScenario}
        variant="secondary"
        size="sm"
      >
        Снова как на сайте
      </Button>
    </div>
  );

  const showQuick = shouldShowSection(section, 'quick');
  const showExpanded = shouldShowSection(section, 'expanded');

  if (variant === 'toolbar' && section === 'quick') {
    return (
      <div className="party-preview-scenario-controls party-preview-scenario-controls--toolbar-quick">
        {lifecycleBlock}
        {hasPreviewTracks && trackBlock}
      </div>
    );
  }

  if (variant === 'toolbar' && section === 'expanded') {
    return (
      <div className="party-preview-scenario-controls party-preview-scenario-controls--toolbar-expanded">
        {connectionBlock}
        {designBlock}
        {resetBlock}
      </div>
    );
  }

  return (
    <div className={`party-preview-scenario-controls party-preview-scenario-controls--${variant}`}>
      {showQuick && (
        <>
          {lifecycleBlock}
          {hasPreviewTracks && trackBlock}
        </>
      )}
      {showExpanded && (
        <>
          {connectionBlock}
          {designBlock}
          {resetBlock}
        </>
      )}
    </div>
  );
};

import { type PartyThemeId } from '@cherryplay/components';
import React from 'react';

import {
  PartyDesignSettingsBlock,
  type PartyDesignLockedThemeInfo,
} from './PartyDesignSettingsBlock';
import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyDesignSectionProps {
  themeId: PartyThemeId;
  customizationSettings: Record<string, unknown>;
  onThemeIdChange: (themeId: PartyThemeId) => void;
  onCustomizationSettingsChange: (settings: Record<string, unknown>) => void;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  lockedThemes?: PartyDesignLockedThemeInfo[];
  visibleThemeIds?: PartyThemeId[] | null;
  isThemeAccessLoading?: boolean;
  themeAccessErrorMessage?: string | null;
  showNoAccessibleThemesHint?: boolean;
  selectedLockedTheme?: PartyDesignLockedThemeInfo | null;
}

export const PartyDesignSection: React.FC<PartyDesignSectionProps> = ({
  themeId,
  customizationSettings,
  onThemeIdChange,
  onCustomizationSettingsChange,
  readOnly = false,
  defaultExpanded = false,
  lockedThemes = [],
  visibleThemeIds = null,
  isThemeAccessLoading = false,
  themeAccessErrorMessage = null,
  showNoAccessibleThemesHint = false,
  selectedLockedTheme = null,
}) => {
  return (
    <PartyEditorAccordion title="Стиль оформления" defaultExpanded={defaultExpanded}>
      <PartyDesignSettingsBlock
        themeId={themeId}
        customizationSettings={customizationSettings}
        onThemeIdChange={onThemeIdChange}
        onCustomizationSettingsChange={onCustomizationSettingsChange}
        readOnly={readOnly}
        lockedThemes={lockedThemes}
        visibleThemeIds={visibleThemeIds}
        isThemeAccessLoading={isThemeAccessLoading}
        themeAccessErrorMessage={themeAccessErrorMessage}
        hideSectionLabel
      />
      {showNoAccessibleThemesHint && (
        <div className="party-editor-theme-access-hint">Нет доступных тем в вашем тарифе.</div>
      )}
      {selectedLockedTheme && (
        <div className="party-editor-theme-restricted-note">
          Текущая тема больше не входит в ваш доступ. Вы можете сохранить как есть или переключиться
          на доступную тему.
        </div>
      )}
    </PartyEditorAccordion>
  );
};

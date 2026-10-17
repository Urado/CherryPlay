import type { PartyTrackDisplaySettings } from '@core/types/project';
import React from 'react';

import { PartyDesignSection } from './PartyDesignSection';
import type { PartyDesignSectionProps } from './PartyDesignSection';
import { PartyEditorAccordion } from './PartyEditorAccordion';
import { PartyTrackDisplaySection } from './PartyTrackDisplaySection';

import './PartyEditor.css';

export interface PartyGuestPageSectionProps
  extends Omit<PartyDesignSectionProps, 'defaultExpanded' | 'designPreviewHint'> {
  partyTitle: string;
  partySubtitle: string;
  projectName?: string;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  designPreviewHint?: React.ReactNode;
  showTrackDisplay?: boolean;
  partyTrackDisplay?: PartyTrackDisplaySettings | Partial<PartyTrackDisplaySettings>;
  onPartyTrackDisplayChange?: (value: PartyTrackDisplaySettings) => void;
  onPartyTitleChange?: (title: string) => void;
  onPartySubtitleChange?: (subtitle: string) => void;
}

export const PartyGuestPageSection: React.FC<PartyGuestPageSectionProps> = ({
  partyTitle,
  partySubtitle,
  projectName = '',
  readOnly = false,
  defaultExpanded = false,
  designPreviewHint,
  showTrackDisplay = false,
  partyTrackDisplay,
  onPartyTrackDisplayChange,
  onPartyTitleChange,
  onPartySubtitleChange,
  ...designProps
}) => {
  const trimmedProjectName = projectName.trim();
  const titlePlaceholder =
    trimmedProjectName.length > 0
      ? `Если пусто — «${trimmedProjectName}»`
      : 'Если пусто — показывается название';

  return (
    <PartyEditorAccordion title="Страница вечеринки" defaultExpanded={defaultExpanded}>
      <div className="party-editor-fields-group__fields">
        <div className="party-editor-section">
          <label className="party-editor-label">
            Заголовок (на экране)
            <input
              type="text"
              className="party-editor-input"
              value={partyTitle}
              onChange={(e) => onPartyTitleChange?.(e.target.value)}
              placeholder={titlePlaceholder}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </label>
        </div>

        <div className="party-editor-section">
          <label className="party-editor-label">
            Подзаголовок
            <input
              type="text"
              className="party-editor-input"
              value={partySubtitle}
              onChange={(e) => onPartySubtitleChange?.(e.target.value)}
              placeholder="Строка под заголовком"
              readOnly={readOnly}
              disabled={readOnly}
            />
          </label>
        </div>
      </div>

      {showTrackDisplay && partyTrackDisplay != null && onPartyTrackDisplayChange ? (
        <div className="party-editor-fields-group">
          <h4 className="party-editor-fields-group__title">Отображение треков</h4>
          <PartyTrackDisplaySection
            value={partyTrackDisplay}
            onChange={onPartyTrackDisplayChange}
          />
        </div>
      ) : null}

      <div className="party-editor-fields-group">
        <h4 className="party-editor-fields-group__title">Стиль оформления</h4>
        {designPreviewHint}
        <PartyDesignSection {...designProps} readOnly={readOnly} layout="embedded" />
      </div>
    </PartyEditorAccordion>
  );
};

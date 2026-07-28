import React from 'react';

import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyInfoSectionProps {
  partyName: string;
  partyTitle: string;
  partySubtitle: string;
  /** Shown as party-name placeholder / empty-name display fallback. */
  projectName?: string;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  onPartyNameChange: (name: string) => void;
  onPartyTitleChange?: (title: string) => void;
  onPartySubtitleChange?: (subtitle: string) => void;
}

export const PartyInfoSection: React.FC<PartyInfoSectionProps> = ({
  partyName,
  partyTitle,
  partySubtitle,
  projectName = '',
  readOnly = false,
  defaultExpanded = false,
  onPartyNameChange,
  onPartyTitleChange,
  onPartySubtitleChange,
}) => {
  const trimmedProjectName = projectName.trim();
  const partyNamePlaceholder =
    trimmedProjectName.length > 0
      ? `Если пусто — «${trimmedProjectName}»`
      : 'Введите название вечеринки';
  const titlePlaceholder =
    partyName.trim().length > 0
      ? 'Если пусто — показывается название'
      : trimmedProjectName.length > 0
        ? `Если пусто — «${trimmedProjectName}»`
        : 'Если пусто — показывается название';

  return (
    <PartyEditorAccordion title="Информация о вечеринке" defaultExpanded={defaultExpanded}>
      <div className="party-editor-fields-group__fields">
        <div className="party-editor-section">
          <label className="party-editor-label">
            Название вечеринки
            <input
              type="text"
              className="party-editor-input"
              value={partyName}
              onChange={(e) => onPartyNameChange(e.target.value)}
              placeholder={partyNamePlaceholder}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </label>
        </div>

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
    </PartyEditorAccordion>
  );
};

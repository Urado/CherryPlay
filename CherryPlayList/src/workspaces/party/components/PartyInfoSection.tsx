import React from 'react';

import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyInfoSectionProps {
  partyName: string;
  partyTitle: string;
  partySubtitle: string;
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
  readOnly = false,
  defaultExpanded = true,
  onPartyNameChange,
  onPartyTitleChange,
  onPartySubtitleChange,
}) => {
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
              placeholder="Введите название вечеринки"
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
              placeholder="Если пусто — показывается название"
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

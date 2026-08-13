import { Button } from '@cherryplay/components';
import React from 'react';

import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyInfoSectionProps {
  partyName: string;
  partyTitle: string;
  partySubtitle: string;
  projectName?: string;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  partyUrl?: string | null;
  showCopyUrl?: boolean;
  copyUrlDisabled?: boolean;
  copyUrlTitle?: string;
  onCopyUrl?: () => void;
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
  partyUrl = null,
  showCopyUrl = false,
  copyUrlDisabled = false,
  copyUrlTitle = 'Скопировать URL вечеринки',
  onCopyUrl,
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
  const showUrlCopy = showCopyUrl && Boolean(partyUrl) && Boolean(onCopyUrl);

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

        {showUrlCopy ? (
          <div className="party-editor-section party-editor-url-section">
            <label className="party-editor-label" htmlFor="party-editor-public-url">
              URL вечеринки
            </label>
            <div className="party-editor-url-group">
              <input
                id="party-editor-public-url"
                type="text"
                className="party-editor-input party-editor-url-input"
                value={partyUrl ?? ''}
                readOnly
                aria-readonly="true"
              />
              <Button
                type="button"
                className="party-editor-url-button"
                onClick={() => void onCopyUrl?.()}
                variant="secondary"
                size="sm"
                disabled={copyUrlDisabled}
                title={copyUrlTitle}
              >
                Скопировать
              </Button>
            </div>
          </div>
        ) : null}

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

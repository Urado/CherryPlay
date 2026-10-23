import React from 'react';

import { HelpHint } from '../../../shared/components/HelpHint';

import { PartyDesignSection } from './PartyDesignSection';
import type { PartyDesignSectionProps } from './PartyDesignSection';
import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyGuestPageSectionProps extends Omit<
  PartyDesignSectionProps,
  'defaultExpanded' | 'designPreviewHint'
> {
  partyTitle: string;
  partySubtitle: string;
  projectName?: string;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  designPreviewHint?: React.ReactNode;
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
    <PartyEditorAccordion
      title="Страница вечеринки"
      defaultExpanded={defaultExpanded}
      headerTrailing={
        <HelpHint label="Справка: страница вечеринки">
          Гости открывают эту страницу с плейлистом по ссылке. Если заголовок не заполнен,
          используется название проекта.
        </HelpHint>
      }
    >
      <div className="party-editor-fields-group__fields">
        <div className="party-editor-section">
          <label className="party-editor-label">
            Заголовок страницы
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

      <div className="party-editor-fields-group">
        <div className="party-editor-heading-row">
          <h4 className="party-editor-fields-group__title">Стиль оформления</h4>
          {designPreviewHint ? (
            <HelpHint label="Справка: стиль оформления">{designPreviewHint}</HelpHint>
          ) : null}
        </div>
        <PartyDesignSection {...designProps} readOnly={readOnly} layout="embedded" />
      </div>
    </PartyEditorAccordion>
  );
};

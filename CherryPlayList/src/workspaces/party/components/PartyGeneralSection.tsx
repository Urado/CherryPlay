import { Button } from '@cherryplay/components';
import React from 'react';

import { ProjectNameInput } from '../../../app/components/ProjectNameInput';

import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyGeneralSectionProps {
  readOnly?: boolean;
  defaultExpanded?: boolean;
  partyUrl?: string | null;
  showCopyUrl?: boolean;
  copyUrlDisabled?: boolean;
  copyUrlTitle?: string;
  onCopyUrl?: () => void;
}

export const PartyGeneralSection: React.FC<PartyGeneralSectionProps> = ({
  readOnly = false,
  defaultExpanded = false,
  partyUrl = null,
  showCopyUrl = false,
  copyUrlDisabled = false,
  copyUrlTitle = 'Скопировать URL вечеринки',
  onCopyUrl,
}) => {
  const showUrlCopy = showCopyUrl && Boolean(partyUrl) && Boolean(onCopyUrl);

  return (
    <PartyEditorAccordion title="Общие настройки вечеринки" defaultExpanded={defaultExpanded}>
      <div className="party-editor-fields-group__fields">
        <div className="party-editor-section">
          <span className="party-editor-label">Название проекта</span>
          <ProjectNameInput
            disabled={readOnly}
            title={readOnly ? 'Редактирование недоступно' : 'Название проекта в CherryPlay'}
          />
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
      </div>
    </PartyEditorAccordion>
  );
};

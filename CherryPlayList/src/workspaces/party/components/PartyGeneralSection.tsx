import { Button } from '@cherryplay/components';
import React from 'react';

import { ProjectNameInput } from '../../../app/components/ProjectNameInput';
import { HelpHint } from '../../../shared/components/HelpHint';

import './PartyEditor.css';

export interface PartyGeneralSectionProps {
  readOnly?: boolean;
  catalogVisibilityControl?: React.ReactNode;
  partyUrl?: string | null;
  showCopyUrl?: boolean;
  copyUrlDisabled?: boolean;
  copyUrlTitle?: string;
  onCopyUrl?: () => void;
}

export const PartyGeneralSection: React.FC<PartyGeneralSectionProps> = ({
  readOnly = false,
  catalogVisibilityControl,
  partyUrl = null,
  showCopyUrl = false,
  copyUrlDisabled = false,
  copyUrlTitle = 'Скопировать URL вечеринки',
  onCopyUrl,
}) => {
  const showUrlCopy = showCopyUrl && Boolean(partyUrl) && Boolean(onCopyUrl);

  return (
    <section className="party-general-section" aria-label="Настройки проекта">
      <div className="party-editor-fields-group__fields party-editor-fields-group__fields--single">
        <div className="party-editor-section">
          <div className="party-editor-heading-row">
            <span className="party-editor-label">Название проекта</span>
            <HelpHint label="Справка: название проекта">
              Если не задать отдельные названия для каталога и страницы гостей, используется
              название проекта.
            </HelpHint>
          </div>
          <ProjectNameInput
            className="party-editor-input"
            disabled={readOnly}
            title={readOnly ? 'Редактирование недоступно' : 'Название проекта в CherryPlay'}
          />
        </div>

        {showUrlCopy ? (
          <div className="party-editor-section party-editor-url-section">
            <label className="party-editor-label" htmlFor="party-editor-public-url">
              Ссылка для гостей
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
      {catalogVisibilityControl ? (
        <div className="party-general-section__visibility">
          <div className="party-editor-heading-row">
            <span className="party-editor-label">Видимость вечеринки</span>
            <HelpHint label="Справка: видимость вечеринки">
              «По ссылке» — вечеринку увидят только те, у кого есть ссылка. «В каталоге» — гости
              смогут найти её в общем каталоге.
            </HelpHint>
          </div>
          {catalogVisibilityControl}
        </div>
      ) : null}
    </section>
  );
};

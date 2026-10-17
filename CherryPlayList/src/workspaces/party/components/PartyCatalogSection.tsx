import React from 'react';

import type { PartyEditorPhase } from '../partyEditorPhase';

import type { PartyCardFieldsSectionProps } from './PartyCardFieldsSection';
import { PartyCatalogCardFields } from './PartyCardFieldsSection';
import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyCatalogSectionProps
  extends Omit<PartyCardFieldsSectionProps, 'defaultExpanded'> {
  partyName: string;
  onPartyNameChange: (name: string) => void;
  projectName?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  sectionRef?: React.Ref<HTMLElement>;
  headerTrailing?: React.ReactNode;
  isListedInCatalog?: boolean;
  editorPhase?: PartyEditorPhase | null;
  showDraftCatalogHint?: boolean;
}

export const PartyCatalogSection: React.FC<PartyCatalogSectionProps> = ({
  partyName,
  onPartyNameChange,
  projectName = '',
  readOnly = false,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  sectionRef,
  headerTrailing,
  isListedInCatalog = true,
  editorPhase = null,
  showDraftCatalogHint = false,
  ...cardFieldsProps
}) => {
  const trimmedProjectName = projectName.trim();
  const partyNamePlaceholder =
    trimmedProjectName.length > 0
      ? `Если пусто — «${trimmedProjectName}»`
      : 'Название в списке каталога';
  const linkOnly = !isListedInCatalog;
  const fieldsClassName = linkOnly
    ? 'party-editor-catalog-fields party-editor-catalog-fields--link-only'
    : 'party-editor-catalog-fields';

  return (
    <PartyEditorAccordion
      title="Каталог"
      defaultExpanded={defaultExpanded}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      sectionRef={sectionRef}
      headerTrailing={headerTrailing}
      summary={
        editorPhase === 'draft-unlinked' && showDraftCatalogHint
          ? 'Видимость в каталоге — здесь'
          : undefined
      }
    >
      {editorPhase === 'draft-unlinked' && showDraftCatalogHint ? (
        <p className="party-editor-catalog-draft-hint">
          Выберите «По ссылке» или «В каталоге» в заголовке секции перед созданием вечеринки.
        </p>
      ) : null}

      {linkOnly ? (
        <p className="party-editor-catalog-link-only-hint">
          Вечеринка только по ссылке — поля каталога можно заполнить заранее или оставить пустыми.
        </p>
      ) : null}

      <div className={fieldsClassName}>
        <div className="party-editor-fields-group__fields">
          <div className="party-editor-section">
            <label className="party-editor-label">
              Название в каталоге
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
        </div>

        <PartyCatalogCardFields {...cardFieldsProps} readOnly={readOnly} />
      </div>
    </PartyEditorAccordion>
  );
};

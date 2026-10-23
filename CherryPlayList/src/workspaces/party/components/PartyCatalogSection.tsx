import React from 'react';

import { HelpHint } from '../../../shared/components/HelpHint';
import type { PartyEditorPhase } from '../partyEditorPhase';

import type { PartyCardFieldsSectionProps } from './PartyCardFieldsSection';
import { PartyCatalogCardFields } from './PartyCardFieldsSection';
import { PartyEditorAccordion } from './PartyEditorAccordion';

import './PartyEditor.css';

export interface PartyCatalogSectionProps extends Omit<
  PartyCardFieldsSectionProps,
  'defaultExpanded'
> {
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
      title="Карточка в каталоге"
      defaultExpanded={defaultExpanded}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      sectionRef={sectionRef}
      headerTrailing={
        <>
          {headerTrailing}
          <HelpHint label="Справка: карточка в каталоге">
            Название, время, город и описание помогают гостям найти вечеринку.
            {linkOnly
              ? ' В режиме «По ссылке» поля каталога можно оставить пустыми или заполнить заранее.'
              : ' Карточка отображается в каталоге вечеринок.'}
          </HelpHint>
        </>
      }
      summary={
        editorPhase === 'draft-unlinked' && showDraftCatalogHint
          ? 'Видимость в каталоге — здесь'
          : undefined
      }
    >
      <div className={fieldsClassName}>
        <div className="party-editor-fields-group__fields party-editor-fields-group__fields--single">
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

import { Button, DEFAULT_PARTY_THEME_ID } from '@cherryplay/components';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PartyLifecycleControls } from '../components/PartyLifecycleControls';
import { canToggleCatalogVisibility } from '../constants/partyLifecycle';
import { ROUTES } from '../constants/routes';
import type {
  CreatePartyDto,
  PartyDto,
  PartyLifecycleState,
  ThemeAccessDto,
  UpdatePartyDto,
} from '../types/api';

import { CabinetPartyForm } from './CabinetPartyForm';

export interface CabinetPartyListProps {
  parties: PartyDto[];
  togglingPartyId: string | null;
  deletingPartyId: string | null;
  expandedPartyId: string | null;
  editingParty: PartyDto | null;
  editForm: UpdatePartyDto;
  setEditForm: React.Dispatch<React.SetStateAction<UpdatePartyDto>>;
  savingEdit: boolean;
  themeAccess: ThemeAccessDto | null;
  themeAccessError: string | null;
  onSelectLockedTheme: (themeId: string) => void;
  onEdit: (party: PartyDto) => void;
  onEditSubmit: (e: React.FormEvent) => void;
  onEditCancel: () => void;
  onToggleCatalog: (party: PartyDto) => void;
  onDeleteConfirm: (partyId: string) => void;
  transitioningPartyId: string | null;
  transitioningTargetState: PartyLifecycleState | null;
  onLifecycleTransition: (partyId: string, targetState: PartyLifecycleState) => void;
}

const emptyCreateForm: CreatePartyDto = {
  name: '',
  partyThemeId: DEFAULT_PARTY_THEME_ID,
  isListedInCatalog: false,
};

export const CabinetPartyList = ({
  parties,
  togglingPartyId,
  deletingPartyId,
  expandedPartyId,
  editingParty,
  editForm,
  setEditForm,
  savingEdit,
  themeAccess,
  themeAccessError,
  onSelectLockedTheme,
  onEdit,
  onEditSubmit,
  onEditCancel,
  onToggleCatalog,
  onDeleteConfirm,
  transitioningPartyId,
  transitioningTargetState,
  onLifecycleTransition,
}: CabinetPartyListProps) => {
  const [confirmingDeletePartyId, setConfirmingDeletePartyId] = useState<string | null>(null);

  return (
    <ul className="cabinet-party-list">
      {parties.map((party) => (
        <li
          key={party.id}
          className={`cabinet-party-item ${expandedPartyId === party.id ? 'cabinet-party-item--expanded' : ''}`}
        >
          <div className="cabinet-party-main">
            <span className="cabinet-party-name">{party.name}</span>
            <Link
              to={ROUTES.PARTY_VIEW(party.shortCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="cabinet-party-short cabinet-party-link"
              aria-label={`Открыть вечеринку «${party.name}»`}
            >
              /{party.shortCode}
            </Link>
          </div>
          <div className="cabinet-party-actions">
            {canToggleCatalogVisibility(party.partyLifecycleState) && (
              <label
                className="cabinet-toggle-label"
                title="Отдельно от статуса вечеринки: показывать в общем каталоге или только по ссылке"
              >
                <input
                  type="checkbox"
                  checked={party.isListedInCatalog}
                  disabled={togglingPartyId === party.id}
                  onChange={() => onToggleCatalog(party)}
                />
                В каталоге
              </label>
            )}
            <PartyLifecycleControls
              partyLifecycleState={party.partyLifecycleState}
              describedById="cabinet-lifecycle-overview"
              isTransitioning={transitioningPartyId === party.id}
              pendingTransition={
                transitioningPartyId === party.id ? transitioningTargetState : null
              }
              disabled={
                deletingPartyId === party.id ||
                togglingPartyId === party.id ||
                (expandedPartyId === party.id && savingEdit)
              }
              onTransition={(targetState) => onLifecycleTransition(party.id, targetState)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onEdit(party)}
              disabled={expandedPartyId === party.id}
            >
              {expandedPartyId === party.id ? 'Редактирование…' : 'Редактировать'}
            </Button>
            {confirmingDeletePartyId === party.id ? (
              <div
                className="cabinet-party-delete-confirmation"
                role="group"
                aria-label={`Подтвердить удаление вечеринки «${party.name}»`}
              >
                <span>Удалить вечеринку «{party.name}»? Это действие невозможно отменить.</span>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="cabinet-party-delete-confirm"
                  loading={deletingPartyId === party.id}
                  loadingLabel="Удаление…"
                  onClick={() => onDeleteConfirm(party.id)}
                >
                  Да
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="cabinet-party-delete-cancel"
                  disabled={deletingPartyId === party.id}
                  onClick={() => setConfirmingDeletePartyId(null)}
                >
                  Нет
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="cabinet-party-delete"
                loading={deletingPartyId === party.id}
                loadingLabel="Удаление…"
                onClick={() => setConfirmingDeletePartyId(party.id)}
              >
                Удалить
              </Button>
            )}
          </div>
          {expandedPartyId === party.id && editingParty?.id === party.id && (
            <div className="cabinet-party-edit">
              <CabinetPartyForm
                editingParty={editingParty}
                editForm={editForm}
                createForm={emptyCreateForm}
                setEditForm={setEditForm}
                setCreateForm={() => {}}
                savingEdit={savingEdit}
                creating={false}
                themeAccess={themeAccess}
                themeAccessError={themeAccessError}
                onSelectLockedTheme={onSelectLockedTheme}
                onSubmit={onEditSubmit}
                onCancel={onEditCancel}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

import { Button, DEFAULT_PARTY_THEME_ID } from '@cherryplay/components';
import { Link } from 'react-router-dom';

import { PartyLifecycleControls } from '../components/PartyLifecycleControls';
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

export function CabinetPartyList({
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
}: CabinetPartyListProps) {
  return (
    <ul className="cabinet-party-list">
      {parties.map((party) => (
        <li
          key={party.id}
          className={`cabinet-party-item ${expandedPartyId === party.id ? 'cabinet-party-item--expanded' : ''}`}
        >
          <div className="cabinet-party-main">
            <span className="cabinet-party-name">{party.name}</span>
            <span className="cabinet-party-short">/{party.shortCode}</span>
            <Link
              to={ROUTES.PARTY_VIEW(party.shortCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="cabinet-party-link"
            >
              Открыть
            </Link>
          </div>
          <PartyLifecycleControls
            partyLifecycleState={party.partyLifecycleState}
            isTransitioning={transitioningPartyId === party.id}
            pendingTransition={transitioningPartyId === party.id ? transitioningTargetState : null}
            disabled={
              deletingPartyId === party.id ||
              togglingPartyId === party.id ||
              (expandedPartyId === party.id && savingEdit)
            }
            onTransition={(targetState) => onLifecycleTransition(party.id, targetState)}
          />
          <div className="cabinet-party-actions">
            {party.partyLifecycleState === 'ready' && (
              <label className="cabinet-toggle-label">
                <input
                  type="checkbox"
                  checked={party.isListedInCatalog}
                  disabled={togglingPartyId === party.id}
                  onChange={() => onToggleCatalog(party)}
                />
                В каталоге
              </label>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onEdit(party)}
              disabled={expandedPartyId === party.id}
            >
              {expandedPartyId === party.id ? 'Редактирование…' : 'Редактировать'}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={deletingPartyId === party.id}
              loadingLabel="Удаление…"
              onClick={() =>
                window.confirm(`Удалить вечеринку «${party.name}»?`) && onDeleteConfirm(party.id)
              }
            >
              Удалить
            </Button>
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
}

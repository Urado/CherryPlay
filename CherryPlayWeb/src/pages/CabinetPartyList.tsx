import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import type { CreatePartyDto, PartyDto, UpdatePartyDto } from '../types/api';

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
  onEdit: (party: PartyDto) => void;
  onEditSubmit: (e: React.FormEvent) => void;
  onEditCancel: () => void;
  onToggleCatalog: (party: PartyDto) => void;
  onDeleteConfirm: (partyId: string) => void;
}

const emptyCreateForm: CreatePartyDto = {
  name: '',
  partyThemeId: 'cyberpunk',
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
  onEdit,
  onEditSubmit,
  onEditCancel,
  onToggleCatalog,
  onDeleteConfirm,
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
          <div className="cabinet-party-actions">
            <label className="cabinet-toggle-label">
              <input
                type="checkbox"
                checked={party.isListedInCatalog}
                disabled={togglingPartyId === party.id}
                onChange={() => onToggleCatalog(party)}
              />
              В каталоге
            </label>
            <button
              type="button"
              className="cabinet-btn cabinet-btn-sm"
              onClick={() => onEdit(party)}
              disabled={expandedPartyId === party.id}
            >
              {expandedPartyId === party.id ? 'Редактирование…' : 'Редактировать'}
            </button>
            <button
              type="button"
              className="cabinet-btn cabinet-btn-sm cabinet-btn-danger"
              disabled={deletingPartyId === party.id}
              onClick={() =>
                window.confirm(`Удалить вечеринку «${party.name}»?`) && onDeleteConfirm(party.id)
              }
            >
              {deletingPartyId === party.id ? 'Удаление…' : 'Удалить'}
            </button>
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

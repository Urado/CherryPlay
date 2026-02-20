import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';
import type { PartyDto } from '../types/api';

export interface CabinetPartyListProps {
  parties: PartyDto[];
  togglingPartyId: string | null;
  deletingPartyId: string | null;
  onEdit: (party: PartyDto) => void;
  onToggleCatalog: (party: PartyDto) => void;
  onDeleteConfirm: (partyId: string) => void;
}

export function CabinetPartyList({
  parties,
  togglingPartyId,
  deletingPartyId,
  onEdit,
  onToggleCatalog,
  onDeleteConfirm,
}: CabinetPartyListProps) {
  return (
    <ul className="cabinet-party-list">
      {parties.map((party) => (
        <li key={party.id} className="cabinet-party-item">
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
            >
              Редактировать
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
        </li>
      ))}
    </ul>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

interface PartyViewBackLinkProps {
  to: string;
}

export const PartyViewBackLink: React.FC<PartyViewBackLinkProps> = ({ to }) => (
  <Link to={to} className="party-view-back-btn" title="Список вечеринок">
    ← Список вечеринок
  </Link>
);

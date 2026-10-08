import React from 'react';
import { Link } from 'react-router-dom';

interface PartyListCardLinkProps {
  to: string;
  partyName: string;
  children: React.ReactNode;
}

export const PartyListCardLink: React.FC<PartyListCardLinkProps> = ({
  to,
  partyName,
  children,
}) => (
  <Link
    to={to}
    className="party-list-card-open"
    aria-label={`Открыть вечеринку: ${partyName}`}
  >
    {children}
  </Link>
);

import {
  formatDateInTimeZone,
  getDefaultTimeZone,
  getPopularTimeZones,
  type OrganizerDto,
} from '@cherryplay/components';
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ROUTES } from '../constants/routes';
import { useAppConfig } from '../contexts/AppConfigContext';
import { authService } from '../services/authService';
import { partyApiService } from '../services/partyApiService';
import type { PublicPartyListItemDto } from '../types/api';
import { devLog } from '../utils/logger';
import './PartyListPage.css';

const RUSSIAN_CITIES = [
  'Москва',
  'Санкт-Петербург',
  'Новосибирск',
  'Екатеринбург',
  'Казань',
  'Нижний Новгород',
  'Челябинск',
  'Самара',
  'Ростов-на-Дону',
  'Уфа',
  'Красноярск',
  'Воронеж',
  'Пермь',
  'Волгоград',
  'Краснодар',
];

interface PartyListPageProps {
  onPartySelect: (shortCode: string) => void;
}

interface PartyFilters {
  dateFrom: string;
  dateTo: string;
  daysOfWeek: number[];
  timeZone: string;
  city: string;
}

export const PartyListPage: React.FC<PartyListPageProps> = ({ onPartySelect }) => {
  const { partyInfoPageEnabled } = useAppConfig();
  void partyInfoPageEnabled;
  const [parties, setParties] = useState<PublicPartyListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<OrganizerDto | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [filters, setFilters] = useState<PartyFilters>({
    dateFrom: '',
    dateTo: '',
    daysOfWeek: [],
    timeZone: '',
    city: '',
  });
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const loadParties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await partyApiService.getAllParties();
      setParties(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentOrganizer = await authService.checkAuth();
        setOrganizer(currentOrganizer);
      } catch (err) {
        devLog('[PartyListPage] Auth check failed (non-critical):', err);
        setOrganizer(null);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleRetry = () => {
    loadParties();
  };

  const filteredParties = parties.filter((party) => {
    if (filters.timeZone && party.timeZone !== filters.timeZone) {
      return false;
    }

    if (
      filters.city &&
      (party.city ?? '').trim().toLowerCase() !== filters.city.trim().toLowerCase()
    ) {
      return false;
    }

    if (party.eventDateTime) {
      const eventDate = new Date(party.eventDateTime);

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (eventDate < fromDate) {
          return false;
        }
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (eventDate > toDate) {
          return false;
        }
      }

      if (filters.daysOfWeek.length > 0) {
        const dayOfWeek = eventDate.getDay();
        if (!filters.daysOfWeek.includes(dayOfWeek)) {
          return false;
        }
      }
    } else {
      if (filters.dateFrom || filters.dateTo || filters.daysOfWeek.length > 0) {
        return false;
      }
    }

    return true;
  });

  const handleDayOfWeekToggle = (day: number) => {
    setFilters((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      daysOfWeek: [],
      timeZone: '',
      city: '',
    });
  };

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.daysOfWeek.length > 0 ||
    !!filters.timeZone ||
    !!filters.city;

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  if (loading) {
    return (
      <div className="party-list-page">
        <LoadingSpinner message="Загрузка списка вечеринок..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="party-list-page">
        <ErrorMessage message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="party-list-page">
      <div className="party-list-container">
        <div className="party-list-header">
          <h1 className="party-list-title">Вечеринки</h1>
          <div className="party-list-header-actions">
            {!authLoading &&
              (organizer ? (
                <Link to={ROUTES.CABINET} className="party-list-login-link">
                  Кабинет
                </Link>
              ) : (
                <Link to={ROUTES.LOGIN} className="party-list-login-link">
                  Вход
                </Link>
              ))}
            <button
              className="party-list-refresh-btn"
              onClick={loadParties}
              title="Обновить список"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Блок фильтров */}
        <div className="party-list-filters">
          <div className="party-list-filters-header">
            <button
              className="party-list-filters-toggle"
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            >
              <span>Фильтры</span>
              <span className="party-list-filters-toggle-icon">
                {isFiltersExpanded ? '▲' : '▼'}
              </span>
            </button>
            {hasActiveFilters && (
              <button className="party-list-filters-clear" onClick={clearFilters}>
                Сбросить
              </button>
            )}
          </div>

          {isFiltersExpanded && (
            <div className="party-list-filters-content">
              <div className="party-list-filters-group">
                <label className="party-list-filters-label">Дата от</label>
                <input
                  type="date"
                  className="party-list-filters-input"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>

              <div className="party-list-filters-group">
                <label className="party-list-filters-label">Дата до</label>
                <input
                  type="date"
                  className="party-list-filters-input"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>

              <div className="party-list-filters-group">
                <label className="party-list-filters-label">Дни недели</label>
                <div className="party-list-filters-days">
                  {dayNames.map((name, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`party-list-filters-day ${
                        filters.daysOfWeek.includes(index) ? 'party-list-filters-day--active' : ''
                      }`}
                      onClick={() => handleDayOfWeekToggle(index)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="party-list-filters-group">
                <label className="party-list-filters-label">Таймзона</label>
                <select
                  className="party-list-filters-input"
                  value={filters.timeZone}
                  onChange={(e) => setFilters((prev) => ({ ...prev, timeZone: e.target.value }))}
                >
                  <option value="">Любая</option>
                  {getPopularTimeZones().map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="party-list-filters-group">
                <label className="party-list-filters-label">Город</label>
                <select
                  className="party-list-filters-input"
                  value={filters.city}
                  onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
                >
                  <option value="">Любой</option>
                  {RUSSIAN_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {parties.length === 0 ? (
          <div className="party-list-empty">
            <p>Нет доступных вечеринок</p>
            <p className="party-list-empty-hint">Создайте вечеринку в приложении CherryPlayList</p>
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="party-list-empty">
            <p>Нет вечеринок, соответствующих фильтрам</p>
            {hasActiveFilters && (
              <button className="party-list-empty-clear" onClick={clearFilters}>
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="party-list-grid">
            {filteredParties.map((party) => (
              <div
                key={party.id}
                role="button"
                tabIndex={0}
                className="party-list-card"
                onClick={() => onPartySelect(party.shortCode)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPartySelect(party.shortCode);
                  }
                }}
              >
                <div className="party-list-card-header">
                  <h2 className="party-list-card-title">{party.name}</h2>
                </div>
                <div className="party-list-card-body">
                  {party.shortDescription && (
                    <p className="party-list-card-description">{party.shortDescription}</p>
                  )}
                  {party.city && (
                    <div className="party-list-card-info-item">
                      <span className="party-list-card-info-value">{party.city}</span>
                    </div>
                  )}
                  {party.eventDateTime && (
                    <div className="party-list-card-info-item">
                      <span className="party-list-card-info-value">
                        {formatDateInTimeZone(
                          party.eventDateTime,
                          party.timeZone ?? getDefaultTimeZone(),
                        )}
                      </span>
                    </div>
                  )}
                  {party.danceTags && party.danceTags.length > 0 && (
                    <div className="party-list-card-tags">
                      {party.danceTags.map((tag, index) => (
                        <span key={`${tag}-${index}`} className="party-list-card-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {party.externalLinkUrl &&
                    (() => {
                      const isSafeUrl =
                        party.externalLinkUrl.startsWith('http://') ||
                        party.externalLinkUrl.startsWith('https://');
                      const label = party.externalLinkText ?? 'Ссылка';
                      return isSafeUrl ? (
                        <a
                          href={party.externalLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="party-list-card-external-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="party-list-card-external-link party-list-card-external-link--text">
                          {label}
                        </span>
                      );
                    })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

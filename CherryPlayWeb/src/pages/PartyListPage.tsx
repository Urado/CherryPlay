/**
 * Страница со списком всех вечеринок
 */
import type { OrganizerDto } from '@cherryplay/components';
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { authService } from '../services/authService';
import { partyApiService } from '../services/partyApiService';
import type { PublicPartyListItemDto } from '../types/api';
import './PartyListPage.css';

interface PartyListPageProps {
  onPartySelect: (shortCode: string) => void;
}

interface PartyFilters {
  dateFrom: string;
  dateTo: string;
  daysOfWeek: number[];
}

export const PartyListPage: React.FC<PartyListPageProps> = ({ onPartySelect }) => {
  const [parties, setParties] = useState<PublicPartyListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<OrganizerDto | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [filters, setFilters] = useState<PartyFilters>({
    dateFrom: '',
    dateTo: '',
    daysOfWeek: [],
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

  // Проверка статуса аутентификации
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentOrganizer = await authService.checkAuth();
        setOrganizer(currentOrganizer);
      } catch (err) {
        // Ошибка проверки аутентификации не критична - просто считаем пользователя неавторизованным
        console.log('[PartyListPage] Auth check failed (non-critical):', err);
        setOrganizer(null);
      } finally {
        // Всегда устанавливаем authLoading в false, чтобы страница могла загрузиться
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getThemeName = (themeId: string): string => {
    const themes: Record<string, string> = {
      cyberpunk: 'Cyberpunk',
      sakura: 'Sakura',
      'art-deco': 'Art Deco',
    };
    return themes[themeId] || themeId;
  };

  const handleRetry = () => {
    loadParties();
  };

  // Фильтрация вечеринок
  const filteredParties = parties.filter((party) => {
    // Фильтр по датам
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

      // Фильтр по дням недели
      if (filters.daysOfWeek.length > 0) {
        const dayOfWeek = eventDate.getDay(); // 0 = воскресенье, 1 = понедельник, ...
        if (!filters.daysOfWeek.includes(dayOfWeek)) {
          return false;
        }
      }
    } else {
      // Если у вечеринки нет даты мероприятия, пропускаем её при фильтрации по датам
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
    });
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.daysOfWeek.length > 0;

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
                <Link to="/cabinet" className="party-list-login-link">
                  Кабинет
                </Link>
              ) : (
                <Link to="/login" className="party-list-login-link">
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
                className="party-list-card"
                onClick={() => onPartySelect(party.shortCode)}
              >
                <div className="party-list-card-header">
                  <h2 className="party-list-card-title">{party.name}</h2>
                  {party.hasActiveSession && (
                    <span className="party-list-card-badge party-list-card-badge--active">
                      В эфире
                    </span>
                  )}
                </div>
                <div className="party-list-card-body">
                  <div className="party-list-card-info">
                    <div className="party-list-card-info-item">
                      <span className="party-list-card-info-label">Тема:</span>
                      <span className="party-list-card-info-value">
                        {getThemeName(party.themeId)}
                      </span>
                    </div>
                    <div className="party-list-card-info-item">
                      <span className="party-list-card-info-label">Треков:</span>
                      <span className="party-list-card-info-value">{party.totalTracks}</span>
                    </div>
                    <div className="party-list-card-info-item">
                      <span className="party-list-card-info-label">Длительность:</span>
                      <span className="party-list-card-info-value">
                        {formatDuration(party.totalDuration)}
                      </span>
                    </div>
                    <div className="party-list-card-info-item">
                      <span className="party-list-card-info-label">Создана:</span>
                      <span className="party-list-card-info-value">
                        {formatDate(party.createdAt)}
                      </span>
                    </div>
                    {party.eventDateTime && (
                      <div className="party-list-card-info-item">
                        <span className="party-list-card-info-label">Мероприятие:</span>
                        <span className="party-list-card-info-value">
                          {formatDate(party.eventDateTime)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="party-list-card-footer">
                    <span className="party-list-card-code">Код: {party.shortCode}</span>
                    <Link
                      to={`/party/${party.shortCode}/info`}
                      className="party-list-card-info-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Подробнее
                    </Link>
                    <span className="party-list-card-arrow">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

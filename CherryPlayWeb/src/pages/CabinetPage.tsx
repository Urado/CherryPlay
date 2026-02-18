import type { OrganizerDto } from '@cherryplay/components';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authService } from '../services/authService';
import './CabinetPage.css';

export function CabinetPage() {
  const navigate = useNavigate();
  const [organizer, setOrganizer] = useState<OrganizerDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganizer = async () => {
      try {
        const currentOrganizer = await authService.checkAuth();
        if (!currentOrganizer) {
          console.log('[CabinetPage] Not authenticated, redirecting to login');
          navigate('/login');
          return;
        }
        setOrganizer(currentOrganizer);
        setLoading(false);
      } catch (error) {
        console.error('[CabinetPage] Error checking auth:', error);
        navigate('/login');
      }
    };

    loadOrganizer();
  }, [navigate]);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="cabinet-page">
        <div className="cabinet-container">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!organizer) {
    return null;
  }

  return (
    <div className="cabinet-page">
      <div className="cabinet-container">
        <div className="cabinet-header">
          <h1>Мой кабинет</h1>
          <button className="logout-button" onClick={handleLogout}>
            Выйти
          </button>
        </div>

        <div className="organizer-info">
          {organizer.logoUrl && (
            <img src={organizer.logoUrl} alt={organizer.name} className="organizer-logo" />
          )}

          <h2>{organizer.name}</h2>

          {organizer.links && Object.keys(organizer.links).length > 0 && (
            <div className="organizer-links">
              <h3>Ссылки:</h3>
              <ul>
                {Object.entries(organizer.links).map(([key, value]) => (
                  <li key={key}>
                    <a href={String(value)} target="_blank" rel="noopener noreferrer">
                      {key}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="organizer-meta">
            <p>Дата регистрации: {new Date(organizer.createdAt).toLocaleDateString('ru-RU')}</p>
          </div>
        </div>

        <div className="cabinet-placeholder">
          <p>Управление вечеринками будет доступно в следующей версии.</p>
        </div>
      </div>
    </div>
  );
}

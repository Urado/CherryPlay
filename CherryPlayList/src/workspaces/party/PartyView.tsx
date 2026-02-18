import {
  PlaybackState,
  type ThemeId,
  type CustomizationSettings,
  getDefaultCustomizationSettings,
} from '@cherryplay/components';
import { AuthForm } from '@cherryplay/components';
import React, { useState, useMemo, useEffect } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { authService } from '@shared/services/authService';
import { partyService, CreatePartyDto } from '@shared/services/partyService';
import {
  useAuthStore,
  useProjectStore,
  usePlayerAudioStore,
  usePartyStore,
  useUIStore,
} from '@shared/stores';
import {
  convertToComponentPlayerItems,
  calculatePartyTotalDuration,
  countTotalTracks,
  convertPlaylistForApi,
} from '@shared/utils';

import { PartyEditor } from './components/PartyEditor';
import { PartyPreview } from './PartyPreview';
import './PartyView.css';

interface PartyViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyView: React.FC<PartyViewProps> = ({
  workspaceId: _workspaceId,
  zoneId: _zoneId,
}) => {
  const items = useProjectStore((state) => state.items);

  const sessionState = useProjectStore((state) => state.sessionState);
  const { mode, currentTrackId, playedTrackIds, disabledTrackIds, disabledGroupIds } = useMemo(
    () => ({
      mode: sessionState.mode,
      currentTrackId: sessionState.currentTrackId,
      playedTrackIds: Array.from(sessionState.playedTrackIds),
      disabledTrackIds: Array.from(sessionState.disabledTrackIds),
      disabledGroupIds: Array.from(sessionState.disabledGroupIds),
    }),
    [sessionState],
  );

  const {
    status: audioStatus,
    position: audioPosition,
    duration: audioDuration,
    volume: audioVolume,
  } = usePlayerAudioStore((state) => ({
    status: state.status,
    position: state.position,
    duration: state.duration,
    volume: state.volume,
  }));

  const [partyName, setPartyName] = useState('');
  const [themeId, setThemeId] = useState<ThemeId>('cyberpunk');
  const [customizationSettings, setCustomizationSettings] = useState<
    Record<string, string | number>
  >(getDefaultCustomizationSettings('cyberpunk'));
  const [eventDateTime, setEventDateTime] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingParty, setIsCheckingParty] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [partyVerified, setPartyVerified] = useState(false);

  const { createdParty, setCreatedParty } = usePartyStore((state) => ({
    createdParty: state.createdParty,
    setCreatedParty: state.setCreatedParty,
  }));

  const { openModal, addNotification } = useUIStore((state) => ({
    openModal: state.openModal,
    addNotification: state.addNotification,
  }));
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;

  // Обработка OAuth callback для автоматического входа
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api || isAuthenticated()) {
      return;
    }

    let isMounted = true;

    const registerCallback = async () => {
      try {
        const result = (await window.api.invoke('auth:registerCallback')) as
          | { success: true; data: { code: string; provider: string } }
          | { success: false; error: string };

        if (isMounted && result.success && result.data) {
          const { code, provider } = result.data;
          try {
            const deviceId = `desktop-${Date.now()}`;
            const token = await authService.exchangeCode(code, provider, deviceId);
            authStore.setToken(token);

            // Загружаем информацию об организаторе
            const organizerInfo = await authService.getCurrentOrganizer();
            authStore.setOrganizer({ id: organizerInfo.id, name: organizerInfo.name });

            addNotification({
              type: 'success',
              message: 'Успешный вход в систему',
              duration: 3000,
            });
          } catch (error) {
            addNotification({
              type: 'error',
              message: error instanceof Error ? error.message : 'Ошибка при входе',
              duration: 5000,
            });
          }
        }
      } catch (error) {
        // Игнорируем ошибки таймаута и другие
        if (isMounted && error instanceof Error && !error.message.includes('timeout')) {
          console.error('Error handling OAuth callback:', error);
        }
      }
    };

    registerCallback();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, authStore, addNotification]);

  const handleThemeChange = (newThemeId: ThemeId) => {
    setThemeId(newThemeId);
    setCustomizationSettings(getDefaultCustomizationSettings(newThemeId));
  };

  const componentItems = useMemo(() => {
    const converted = convertToComponentPlayerItems(items);
    const removePath = (items: typeof converted): typeof converted => {
      return items.map((item) => {
        if (item.type === 'track') {
          const { path: _path, ...trackWithoutPath } = item;
          return trackWithoutPath;
        } else if (item.type === 'group' && item.items) {
          return {
            ...item,
            items: removePath(item.items),
          };
        }
        return item;
      });
    };
    return removePath(converted);
  }, [items]);

  const playlistData = useMemo(
    () => ({
      items: componentItems,
      totalDuration: calculatePartyTotalDuration(items),
      totalTracks: countTotalTracks(items),
    }),
    [componentItems, items],
  );

  const playbackState: PlaybackState | null = useMemo(() => {
    if (mode !== 'session') {
      return null;
    }

    return {
      currentTrackId,
      status: audioStatus,
      position: audioPosition,
      duration: audioDuration,
      volume: audioVolume,
      mode: 'session',
      playedTrackIds,
      disabledTrackIds,
      disabledGroupIds,
      lastUpdatedAt: new Date().toISOString(),
    };
  }, [
    mode,
    currentTrackId,
    audioStatus,
    audioPosition,
    audioDuration,
    audioVolume,
    playedTrackIds,
    disabledTrackIds,
    disabledGroupIds,
  ]);

  const checkPartyExists = React.useCallback(
    async (partyId: string): Promise<boolean> => {
      try {
        setIsCheckingParty(true);
        setServerError(null);
        const exists = await partyService.checkPartyExists(partyId);
        setPartyVerified(exists);
        if (!exists) {
          setServerError('Сервер не найден');
          setCreatedParty(null);
        }
        return exists;
      } catch (error) {
        console.error('Failed to check party existence:', error);
        setServerError('Сервер не найден');
        setPartyVerified(false);
        setCreatedParty(null);
        return false;
      } finally {
        setIsCheckingParty(false);
      }
    },
    [setCreatedParty],
  );

  const handleRetry = async () => {
    if (createdParty) {
      await checkPartyExists(createdParty.id);
    } else {
      setServerError(null);
      setPartyVerified(false);
    }
  };

  useEffect(() => {
    if (createdParty) {
      checkPartyExists(createdParty.id);
    } else {
      setPartyVerified(false);
      setServerError(null);
    }
  }, [createdParty, checkPartyExists]);

  const handleCreateParty = async () => {
    // Проверяем авторизацию перед созданием вечеринки
    if (!isAuthenticated()) {
      addNotification({
        type: 'warning',
        message: 'Для создания вечеринки необходимо войти в аккаунт',
        duration: 5000,
      });
      openModal('account');
      return;
    }
    if (!partyName.trim()) {
      addNotification({
        type: 'warning',
        message: 'Введите название вечеринки',
      });
      return;
    }

    setIsCreating(true);
    setServerError(null);
    setPartyVerified(false);
    try {
      const playlistForApi = convertPlaylistForApi(items);

      const createData: CreatePartyDto = {
        name: partyName,
        themeId,
        customizationSettings,
        playlistData: playlistForApi,
        eventDateTime: eventDateTime || undefined,
      };

      const party = await partyService.createParty(createData);

      const exists = await checkPartyExists(party.id);

      if (!exists) {
        addNotification({
          type: 'error',
          message: 'Вечеринка создана, но сервер недоступен',
        });
        return;
      }

      const url = await partyService.getPartyUrl(party.shortCode);
      const partyData = { id: party.id, shortCode: party.shortCode, url };
      setCreatedParty(partyData);

      addNotification({
        type: 'success',
        message: 'Вечеринка успешно создана',
      });
    } catch (error) {
      console.error('Failed to create party:', error);
      setServerError('Сервер не найден');
      setPartyVerified(false);
      addNotification({
        type: 'error',
        message: 'Ошибка при создании вечеринки',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyUrl = async () => {
    if (createdParty) {
      try {
        await navigator.clipboard.writeText(createdParty.url);
        addNotification({
          type: 'success',
          message: 'URL скопирован в буфер обмена',
        });
      } catch (error) {
        console.error('Failed to copy URL:', error);
        addNotification({
          type: 'error',
          message: 'Не удалось скопировать URL',
        });
      }
    }
  };

  // Если пользователь не авторизован, показываем форму входа
  if (!isAuthenticated()) {
    return (
      <div className="party-view">
        <AuthForm
          title="Требуется авторизация"
          description="Для работы с вечеринками необходимо войти в аккаунт"
          compact={false}
          authService={authService}
          onLoginSuccess={() => {
            // Компонент автоматически обновит состояние через authService
          }}
        />
      </div>
    );
  }

  return (
    <div className="party-view">
      <div className="party-view-header">
        <h2>Создание вечеринки</h2>
      </div>

      <div className="party-view-content">
        <div className="party-view-editor">
          <PartyEditor
            partyName={partyName}
            themeId={themeId}
            customizationSettings={customizationSettings}
            eventDateTime={eventDateTime}
            onPartyNameChange={setPartyName}
            onThemeIdChange={handleThemeChange}
            onCustomizationSettingsChange={setCustomizationSettings}
            onEventDateTimeChange={setEventDateTime}
            onCreateParty={handleCreateParty}
            isCreating={isCreating}
            createdParty={partyVerified && createdParty ? createdParty : null}
            serverError={serverError}
            isCheckingParty={isCheckingParty}
            onCopyUrl={handleCopyUrl}
            onRetry={handleRetry}
          />
        </div>

        <div className="party-view-preview">
          <h3>Превью (как будет выглядеть в браузере)</h3>
          <PartyPreview
            playlist={playlistData}
            themeId={themeId}
            customizationSettings={customizationSettings as CustomizationSettings<ThemeId>}
            playbackState={playbackState}
          />
        </div>
      </div>
    </div>
  );
};

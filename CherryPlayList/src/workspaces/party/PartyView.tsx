import React, { useState, useMemo, useEffect } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { PlaybackState } from '@cherryplay/components';
import { useProjectStore, usePlayerAudioStore, usePartyStore, useUIStore, useSettingsStore } from '@shared/stores';
import {
  convertToComponentPlayerItems,
  calculatePartyTotalDuration,
  countTotalTracks,
  convertPlaylistForApi,
} from '@shared/utils';
import { partyService, CreatePartyDto } from '@shared/services/partyService';

import { PartyEditor } from './components/PartyEditor';
import { PartyPreview } from './PartyPreview';
import './PartyView.css';

interface PartyViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PartyView: React.FC<PartyViewProps> = ({ workspaceId: _workspaceId, zoneId: _zoneId }) => {
  const { enableStreaming } = useSettingsStore();
  const items = useProjectStore((state) => state.items);

  // Получаем состояние сессии из projectStore
  const sessionState = useProjectStore((state) => state.sessionState);
  const {
    mode,
    currentTrackId,
    playedTrackIds,
    disabledTrackIds,
    disabledGroupIds,
  } = useMemo(() => ({
    mode: sessionState.mode,
    currentTrackId: sessionState.currentTrackId,
    playedTrackIds: Array.from(sessionState.playedTrackIds),
    disabledTrackIds: Array.from(sessionState.disabledTrackIds),
    disabledGroupIds: Array.from(sessionState.disabledGroupIds),
  }), [sessionState]);

  // Получаем состояние аудио плеера
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
  const [styleId, setStyleId] = useState('cyberpunk');
  const [customizationSettings, setCustomizationSettings] = useState<Record<string, any>>({
    accentColor: '#00ff00',
    glowIntensity: 50,
  });
  const [eventDateTime, setEventDateTime] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingParty, setIsCheckingParty] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [partyVerified, setPartyVerified] = useState(false);
  
  // Используем store для сохранения состояния вечеринки
  const { createdParty, setCreatedParty } = usePartyStore((state) => ({
    createdParty: state.createdParty,
    setCreatedParty: state.setCreatedParty,
  }));

  // Обновляем настройки по умолчанию при смене стиля
  const handleStyleChange = (newStyleId: string) => {
    setStyleId(newStyleId);
    // Устанавливаем значения по умолчанию для нового стиля
    if (newStyleId === 'cyberpunk') {
      setCustomizationSettings({
        accentColor: '#00ff00',
        glowIntensity: 50,
      });
    } else if (newStyleId === 'sakura') {
      setCustomizationSettings({
        pinkTint: '#ffb3d9',
        backgroundOpacity: 80,
      });
    } else if (newStyleId === 'art-deco') {
      setCustomizationSettings({
        goldColor: '#d4af37',
        patternStyle: 'geometric',
      });
    }
  };

  // Преобразуем items в формат для библиотеки компонентов (без path для превью)
  const componentItems = useMemo(() => {
    const converted = convertToComponentPlayerItems(items);
    // Убираем path из всех элементов для превью (как будет в вебе)
    const removePath = (items: typeof converted): typeof converted => {
      return items.map(item => {
        if (item.type === 'track') {
          const { path, ...trackWithoutPath } = item;
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

  // Вычисляем статистику плейлиста
  const playlistData = useMemo(
    () => ({
      items: componentItems,
      totalDuration: calculatePartyTotalDuration(items),
      totalTracks: countTotalTracks(items),
    }),
    [componentItems, items],
  );

  // Формируем PlaybackState для превью (только в режиме сессии)
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

  const { addNotification } = useUIStore((state) => ({
    addNotification: state.addNotification,
  }));

  // Проверка существования вечеринки на сервере
  const checkPartyExists = async (partyId: string): Promise<boolean> => {
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
  };

  // Обработчик переподключения
  const handleRetry = async () => {
    if (createdParty) {
      // Если есть созданная вечеринка, проверяем её существование
      await checkPartyExists(createdParty.id);
    } else {
      // Если вечеринки нет, просто очищаем ошибку и показываем форму создания
      setServerError(null);
      setPartyVerified(false);
    }
  };

  // Проверка вечеринки при инициализации
  useEffect(() => {
    if (createdParty) {
      checkPartyExists(createdParty.id);
    } else {
      setPartyVerified(false);
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Только при монтировании компонента

  const handleCreateParty = async () => {
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
      // Преобразуем плейлист для API (убираем path, вычисляем метаданные)
      const playlistForApi = convertPlaylistForApi(items);

      const createData: CreatePartyDto = {
        name: partyName,
        styleId,
        customizationSettings,
        playlistData: playlistForApi,
        eventDateTime: eventDateTime || undefined,
      };

      const party = await partyService.createParty(createData);
      
      // Проверяем, что вечеринка действительно создана на сервере
      const exists = await checkPartyExists(party.id);
      
      if (!exists) {
        addNotification({
          type: 'error',
          message: 'Вечеринка создана, но сервер недоступен',
        });
        return;
      }

      const url = partyService.getPartyUrl(party.shortCode);
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

  if (!enableStreaming) {
    return (
      <div className="party-view">
        <div className="party-view-header">
          <h2>Создание вечеринки</h2>
        </div>
        <div className="party-view-content">
          <p>Стриминг отключен в настройках</p>
        </div>
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
            styleId={styleId}
            customizationSettings={customizationSettings}
            eventDateTime={eventDateTime}
            onPartyNameChange={setPartyName}
            onStyleIdChange={handleStyleChange}
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
            styleId={styleId}
            customizationSettings={customizationSettings}
            playbackState={playbackState}
          />
        </div>
      </div>
    </div>
  );
};

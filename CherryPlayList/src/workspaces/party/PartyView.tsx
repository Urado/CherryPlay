import {
  PlaybackState,
  type ThemeId,
  type CustomizationSettings,
  getDefaultCustomizationSettings,
} from '@cherryplay/components';
import React, { useState, useMemo, useEffect } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { partyService, CreatePartyDto } from '@shared/services/partyService';
import { useProjectStore, usePlayerAudioStore, usePartyStore, useUIStore } from '@shared/stores';
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

  const { addNotification } = useUIStore((state) => ({
    addNotification: state.addNotification,
  }));

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

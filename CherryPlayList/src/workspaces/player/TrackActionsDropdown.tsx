import { isProjectGroup } from '@core/types/project';
import { usePlayerAudioStore, useProjectStore, useUIStore } from '@shared/stores';
import { buildAnchorPanelStyle } from '@shared/utils/anchorPanelLayout';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { addPlayedGroupNext, addPlayedTrackNext } from './addPlayedTrackNext';

export const TRACK_ACTIONS_DROPDOWN_WIDTH = 240;

export interface TrackActionsDropdownProps {
  trackId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onJumpToTrack?: (trackId: string) => Promise<void>;
}

export const TrackActionsDropdown: React.FC<TrackActionsDropdownProps> = ({
  trackId,
  anchorRect,
  onClose,
  onJumpToTrack,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const mode = useProjectStore((state) => state.sessionState.mode);
  const playedTrackIds = useProjectStore((state) => state.sessionState.playedTrackIds);
  const findItemById = useProjectStore((state) => state.findItemById);
  const getAllTracksInOrder = useProjectStore((state) => state.getAllTracksInOrder);
  const audioTrackId = usePlayerAudioStore((state) => state.currentTrack?.id ?? null);
  const sessionTrackId = useProjectStore((state) => state.sessionState.currentTrackId);
  const audioTrack = useProjectStore((state) =>
    audioTrackId ? state.findItemById(audioTrackId) : null,
  );
  const sessionTrack = useProjectStore((state) =>
    sessionTrackId ? state.findItemById(sessionTrackId) : null,
  );
  const addNotification = useUIStore((state) => state.addNotification);
  const activeTrackId =
    audioTrack && 'path' in audioTrack
      ? audioTrackId
      : sessionTrack && 'path' in sessionTrack
        ? sessionTrackId
        : null;

  const item = findItemById(trackId);
  const groupTracks = item && isProjectGroup(item) ? getAllTracksInOrder([item]) : null;
  const actionTrackId = groupTracks ? (groupTracks[0]?.id ?? null) : trackId;
  const canAddNext =
    mode === 'session' &&
    actionTrackId !== null &&
    (groupTracks
      ? groupTracks.length > 0 && groupTracks.every((t) => playedTrackIds.includes(t.id))
      : playedTrackIds.includes(trackId));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const t = setTimeout(() => window.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(t);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const style = buildAnchorPanelStyle({
    anchorRect,
    panelWidth: TRACK_ACTIONS_DROPDOWN_WIDTH,
  });

  const content = (
    <div
      ref={panelRef}
      className="track-actions-dropdown"
      style={style}
    >
      <div className="track-actions-dropdown__body">
        <ul className="track-actions-dropdown__list">
          {canAddNext && actionTrackId && (
            <li className="track-actions-dropdown__item">
              <button
                type="button"
                className="track-actions-dropdown__btn"
                onClick={() => {
                  const added = groupTracks
                    ? addPlayedGroupNext(trackId, activeTrackId)
                    : addPlayedTrackNext(actionTrackId, activeTrackId);
                  if (added) {
                    addNotification({ type: 'success', message: 'Добавлен следующим' });
                  }
                  onClose();
                }}
              >
                Добавить следующим
              </button>
            </li>
          )}
          {onJumpToTrack && actionTrackId ? (
            <li className="track-actions-dropdown__item">
              <button
                type="button"
                className="track-actions-dropdown__btn"
                onClick={() => {
                  void onJumpToTrack(actionTrackId);
                  onClose();
                }}
              >
                Играть с этого места
              </button>
            </li>
          ) : (
            <li className="track-actions-dropdown__item track-actions-dropdown__item--empty">
              Нет доступных действий
            </li>
          )}
        </ul>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

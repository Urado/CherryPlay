import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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

  const gap = 4;
  const estimatedWidth = 200;
  let left = anchorRect.right + gap;
  if (left + estimatedWidth > window.innerWidth) {
    left = anchorRect.left - estimatedWidth - gap;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    top: anchorRect.top + anchorRect.height / 2,
    transform: 'translateY(-50%)',
    zIndex: 1001,
    minWidth: 180,
    maxWidth: 240,
  };

  const content = (
    <div
      ref={panelRef}
      className="track-actions-dropdown"
      style={style}
      role="menu"
      aria-label="Действия с треком"
    >
      <div className="track-actions-dropdown__body">
        <ul className="track-actions-dropdown__list">
          {onJumpToTrack ? (
            <li className="track-actions-dropdown__item">
              <button
                type="button"
                className="track-actions-dropdown__btn"
                role="menuitem"
                onClick={() => {
                  void onJumpToTrack(trackId);
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

import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useIsTruncated } from '../../core/hooks/useIsTruncated';
import { stripLastExtension } from '../../core/utils/string';
import { formatDuration } from '../../core/utils/time';
import { PlayerItem } from '../../types';

export interface SpringCrossStepPlaylistItemProps {
  item: PlayerItem;
  index: number;
  level: number;
  /** 1-based display number excluding cancelled tracks; used for track-type items when not current/played/disabled. */
  trackNumber?: number;
  isCurrent?: boolean;
  isPlayed?: boolean;
  isDisabled?: boolean;
  /** Called when user clicks or activates the cancel icon on a disabled track; parent controls single 10s popup. */
  onCancelIconClick?: (trackId: string) => void;
  /** When true, show the 10s "Трек отменён" popup (parent sets this for the active item only). */
  showCancelPopupFromParent?: boolean;
}

/** Иконка Music как в lucide-react (пример): две ноты, обводка */
function MusicIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Иконка отмены (крестик) для отключённого трека */
function CancelIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * PlaylistItem for spring-cross-step theme.
 * Layout from reference: circle (number / Music / Check), name (+ optional path), duration.
 */
export const PlaylistItem: React.FC<SpringCrossStepPlaylistItemProps> = ({
  item,
  index,
  level: _level,
  trackNumber,
  isCurrent = false,
  isPlayed = false,
  isDisabled = false,
  onCancelIconClick,
  showCancelPopupFromParent = false,
}) => {
  const [nameExpanded, setNameExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const iconWrapperRef = useRef<HTMLDivElement | HTMLButtonElement>(null);
  const idPrefix = useId();
  const tooltipId = `${idPrefix}-cancel-tooltip`;
  const nameRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; bottom: number } | null>(
    null,
  );
  const displayName =
    item.type === 'track'
      ? stripLastExtension(item.name) || item.name || 'Трек'
      : item.name || 'Группа';
  const displayDuration =
    item.type === 'track' && item.duration != null ? formatDuration(item.duration) : null;

  const nameTruncated = useIsTruncated(nameRef, !nameExpanded, displayName);

  const displayNumber =
    item.type === 'track' && !isDisabled && !isCurrent && !isPlayed
      ? (trackNumber ?? index + 1)
      : null;
  const circleContent = isDisabled ? (
    <CancelIcon />
  ) : isCurrent ? (
    <MusicIcon />
  ) : isPlayed ? (
    <CheckIcon />
  ) : item.type === 'track' && displayNumber != null ? (
    displayNumber
  ) : null;

  const circleState = isDisabled
    ? 'disabled'
    : isCurrent
      ? 'current'
      : isPlayed
        ? 'played'
        : 'upcoming';

  const cancelTooltipVisible = isDisabled && (isHovered || showCancelPopupFromParent);

  const updateTooltipPosition = (): void => {
    if (typeof window === 'undefined' || !iconWrapperRef.current) return;
    const rect = iconWrapperRef.current.getBoundingClientRect();
    setTooltipPosition({
      left: rect.left + rect.width / 2,
      bottom: window.innerHeight - rect.top + 4,
    });
  };

  useLayoutEffect(() => {
    if (!cancelTooltipVisible) return;
    updateTooltipPosition();
    const onScrollOrResize = (): void => updateTooltipPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [cancelTooltipVisible]);

  const handlePointerEnter = (): void => {
    if (isDisabled) setIsHovered(true);
  };
  const handlePointerLeave = (): void => {
    if (isDisabled) setIsHovered(false);
  };
  const handleCancelIconActivate = (): void => {
    if (!isDisabled) return;
    onCancelIconClick?.(item.id);
  };

  const handleIconClickWhenDisabled = (e: React.MouseEvent): void => {
    if (!isDisabled) return;
    e.stopPropagation();
    e.preventDefault();
    handleCancelIconActivate();
  };

  const handleCancelIconKeyDown = (e: React.KeyboardEvent): void => {
    if (!isDisabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCancelIconActivate();
    }
  };

  const handleRowClickWhenDisabled = (e: React.MouseEvent): void => {
    if (!isDisabled) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const rootClass = [
    'party-playlist-item',
    item.type === 'group' ? 'party-playlist-item--group' : 'party-playlist-item--track',
    isCurrent && 'party-playlist-item--current',
    isPlayed && 'party-playlist-item--played',
    isDisabled && 'party-playlist-item--disabled',
  ]
    .filter(Boolean)
    .join(' ');

  const iconWrapperClassName = 'party-playlist-item-circle-wrapper';

  return (
    <div
      className={rootClass}
      role="listitem"
      aria-describedby={cancelTooltipVisible ? tooltipId : undefined}
      onClick={handleRowClickWhenDisabled}
    >
      <div className="party-playlist-item-left">
        {isDisabled ? (
          <button
            ref={iconWrapperRef as React.RefObject<HTMLButtonElement>}
            type="button"
            className={iconWrapperClassName}
            aria-label="Трек отменён"
            onMouseEnter={handlePointerEnter}
            onMouseLeave={handlePointerLeave}
            onClick={handleIconClickWhenDisabled}
            onKeyDown={handleCancelIconKeyDown}
          >
            {cancelTooltipVisible &&
              tooltipPosition &&
              typeof document !== 'undefined' &&
              createPortal(
                <div data-theme="spring-cross-step">
                  <div
                    id={tooltipId}
                    className="party-playlist-item-cancel-tooltip party-playlist-item-cancel-tooltip--portal"
                    role="tooltip"
                    aria-live="polite"
                    style={{
                      position: 'fixed',
                      left: tooltipPosition.left,
                      bottom: tooltipPosition.bottom,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    Трек отменён
                  </div>
                </div>,
                document.body,
              )}
            <div className="party-playlist-item-circle" data-state={circleState}>
              {circleContent}
            </div>
          </button>
        ) : (
          <div
            ref={iconWrapperRef as React.RefObject<HTMLDivElement>}
            className={iconWrapperClassName}
            onMouseEnter={handlePointerEnter}
            onMouseLeave={handlePointerLeave}
          >
            <div className="party-playlist-item-circle" data-state={circleState}>
              {circleContent}
            </div>
          </div>
        )}
        <div className="party-playlist-item-info">
          <div className="party-playlist-item-name-wrapper">
            <div
              ref={nameRef}
              className={`party-playlist-item-name${nameExpanded ? ' party-playlist-item-name--expanded' : ''}${!nameExpanded && nameTruncated ? ' party-playlist-item-name--inline-ellipsis' : ''}`}
              id={`${idPrefix}-name`}
            >
              {displayName}
            </div>
            {(nameExpanded || nameTruncated) && (
              <button
                type="button"
                className="party-playlist-item-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameExpanded((v) => !v);
                }}
                aria-expanded={nameExpanded}
                aria-controls={`${idPrefix}-name`}
                aria-label={nameExpanded ? 'Свернуть название' : 'Показать полное название'}
                title={nameExpanded ? 'Свернуть название' : 'Показать полное название'}
              >
                {nameExpanded ? '×' : '…'}
              </button>
            )}
          </div>
          {item.type === 'track' && item.path && (
            <div className="party-playlist-item-artist">{item.path}</div>
          )}
        </div>
      </div>
      {displayDuration != null && (
        <div className="party-playlist-item-duration">{displayDuration}</div>
      )}
    </div>
  );
};

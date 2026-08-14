import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { buildAnchorPanelStyle } from '@shared/utils/anchorPanelLayout';

import { PARTY_GO_TO_PLAY_GUIDE_PANEL_WIDTH } from './partyHeaderGoToPlayGuide';

export interface PartyGoToPlayGuidePanelProps {
  anchorRect: DOMRect;
  showGoButton: boolean;
  startLabel: string;
  mode?: 'start' | 'stop';
  excludeCloseRef?: React.RefObject<HTMLElement | null>;
  onGo: () => void;
  onClose: () => void;
  onInteractionPause?: () => void;
  onInteractionResume?: () => void;
}

const GUIDE_TEXT_ID = 'party-go-to-play-guide-text';

export const PartyGoToPlayGuidePanel: React.FC<PartyGoToPlayGuidePanelProps> = ({
  anchorRect,
  showGoButton,
  startLabel,
  mode = 'start',
  excludeCloseRef,
  onGo,
  onClose,
  onInteractionPause,
  onInteractionResume,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const goButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const excludeCloseRefStable = useRef(excludeCloseRef);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    excludeCloseRefStable.current = excludeCloseRef;
  }, [excludeCloseRef, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      const el = panelRef.current;
      if (el?.contains(target)) {
        return;
      }
      if (excludeCloseRefStable.current?.current?.contains(target)) {
        return;
      }
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    const timer = window.setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const focusTarget = showGoButton ? goButtonRef.current : panelRef.current;
    focusTarget?.focus();
  }, [showGoButton]);

  const style = buildAnchorPanelStyle({
    anchorRect,
    panelWidth: PARTY_GO_TO_PLAY_GUIDE_PANEL_WIDTH,
  });

  const bodyText =
    mode === 'stop'
      ? showGoButton
        ? `Чтобы остановить, нажмите «${startLabel}» на экране проигрывания.`
        : `Нажмите «${startLabel}».`
      : showGoButton
        ? `Вечеринка готова. Запуск — кнопкой «${startLabel}» на экране проигрывания.`
        : `Вечеринка готова. Нажмите «${startLabel}».`;

  return createPortal(
    <div
      ref={panelRef}
      className="party-go-to-play-guide-panel"
      style={style}
      role="dialog"
      aria-label={mode === 'stop' ? 'Остановить' : 'Играть'}
      aria-describedby={GUIDE_TEXT_ID}
      tabIndex={-1}
      onMouseEnter={onInteractionPause}
      onMouseLeave={onInteractionResume}
      onFocus={onInteractionPause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onInteractionResume?.();
        }
      }}
    >
      <p id={GUIDE_TEXT_ID} className="party-go-to-play-guide-panel__text">
        {bodyText}
      </p>
      {showGoButton ? (
        <button
          ref={goButtonRef}
          type="button"
          className="header-button party-go-to-play-guide-panel__go"
          onClick={onGo}
        >
          Перейти
        </button>
      ) : null}
    </div>,
    document.body,
  );
};

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { LayoutEditAirSide } from '@shared/utils/layoutWorkspaceOperations';

import type { WorkspacePickerOption } from './workspaceLayoutEditOptions';

const PICKER_GAP_PX = 6;

interface PickerPosition {
  top: number;
  left: number;
  transform: string;
}

export type WorkspacePickerAnchor =
  | { kind: 'below-center' }
  | { kind: 'air-side'; side: LayoutEditAirSide };

function getPickerPosition(anchor: DOMRect, placement: WorkspacePickerAnchor): PickerPosition {
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;

  if (placement.kind === 'below-center') {
    return {
      top: anchor.bottom + PICKER_GAP_PX,
      left: centerX,
      transform: 'translateX(-50%)',
    };
  }

  switch (placement.side) {
    case 'top':
      return {
        top: anchor.bottom + PICKER_GAP_PX,
        left: centerX,
        transform: 'translateX(-50%)',
      };
    case 'bottom':
      return {
        top: anchor.top - PICKER_GAP_PX,
        left: centerX,
        transform: 'translate(-50%, -100%)',
      };
    case 'left':
      return {
        top: centerY,
        left: anchor.right + PICKER_GAP_PX,
        transform: 'translateY(-50%)',
      };
    case 'right':
      return {
        top: centerY,
        left: anchor.left - PICKER_GAP_PX,
        transform: 'translate(-100%, -50%)',
      };
  }
}

interface UseWorkspacePickerMenuOptions {
  anchorRef: React.RefObject<HTMLElement | null>;
  controlRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  placement: WorkspacePickerAnchor;
}

export function useWorkspacePickerMenu({
  anchorRef,
  controlRef,
  isOpen,
  onClose,
  placement,
}: UseWorkspacePickerMenuOptions) {
  const listId = useId();
  const [pickerPosition, setPickerPosition] = useState<PickerPosition | null>(null);

  const syncPickerPosition = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) {
      return;
    }

    setPickerPosition(getPickerPosition(anchor, placement));
  }, [anchorRef, placement]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleLayoutChange = () => syncPickerPosition();
    const frameId = requestAnimationFrame(handleLayoutChange);
    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [isOpen, syncPickerPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (controlRef.current?.contains(target)) {
        return;
      }

      const pickerNode = document.getElementById(listId);
      if (pickerNode?.contains(target)) {
        return;
      }

      onClose();
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, listId, onClose, controlRef]);

  return { listId, pickerPosition: isOpen ? pickerPosition : null, syncPickerPosition };
}

interface WorkspacePickerMenuProps {
  listId: string;
  pickerPosition: PickerPosition | null;
  isOpen: boolean;
  options: WorkspacePickerOption[];
  onSelect: (workspaceType: string) => void;
  onClose: () => void;
}

export const WorkspacePickerMenu: React.FC<WorkspacePickerMenuProps> = ({
  listId,
  pickerPosition,
  isOpen,
  options,
  onSelect,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (options.length === 0) {
      menuRef.current?.focus();
      return;
    }

    itemRefs.current[0]?.focus();
  }, [isOpen, options.length]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null);
    if (items.length === 0) {
      return;
    }

    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex =
        currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  if (!isOpen || !pickerPosition) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      id={listId}
      className="workspace-layout-edit-picker workspace-layout-edit-picker--portal"
      role="menu"
      aria-label="Доступные окна"
      tabIndex={-1}
      onKeyDown={handleMenuKeyDown}
      style={{
        position: 'fixed',
        top: pickerPosition.top,
        left: pickerPosition.left,
        transform: pickerPosition.transform,
      }}
    >
      {options.length === 0 ? (
        <div className="workspace-layout-edit-picker__empty" role="presentation">
          Нет доступных окон
        </div>
      ) : (
        options.map((option, index) => (
          <button
            key={option.type}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            type="button"
            className="workspace-layout-edit-picker__item"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(option.type);
              onClose();
            }}
          >
            {option.name}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
};

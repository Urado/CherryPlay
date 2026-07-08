import DragHandleIcon from '@mui/icons-material/DragHandle';
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';

import { MAX_LAYOUT_DEPTH } from '@core/constants/layoutConstraints';
import { ContainerZone } from '@core/types/layout';
import { useLayoutStore } from '@shared/stores';
import { getMinSizePercentsForContainer } from '@shared/utils';

import { WorkspaceRenderer } from '../WorkspaceRenderer';

import { WorkspaceLayoutEditContainerShell } from './WorkspaceLayoutEditContainerShell';
import { WorkspaceLayoutEditShell } from './WorkspaceLayoutEditShell';

interface SplitContainerProps {
  zone: ContainerZone;
  depth?: number;
}

const DIVIDER_MIN_HINT = 'Достигнут минимальный размер';
const DIVIDER_MIN_HINT_MS = 1500;

/**
 * Рекурсивный компонент для отображения контейнеров с возможностью изменения размеров
 */
const SplitContainerComponent: React.FC<SplitContainerProps> = ({ zone, depth = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const [dividerAtMinIndex, setDividerAtMinIndex] = useState<number | null>(null);
  const [dividerMinHint, setDividerMinHint] = useState<string | null>(null);
  const dividerHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { updateContainerSizes } = useLayoutStore();
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);

  const isMaxDepth = depth >= MAX_LAYOUT_DEPTH;

  const showDividerMinHint = useCallback((index: number) => {
    setDividerAtMinIndex(index);
    setDividerMinHint(DIVIDER_MIN_HINT);

    if (dividerHintTimerRef.current !== null) {
      clearTimeout(dividerHintTimerRef.current);
    }

    dividerHintTimerRef.current = setTimeout(() => {
      setDividerMinHint(null);
      setDividerAtMinIndex(null);
      dividerHintTimerRef.current = null;
    }, DIVIDER_MIN_HINT_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (dividerHintTimerRef.current !== null) {
        clearTimeout(dividerHintTimerRef.current);
      }
    };
  }, []);

  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingIndex(index);
    },
    [],
  );

  useEffect(() => {
    if (resizingIndex === null || !containerRef.current) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const isHorizontal = zone.direction === 'horizontal';

      let newPercent: number;
      if (isHorizontal) {
        const mouseX = e.clientX - rect.left;
        newPercent = rect.width > 0 ? (mouseX / rect.width) * 100 : 50;
      } else {
        const mouseY = e.clientY - rect.top;
        newPercent = rect.height > 0 ? (mouseY / rect.height) * 100 : 50;
      }

      newPercent = Math.max(0, Math.min(100, newPercent));

      const minPercents = getMinSizePercentsForContainer(zone, rect.width, rect.height);
      const minPercentLeft = minPercents[resizingIndex] ?? 0;
      const minPercentRight = minPercents[resizingIndex + 1] ?? 0;

      const currentLeftSize = zone.sizes
        .slice(0, resizingIndex + 1)
        .reduce((sum, size) => sum + size, 0);

      const delta = newPercent - currentLeftSize;

      const newSizes = [...zone.sizes];
      const leftZoneSize = newSizes[resizingIndex];
      const rightZoneSize = newSizes[resizingIndex + 1];

      const newLeftZoneSize = leftZoneSize + delta;
      const newRightZoneSize = rightZoneSize - delta;

      if (newLeftZoneSize < minPercentLeft || newRightZoneSize < minPercentRight) {
        showDividerMinHint(resizingIndex);
        return;
      }

      setDividerAtMinIndex(null);

      newSizes[resizingIndex] = newLeftZoneSize;
      newSizes[resizingIndex + 1] = newRightZoneSize;

      const total = newSizes.reduce((sum, size) => sum + size, 0);
      if (Math.abs(total - 100) > 0.01) {
        const scale = 100 / total;
        for (let i = 0; i < newSizes.length; i++) {
          newSizes[i] = newSizes[i] * scale;
        }
      }

      updateContainerSizes(zone.id, newSizes);
    };

    const handleMouseUp = () => {
      setResizingIndex(null);
      setDividerAtMinIndex(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingIndex, showDividerMinHint, updateContainerSizes, zone]);

  const isHorizontal = useMemo(() => zone.direction === 'horizontal', [zone.direction]);
  const showContainerEditShell = isLayoutEditMode && zone.zones.length >= 2;

  if (isMaxDepth) {
    return (
      <div className="split-container-error">
        <p>Достигнута максимальная вложенность ({MAX_LAYOUT_DEPTH} уровней)</p>
      </div>
    );
  }

  const splitContent = (
    <div ref={containerRef} className={`split-container split-${zone.direction}`}>
      {zone.zones.map((childZone, index) => (
        <React.Fragment key={childZone.id}>
          <div
            className={`split-zone${childZone.type === 'workspace' && isLayoutEditMode ? ' split-zone--layout-edit' : ''}`}
            style={{
              flex: `0 0 ${zone.sizes[index]}%`,
            }}
          >
            {childZone.type === 'container' ? (
              <SplitContainer zone={childZone} depth={depth + 1} />
            ) : isLayoutEditMode ? (
              <WorkspaceLayoutEditShell zone={childZone} />
            ) : (
              <WorkspaceRenderer zone={childZone} />
            )}
          </div>
          {index < zone.zones.length - 1 && (
            <button
              type="button"
              className={`split-divider split-divider--${zone.direction} ${resizingIndex === index ? 'resizing' : ''}${dividerAtMinIndex === index ? ' split-divider--disabled' : ''}${isLayoutEditMode ? ' split-divider--layout-edit' : ''}`}
              onMouseDown={handleMouseDown(index)}
              aria-label={isHorizontal ? 'Изменить ширину панелей' : 'Изменить высоту панелей'}
              aria-disabled={dividerAtMinIndex === index ? true : undefined}
              title={dividerAtMinIndex === index ? DIVIDER_MIN_HINT : undefined}
            >
              <DragHandleIcon className="split-divider__handle" aria-hidden />
            </button>
          )}
        </React.Fragment>
      ))}
      {dividerMinHint !== null && (
        <div className="split-divider-min-hint" role="status" aria-live="polite">
          {dividerMinHint}
        </div>
      )}
    </div>
  );

  if (showContainerEditShell) {
    return (
      <WorkspaceLayoutEditContainerShell zone={zone}>
        {splitContent}
      </WorkspaceLayoutEditContainerShell>
    );
  }

  return splitContent;
};

SplitContainerComponent.displayName = 'SplitContainer';

export const SplitContainer = React.memo(SplitContainerComponent);

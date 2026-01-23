import DragHandleIcon from '@mui/icons-material/DragHandle';
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';

import { ContainerZone } from '@core/types/layout';
import { useLayoutStore } from '@shared/stores';
import { calculateMinSizePercent } from '@shared/utils';

import { WorkspaceRenderer } from '../WorkspaceRenderer';

interface SplitContainerProps {
  zone: ContainerZone;
  depth?: number; // для ограничения вложенности (макс 6)
}

/**
 * Рекурсивный компонент для отображения контейнеров с возможностью изменения размеров
 */
const SplitContainerComponent: React.FC<SplitContainerProps> = ({ zone, depth = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);

  const { updateContainerSizes } = useLayoutStore();

  // Ограничение вложенности до 6 уровней
  const isMaxDepth = depth >= 6;

  // Обработка начала перетаскивания
  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingIndex(index);
    },
    [],
  );

  // Обработка перемещения мыши при resize
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

      // Вычислить новую позицию в процентах
      let newPercent: number;
      if (isHorizontal) {
        const mouseX = e.clientX - rect.left;
        newPercent = rect.width > 0 ? (mouseX / rect.width) * 100 : 50;
      } else {
        const mouseY = e.clientY - rect.top;
        newPercent = rect.height > 0 ? (mouseY / rect.height) * 100 : 50;
      }

      // Ограничить процент в пределах 0-100
      newPercent = Math.max(0, Math.min(100, newPercent));

      // Вычислить минимальный процент для 10px
      const containerSizeValue = isHorizontal ? rect.width : rect.height;
      const minPercent = containerSizeValue > 0 ? calculateMinSizePercent(containerSizeValue) : 0;

      // Вычислить текущую позицию границы (сумма размеров зон слева)
      const currentLeftSize = zone.sizes
        .slice(0, resizingIndex + 1)
        .reduce((sum, size) => sum + size, 0);

      // Вычислить изменение размера
      const delta = newPercent - currentLeftSize;

      // Вычислить новые размеры для двух соседних зон
      const newSizes = [...zone.sizes];
      const leftZoneSize = newSizes[resizingIndex];
      const rightZoneSize = newSizes[resizingIndex + 1];

      const newLeftZoneSize = leftZoneSize + delta;
      const newRightZoneSize = rightZoneSize - delta;

      // Проверить минимальные размеры
      if (newLeftZoneSize < minPercent || newRightZoneSize < minPercent) {
        // Не позволяем нарушить минимум
        return;
      }

      // Обновить размеры только для двух соседних зон
      newSizes[resizingIndex] = newLeftZoneSize;
      newSizes[resizingIndex + 1] = newRightZoneSize;

      // Нормализовать размеры (сумма должна быть 100)
      const total = newSizes.reduce((sum, size) => sum + size, 0);
      if (Math.abs(total - 100) > 0.01) {
        const scale = 100 / total;
        for (let i = 0; i < newSizes.length; i++) {
          newSizes[i] = newSizes[i] * scale;
        }
      }

      // Обновить store
      updateContainerSizes(zone.id, newSizes);
    };

    const handleMouseUp = () => {
      setResizingIndex(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingIndex, zone, updateContainerSizes]);

  const isHorizontal = useMemo(() => zone.direction === 'horizontal', [zone.direction]);

  // Ограничение вложенности до 6 уровней
  if (isMaxDepth) {
    return (
      <div className="split-container-error">
        <p>Maximum nesting depth reached (6 levels)</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`split-container split-${zone.direction}`}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {zone.zones.map((childZone, index) => (
        <React.Fragment key={childZone.id}>
          <div
            className="split-zone"
            style={{
              flex: `0 0 ${zone.sizes[index]}%`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: isHorizontal ? '10px' : 'auto',
              minHeight: isHorizontal ? 'auto' : '10px',
            }}
          >
            {childZone.type === 'container' ? (
              <SplitContainer zone={childZone} depth={depth + 1} />
            ) : (
              <WorkspaceRenderer zone={childZone} />
            )}
          </div>
          {index < zone.zones.length - 1 && (
            <button
              type="button"
              className={`split-divider ${resizingIndex === index ? 'resizing' : ''}`}
              onMouseDown={handleMouseDown(index)}
              aria-label={isHorizontal ? 'Resize horizontal split' : 'Resize vertical split'}
              style={{
                width: isHorizontal ? '6px' : '100%',
                height: isHorizontal ? '100%' : '6px',
                cursor: isHorizontal ? 'col-resize' : 'row-resize',
                flexShrink: 0,
                userSelect: 'none',
                backgroundColor: '#000000',
                position: 'relative',
                border: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DragHandleIcon
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: isHorizontal ? '16px' : '16px',
                  transform: isHorizontal ? 'rotate(90deg)' : 'none',
                  opacity: 0.6,
                }}
              />
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

SplitContainerComponent.displayName = 'SplitContainer';

export const SplitContainer = React.memo(SplitContainerComponent);

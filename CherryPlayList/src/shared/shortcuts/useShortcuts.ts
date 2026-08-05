import { useEffect, useMemo, useRef } from 'react';

import { toggleSessionPlayPause } from '@shared/utils/togglePlayPause';

import { shortcutManager } from './ShortcutManager';
import type { ShortcutHandlers, ShortcutId, UseShortcutsOptions } from './shortcutTypes';

export function useShortcuts(handlers: ShortcutHandlers, options: UseShortcutsOptions = {}): void {
  const { enabled = true } = options;

  const registeredIds = useRef<Set<ShortcutId>>(new Set());

  useEffect(() => {
    if (!enabled) {
      for (const id of registeredIds.current) {
        shortcutManager.unregisterHandler(id);
      }
      registeredIds.current.clear();
      return;
    }

    const handlerEntries = Object.entries(handlers) as [ShortcutId, (() => void) | undefined][];

    const currentIds = new Set<ShortcutId>();

    for (const [id, handler] of handlerEntries) {
      if (handler) {
        shortcutManager.registerHandler(id, handler);
        currentIds.add(id);
      }
    }

    for (const id of registeredIds.current) {
      if (!currentIds.has(id)) {
        shortcutManager.unregisterHandler(id);
      }
    }

    registeredIds.current = currentIds;

    return () => {
      for (const id of registeredIds.current) {
        shortcutManager.unregisterHandler(id);
      }
      registeredIds.current.clear();
    };
  }, [handlers, enabled]);
}

export function useGlobalShortcuts(
  handlers: Pick<ShortcutHandlers, 'global.save' | 'global.saveAs' | 'global.open' | 'global.new'>,
  options: UseShortcutsOptions = {},
): void {
  useShortcuts(handlers, options);
}

export function useListShortcuts(
  handlers: Pick<
    ShortcutHandlers,
    'list.undo' | 'list.redo' | 'list.delete' | 'list.selectAll' | 'list.escape'
  >,
  options: UseShortcutsOptions = {},
): void {
  useShortcuts(handlers, options);
}

export function usePlayerShortcuts(options: UseShortcutsOptions = {}): void {
  const handlers = useMemo(
    () => ({
      'player.togglePlay': toggleSessionPlayPause,
    }),
    [],
  );

  useShortcuts(handlers, options);
}

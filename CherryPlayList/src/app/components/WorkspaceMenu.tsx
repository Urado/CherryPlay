import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useWorkspaceActivation } from '@app/hooks/useWorkspaceActivation';
import {
  requestCreateScratchWorkspace,
  requestToggleLayoutEditMode,
} from '@app/hooks/useWorkspaceDirtyGuard';
import { LAYOUT_PRESET_DISPLAY_NAMES_RU } from '@core/constants/layoutPresetDisplayNames';
import type { ActiveWorkspace, LayoutPreset } from '@core/types/workspacePreset';
import { isUnnamedWorkspaceName, UNNAMED_WORKSPACE_NAME } from '@core/types/workspacePreset';
import { usePlatformCapabilities } from '@shared/platform';
import { useLayoutStore, useSettingsStore, useUIStore } from '@shared/stores';

import { WorkspaceDeleteConfirmDialog } from './WorkspaceDeleteConfirmDialog';
import { WorkspaceNameModal } from './WorkspaceNameModal';

const LAYOUT_EDIT_DISABLED_TITLE = 'Недоступно в режиме редактирования окон';

const ALL_BUILTIN_PRESETS: LayoutPreset[] = [
  'simple',
  'complex',
  'collections',
  'collections-vertical',
  'player',
  'party',
];

function getActiveWorkspaceLabel(
  activeWorkspace: ActiveWorkspace,
  userWorkspaces: { id: string; name: string }[],
): string {
  if (activeWorkspace.kind === 'builtin') {
    return LAYOUT_PRESET_DISPLAY_NAMES_RU[activeWorkspace.preset];
  }
  if (activeWorkspace.kind === 'user') {
    const workspace = userWorkspaces.find((entry) => entry.id === activeWorkspace.id);
    return workspace?.name ?? UNNAMED_WORKSPACE_NAME;
  }
  return UNNAMED_WORKSPACE_NAME;
}

function isBuiltinActive(activeWorkspace: ActiveWorkspace, preset: LayoutPreset): boolean {
  return activeWorkspace.kind === 'builtin' && activeWorkspace.preset === preset;
}

function isUserActive(activeWorkspace: ActiveWorkspace, id: string): boolean {
  return activeWorkspace.kind === 'user' && activeWorkspace.id === id;
}

export const WorkspaceMenu: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userSubmenuId, setUserSubmenuId] = useState<string | null>(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalInitialName, setNameModalInitialName] = useState('');
  const [nameModalKey, setNameModalKey] = useState(0);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isInlineRenaming, setIsInlineRenaming] = useState(false);
  const [inlineRenameDraft, setInlineRenameDraft] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const inlineRenameRef = useRef<HTMLInputElement>(null);
  const triggerId = useId();
  const panelId = useId();

  const activeWorkspace = useLayoutStore((state) => state.activeWorkspace);
  const userWorkspaces = useLayoutStore((state) => state.userWorkspaces);
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);
  const renameUserWorkspace = useLayoutStore((state) => state.renameUserWorkspace);
  const saveCurrentWorkspaceAs = useLayoutStore((state) => state.saveCurrentWorkspaceAs);
  const deleteUserWorkspace = useLayoutStore((state) => state.deleteUserWorkspace);

  const { enableStreaming, streamingSource, setStreamingSource } = useSettingsStore();
  const addNotification = useUIStore((state) => state.addNotification);
  const { supportsAimpWorkspace } = usePlatformCapabilities();
  const { requestActivateWorkspace } = useWorkspaceActivation();

  const pillLabel = getActiveWorkspaceLabel(activeWorkspace, userWorkspaces);
  const canRenameOnPill = activeWorkspace.kind === 'user' || activeWorkspace.kind === 'scratch';
  const isUnnamedPill = canRenameOnPill && isUnnamedWorkspaceName(pillLabel);

  const existingUserNames = useMemo(
    () => userWorkspaces.map((workspace) => workspace.name),
    [userWorkspaces],
  );

  const visibleBuiltinPresets = useMemo(() => {
    const isDev = import.meta.env.DEV;
    return ALL_BUILTIN_PRESETS.filter((preset) => {
      if (preset === 'complex') {
        return isDev;
      }
      if (preset === 'party') {
        return enableStreaming;
      }
      return true;
    });
  }, [enableStreaming]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setUserSubmenuId(null);
  }, []);

  const cancelInlineRename = useCallback(() => {
    setIsInlineRenaming(false);
    setInlineRenameDraft('');
  }, []);

  const commitInlineRename = useCallback(() => {
    const trimmed = inlineRenameDraft.trim();
    if (!trimmed) {
      cancelInlineRename();
      return;
    }

    if (activeWorkspace.kind === 'scratch') {
      if (isUnnamedWorkspaceName(trimmed)) {
        cancelInlineRename();
        return;
      }
      const saved = saveCurrentWorkspaceAs(trimmed);
      if (saved) {
        cancelInlineRename();
      } else {
        inlineRenameRef.current?.select();
      }
      return;
    }

    if (activeWorkspace.kind !== 'user') {
      cancelInlineRename();
      return;
    }

    const currentName = userWorkspaces.find(
      (workspace) => workspace.id === activeWorkspace.id,
    )?.name;
    if (trimmed === currentName) {
      cancelInlineRename();
      return;
    }

    const renamed = renameUserWorkspace(activeWorkspace.id, trimmed);
    if (renamed) {
      cancelInlineRename();
      return;
    }

    inlineRenameRef.current?.select();
  }, [
    activeWorkspace,
    cancelInlineRename,
    inlineRenameDraft,
    renameUserWorkspace,
    saveCurrentWorkspaceAs,
    userWorkspaces,
  ]);

  const startInlineRename = useCallback(() => {
    if (!canRenameOnPill) {
      return;
    }
    closeMenu();
    setInlineRenameDraft(pillLabel);
    setIsInlineRenaming(true);
  }, [canRenameOnPill, closeMenu, pillLabel]);

  useEffect(() => {
    if (!isInlineRenaming) {
      return;
    }
    const id = window.requestAnimationFrame(() => {
      inlineRenameRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isInlineRenaming]);

  const showInlineRename = isInlineRenaming && canRenameOnPill;

  const notifyPresetSwitch = useCallback(
    (preset: LayoutPreset) => {
      addNotification({
        type: 'info',
        message: `Рабочее пространство: ${LAYOUT_PRESET_DISPLAY_NAMES_RU[preset]}`,
      });
    },
    [addNotification],
  );

  const handleActivateBuiltin = useCallback(
    (preset: LayoutPreset) => {
      if (isBuiltinActive(activeWorkspace, preset)) {
        closeMenu();
        return;
      }
      closeMenu();
      cancelInlineRename();
      const activated = requestActivateWorkspace({ kind: 'builtin', preset });
      if (activated) {
        notifyPresetSwitch(preset);
      }
    },
    [activeWorkspace, closeMenu, cancelInlineRename, notifyPresetSwitch, requestActivateWorkspace],
  );

  const handleActivateUser = useCallback(
    (id: string) => {
      if (isUserActive(activeWorkspace, id)) {
        closeMenu();
        return;
      }
      closeMenu();
      cancelInlineRename();
      const activated = requestActivateWorkspace({ kind: 'user', id });
      if (activated) {
        const workspace = userWorkspaces.find((entry) => entry.id === id);
        if (workspace) {
          addNotification({
            type: 'info',
            message: `Рабочее пространство: ${workspace.name}`,
          });
        }
      }
    },
    [
      activeWorkspace,
      addNotification,
      cancelInlineRename,
      closeMenu,
      requestActivateWorkspace,
      userWorkspaces,
    ],
  );

  const openRenameModal = useCallback(
    (name: string, userId: string) => {
      setNameModalInitialName(name);
      setRenameTargetId(userId);
      setNameModalKey((key) => key + 1);
      setNameModalOpen(true);
      closeMenu();
    },
    [closeMenu],
  );

  const handleCreateScratch = useCallback(() => {
    closeMenu();
    cancelInlineRename();
    requestCreateScratchWorkspace();
  }, [cancelInlineRename, closeMenu]);

  const handleRenameModalConfirm = useCallback(
    (name: string) => {
      if (!renameTargetId) {
        return;
      }
      const renamed = renameUserWorkspace(renameTargetId, name);
      if (renamed) {
        addNotification({ type: 'success', message: 'Название обновлено' });
        setNameModalOpen(false);
      }
    },
    [addNotification, renameTargetId, renameUserWorkspace],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) {
      return;
    }
    const deleted = deleteUserWorkspace(deleteTarget.id);
    if (deleted) {
      addNotification({ type: 'info', message: `Удалено: ${deleteTarget.name}` });
      setDeleteTarget(null);
    }
  }, [addNotification, deleteTarget, deleteUserWorkspace]);

  useEffect(() => {
    if (activeWorkspace.kind !== 'builtin') {
      return;
    }

    const isDev = import.meta.env.DEV;
    if (!isDev && activeWorkspace.preset === 'complex') {
      requestActivateWorkspace({ kind: 'builtin', preset: 'simple' }, { bypassDirtyGuard: true });
      return;
    }

    if (activeWorkspace.preset === 'aimp-party') {
      requestActivateWorkspace({ kind: 'builtin', preset: 'party' }, { bypassDirtyGuard: true });
      if (supportsAimpWorkspace && streamingSource !== 'aimp') {
        setStreamingSource('aimp');
      }
    }
  }, [
    activeWorkspace,
    requestActivateWorkspace,
    setStreamingSource,
    streamingSource,
    supportsAimpWorkspace,
  ]);

  const focusMenuItemAt = useCallback((index: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
    if (items.length === 0) return;
    const i = ((index % items.length) + items.length) % items.length;
    items[i]?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (userSubmenuId) {
          setUserSubmenuId(null);
          return;
        }
        closeMenu();
        queueMicrotask(() => chevronRef.current?.focus());
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeMenu, menuOpen, userSubmenuId]);

  useEffect(() => {
    if (!menuOpen) return;
    const id = window.requestAnimationFrame(() => {
      focusMenuItemAt(0);
    });
    return () => window.cancelAnimationFrame(id);
  }, [focusMenuItemAt, menuOpen]);

  const showMenuPanel = menuOpen && !isLayoutEditMode;

  const onMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusMenuItemAt(current < 0 ? 0 : current + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusMenuItemAt(current < 0 ? items.length - 1 : current - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusMenuItemAt(0);
          break;
        case 'End':
          e.preventDefault();
          focusMenuItemAt(items.length - 1);
          break;
        default:
          break;
      }
    },
    [focusMenuItemAt],
  );

  const onChevronKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (menuOpen || isLayoutEditMode) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuOpen(true);
      }
    },
    [isLayoutEditMode, menuOpen],
  );

  const renameExcludeName =
    renameTargetId !== null
      ? userWorkspaces.find((workspace) => workspace.id === renameTargetId)?.name
      : undefined;

  return (
    <div className="app-header-workspace">
      <div className="workspace-menu" ref={menuRef}>
        <div className="workspace-pill" id={triggerId}>
          {showInlineRename ? (
            <input
              ref={inlineRenameRef}
              type="text"
              className="workspace-pill__rename-input"
              value={inlineRenameDraft}
              placeholder="Название"
              aria-label="Название рабочего пространства"
              onChange={(e) => setInlineRenameDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitInlineRename();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelInlineRename();
                }
              }}
              onBlur={() => {
                window.requestAnimationFrame(() => {
                  if (showInlineRename) {
                    commitInlineRename();
                  }
                });
              }}
            />
          ) : (
            <button
              type="button"
              className={`workspace-pill__label-btn${canRenameOnPill ? ' workspace-pill__label-btn--rename' : ''}${isUnnamedPill ? ' workspace-pill__label-btn--unnamed' : ''}`}
              title={canRenameOnPill ? 'Нажмите, чтобы переименовать' : pillLabel}
              onClick={(e) => {
                if (canRenameOnPill) {
                  e.stopPropagation();
                  startInlineRename();
                }
              }}
            >
              {pillLabel}
            </button>
          )}

          <button
            ref={chevronRef}
            type="button"
            className="workspace-pill__chevron-btn"
            disabled={isLayoutEditMode}
            aria-haspopup="menu"
            aria-expanded={showMenuPanel}
            aria-controls={panelId}
            aria-label="Выбрать рабочее пространство"
            title={isLayoutEditMode ? LAYOUT_EDIT_DISABLED_TITLE : 'Выбрать рабочее пространство'}
            onClick={() => {
              if (!isLayoutEditMode) {
                setMenuOpen((open) => !open);
              }
            }}
            onKeyDown={onChevronKeyDown}
          >
            <ArrowDropDownIcon className="workspace-pill__chevron" aria-hidden />
          </button>
        </div>

        {showMenuPanel ? (
          <div
            ref={panelRef}
            id={panelId}
            className="workspace-menu__panel"
            role="menu"
            tabIndex={-1}
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
          >
            <div className="workspace-menu__section-label" role="presentation">
              Мои
            </div>

            {userWorkspaces.length === 0 ? (
              <div className="workspace-menu__empty" role="presentation">
                Нет сохранённых
              </div>
            ) : (
              userWorkspaces.map((workspace) => (
                <div key={workspace.id} className="workspace-menu__row">
                  <button
                    type="button"
                    className="workspace-menu__item workspace-menu__item--selectable"
                    role="menuitem"
                    onClick={() => handleActivateUser(workspace.id)}
                  >
                    <span className="workspace-menu__item-label">{workspace.name}</span>
                    {isUserActive(activeWorkspace, workspace.id) ? (
                      <CheckIcon className="workspace-menu__check" aria-hidden />
                    ) : null}
                  </button>
                  <div className="workspace-menu__row-actions">
                    <button
                      type="button"
                      className="workspace-menu__more-btn"
                      aria-haspopup="menu"
                      aria-expanded={userSubmenuId === workspace.id}
                      aria-label={`Действия: ${workspace.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserSubmenuId((current) =>
                          current === workspace.id ? null : workspace.id,
                        );
                      }}
                    >
                      <MoreHorizIcon fontSize="small" aria-hidden />
                    </button>
                    {userSubmenuId === workspace.id ? (
                      <div className="workspace-menu__submenu" role="menu">
                        <button
                          type="button"
                          className="workspace-menu__submenu-item"
                          role="menuitem"
                          onClick={() => openRenameModal(workspace.name, workspace.id)}
                        >
                          Переименовать…
                        </button>
                        <button
                          type="button"
                          className="workspace-menu__submenu-item workspace-menu__submenu-item--danger"
                          role="menuitem"
                          onClick={() => {
                            setDeleteTarget({ id: workspace.id, name: workspace.name });
                            setUserSubmenuId(null);
                            closeMenu();
                          }}
                        >
                          Удалить…
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            <div className="workspace-menu__section-label" role="presentation">
              Встроенные
            </div>

            {visibleBuiltinPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                className="workspace-menu__item"
                role="menuitem"
                onClick={() => handleActivateBuiltin(preset)}
              >
                <span className="workspace-menu__item-label">
                  {LAYOUT_PRESET_DISPLAY_NAMES_RU[preset]}
                </span>
                {isBuiltinActive(activeWorkspace, preset) ? (
                  <CheckIcon className="workspace-menu__check" aria-hidden />
                ) : null}
              </button>
            ))}

            <div className="workspace-menu__separator" role="separator" />

            <button
              type="button"
              className="workspace-menu__item"
              role="menuitem"
              onClick={handleCreateScratch}
            >
              Создать с нуля…
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={`app-header-workspace-edit-btn${isLayoutEditMode ? ' app-header-workspace-edit-btn--active' : ''}`}
        onClick={() => {
          if (isLayoutEditMode) {
            requestToggleLayoutEditMode();
            return;
          }
          closeMenu();
          cancelInlineRename();
          requestToggleLayoutEditMode();
        }}
        title={isLayoutEditMode ? 'Выйти из режима редактирования (Esc)' : 'Настроить окна'}
        aria-pressed={isLayoutEditMode}
        aria-label={isLayoutEditMode ? 'Готово' : 'Настроить окна'}
      >
        {isLayoutEditMode ? (
          <CheckIcon fontSize="small" aria-hidden />
        ) : (
          <EditOutlinedIcon fontSize="small" aria-hidden />
        )}
      </button>

      {isLayoutEditMode ? (
        <span className="app-header-workspace-edit-hint" role="status">
          Редактирование окон — Esc для выхода
        </span>
      ) : null}

      <WorkspaceNameModal
        key={nameModalKey}
        open={nameModalOpen}
        mode="rename"
        initialName={nameModalInitialName}
        existingNames={existingUserNames}
        excludeName={renameExcludeName}
        onClose={() => setNameModalOpen(false)}
        onConfirm={handleRenameModalConfirm}
      />

      <WorkspaceDeleteConfirmDialog
        open={deleteTarget !== null}
        workspaceName={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

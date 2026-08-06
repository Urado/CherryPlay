import { IconButton } from '@cherryplay/components';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useWorkspaceActivation } from '@app/hooks/useWorkspaceActivation';
import {
  requestCreateScratchWorkspace,
  requestToggleLayoutEditMode,
} from '@app/hooks/useWorkspaceDirtyGuard';
import {
  getLayoutPresetDescriptionRu,
  LAYOUT_PRESET_DISPLAY_NAMES_RU,
} from '@core/constants/layoutPresetDisplayNames';
import type { ActiveWorkspace, LayoutPreset } from '@core/types/workspacePreset';
import { isUnnamedWorkspaceName, UNNAMED_WORKSPACE_NAME } from '@core/types/workspacePreset';
import { usePlatformCapabilities } from '@shared/platform';
import { useLayoutStore, useSettingsStore } from '@shared/stores';
import { useOnlineNetworkPolicy } from '@shared/streaming';
import { isPartyLayoutPresetDiscoverable } from '@shared/utils/aimpPresetVisibility';

import { WorkspaceDeleteConfirmDialog } from './WorkspaceDeleteConfirmDialog';
import { LAYOUT_EDIT_DISABLED_TITLE } from './workspaceLayoutEditOptions';
import { WorkspaceNameModal } from './WorkspaceNameModal';

const ALL_BUILTIN_PRESETS: LayoutPreset[] = ['simple', 'collections-vertical', 'player', 'party'];

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
  const [builtinSubmenuPreset, setBuiltinSubmenuPreset] = useState<LayoutPreset | null>(null);
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
  const builtinLayoutOverrides = useLayoutStore((state) => state.builtinLayoutOverrides);
  const isLayoutEditMode = useLayoutStore((state) => state.isLayoutEditMode);
  const renameUserWorkspace = useLayoutStore((state) => state.renameUserWorkspace);
  const saveCurrentWorkspaceAs = useLayoutStore((state) => state.saveCurrentWorkspaceAs);
  const deleteUserWorkspace = useLayoutStore((state) => state.deleteUserWorkspace);
  const clearBuiltinOverride = useLayoutStore((state) => state.clearBuiltinOverride);

  const { streamingSource, setStreamingSource } = useSettingsStore();
  const { partyDiscoverabilityEnabled } = useOnlineNetworkPolicy();
  const { supportsAimpWorkspace } = usePlatformCapabilities();
  const { requestActivateWorkspace } = useWorkspaceActivation();

  const pillLabel = getActiveWorkspaceLabel(activeWorkspace, userWorkspaces);
  const canRenameOnPill = activeWorkspace.kind === 'user' || activeWorkspace.kind === 'scratch';
  const isUnnamedPill = canRenameOnPill && isUnnamedWorkspaceName(pillLabel);
  const activeBuiltinHasOverride =
    activeWorkspace.kind === 'builtin' && Boolean(builtinLayoutOverrides[activeWorkspace.preset]);

  const existingUserNames = useMemo(
    () => userWorkspaces.map((workspace) => workspace.name),
    [userWorkspaces],
  );

  const visibleBuiltinPresets = useMemo(() => {
    return ALL_BUILTIN_PRESETS.filter((preset) => {
      if (preset === 'party') {
        return isPartyLayoutPresetDiscoverable(partyDiscoverabilityEnabled);
      }
      return true;
    });
  }, [partyDiscoverabilityEnabled]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setUserSubmenuId(null);
    setBuiltinSubmenuPreset(null);
  }, []);

  const toggleMenu = useCallback(() => {
    if (isLayoutEditMode) {
      return;
    }
    setMenuOpen((open) => !open);
  }, [isLayoutEditMode]);

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

  const handleActivateBuiltin = useCallback(
    (preset: LayoutPreset) => {
      if (isBuiltinActive(activeWorkspace, preset)) {
        closeMenu();
        return;
      }
      closeMenu();
      cancelInlineRename();
      requestActivateWorkspace({ kind: 'builtin', preset });
    },
    [activeWorkspace, closeMenu, cancelInlineRename, requestActivateWorkspace],
  );

  const handleActivateUser = useCallback(
    (id: string) => {
      if (isUserActive(activeWorkspace, id)) {
        closeMenu();
        return;
      }
      closeMenu();
      cancelInlineRename();
      requestActivateWorkspace({ kind: 'user', id });
    },
    [activeWorkspace, cancelInlineRename, closeMenu, requestActivateWorkspace],
  );

  const handleResetBuiltin = useCallback(
    (preset: LayoutPreset) => {
      clearBuiltinOverride(preset);
      setBuiltinSubmenuPreset(null);
      closeMenu();
    },
    [clearBuiltinOverride, closeMenu],
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
        setNameModalOpen(false);
      }
    },
    [renameTargetId, renameUserWorkspace],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) {
      return;
    }
    const deleted = deleteUserWorkspace(deleteTarget.id);
    if (deleted) {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteUserWorkspace]);

  useEffect(() => {
    if (activeWorkspace.kind !== 'builtin') {
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

  const getMenuItems = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return [];
    return [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
  }, []);

  const focusMenuItemAt = useCallback(
    (index: number) => {
      const items = getMenuItems();
      if (items.length === 0) return;
      const i = ((index % items.length) + items.length) % items.length;
      items[i]?.focus();
    },
    [getMenuItems],
  );

  const focusMoreButton = useCallback((selector: string) => {
    queueMicrotask(() => {
      panelRef.current?.querySelector<HTMLElement>(selector)?.focus();
    });
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
        if (builtinSubmenuPreset) {
          const preset = builtinSubmenuPreset;
          setBuiltinSubmenuPreset(null);
          focusMoreButton(`[data-workspace-more="builtin:${preset}"]`);
          return;
        }
        if (userSubmenuId) {
          const userId = userSubmenuId;
          setUserSubmenuId(null);
          focusMoreButton(`[data-workspace-more="user:${userId}"]`);
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
  }, [builtinSubmenuPreset, closeMenu, focusMoreButton, menuOpen, userSubmenuId]);

  useEffect(() => {
    if (!menuOpen) return;
    const id = window.requestAnimationFrame(() => {
      focusMenuItemAt(0);
    });
    return () => window.cancelAnimationFrame(id);
  }, [focusMenuItemAt, menuOpen]);

  useEffect(() => {
    if (!builtinSubmenuPreset && !userSubmenuId) {
      return;
    }
    const id = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('.workspace-menu__submenu [role="menuitem"]')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [builtinSubmenuPreset, userSubmenuId]);

  const showMenuPanel = menuOpen && !isLayoutEditMode;

  const onMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const items = getMenuItems();
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
        case 'ArrowRight': {
          const active = document.activeElement;
          if (!(active instanceof HTMLElement)) break;
          if (
            active.classList.contains('workspace-menu__more-btn') &&
            active.getAttribute('aria-expanded') !== 'true'
          ) {
            e.preventDefault();
            active.click();
            break;
          }
          const moreBtn = active
            .closest('.workspace-menu__row')
            ?.querySelector<HTMLElement>('.workspace-menu__more-btn');
          if (!moreBtn || moreBtn === active) break;
          e.preventDefault();
          moreBtn.focus();
          break;
        }
        case 'ArrowLeft': {
          const active = document.activeElement;
          if (!(active instanceof HTMLElement)) break;
          if (active.closest('.workspace-menu__submenu')) {
            e.preventDefault();
            if (builtinSubmenuPreset) {
              const preset = builtinSubmenuPreset;
              setBuiltinSubmenuPreset(null);
              focusMoreButton(`[data-workspace-more="builtin:${preset}"]`);
            } else if (userSubmenuId) {
              const userId = userSubmenuId;
              setUserSubmenuId(null);
              focusMoreButton(`[data-workspace-more="user:${userId}"]`);
            }
            break;
          }
          if (!active.classList.contains('workspace-menu__more-btn')) break;
          const rowItem = active
            .closest('.workspace-menu__row')
            ?.querySelector<HTMLElement>('.workspace-menu__item[role="menuitem"]');
          if (!rowItem) break;
          e.preventDefault();
          rowItem.focus();
          break;
        }
        default:
          break;
      }
    },
    [builtinSubmenuPreset, focusMenuItemAt, focusMoreButton, getMenuItems, userSubmenuId],
  );

  const onMenuTriggerKeyDown = useCallback(
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

  const menuTriggerTitle = isLayoutEditMode
    ? LAYOUT_EDIT_DISABLED_TITLE
    : activeBuiltinHasOverride
      ? 'Рабочие окна · изменено'
      : 'Рабочие окна';
  const pillEyebrow = activeBuiltinHasOverride ? 'Рабочие окна · изменено' : 'Рабочие окна';
  const pillAriaLabel = activeBuiltinHasOverride
    ? `Рабочие окна: ${pillLabel}, изменено`
    : `Рабочие окна: ${pillLabel}`;

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
              className={`workspace-pill__label-btn${isUnnamedPill ? ' workspace-pill__label-btn--unnamed' : ''}`}
              title={menuTriggerTitle}
              disabled={isLayoutEditMode}
              aria-haspopup="menu"
              aria-expanded={showMenuPanel}
              aria-controls={panelId}
              aria-label={pillAriaLabel}
              onClick={toggleMenu}
              onKeyDown={onMenuTriggerKeyDown}
            >
              <span className="workspace-pill__eyebrow">{pillEyebrow}</span>
              <span className="workspace-pill__name">{pillLabel}</span>
            </button>
          )}

          {canRenameOnPill && !showInlineRename ? (
            <button
              type="button"
              className="workspace-pill__rename-btn"
              title="Переименовать"
              aria-label="Переименовать рабочее пространство"
              onClick={(e) => {
                e.stopPropagation();
                startInlineRename();
              }}
            >
              <DriveFileRenameOutlineIcon className="workspace-pill__rename-icon" aria-hidden />
            </button>
          ) : null}

          <button
            ref={chevronRef}
            type="button"
            className="workspace-pill__chevron-btn"
            disabled={isLayoutEditMode}
            aria-haspopup="menu"
            aria-expanded={showMenuPanel}
            aria-controls={panelId}
            aria-label={pillAriaLabel}
            title={menuTriggerTitle}
            onClick={toggleMenu}
            onKeyDown={onMenuTriggerKeyDown}
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
            aria-label="Рабочие окна"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
          >
            <div className="workspace-menu__section-label" role="presentation">
              Рабочие окна
            </div>

            {visibleBuiltinPresets.map((preset) => {
              const description = getLayoutPresetDescriptionRu(preset);
              const isModified = Boolean(builtinLayoutOverrides[preset]);
              const isActive = isBuiltinActive(activeWorkspace, preset);
              return (
                <div key={preset} className="workspace-menu__row">
                  <button
                    type="button"
                    className="workspace-menu__item workspace-menu__item--with-description workspace-menu__item--selectable"
                    role="menuitem"
                    title={description}
                    onClick={() => handleActivateBuiltin(preset)}
                  >
                    <span className="workspace-menu__item-text">
                      <span className="workspace-menu__item-label">
                        <span className="workspace-menu__item-label-text">
                          {LAYOUT_PRESET_DISPLAY_NAMES_RU[preset]}
                        </span>
                        {isModified ? (
                          <span className="workspace-menu__changed-mark">изменено</span>
                        ) : null}
                      </span>
                      {description ? (
                        <span className="workspace-menu__item-description">{description}</span>
                      ) : null}
                    </span>
                    {isActive ? <CheckIcon className="workspace-menu__check" aria-hidden /> : null}
                  </button>
                  {isModified ? (
                    <div className="workspace-menu__row-actions">
                      <button
                        type="button"
                        className="workspace-menu__more-btn"
                        role="menuitem"
                        data-workspace-more={`builtin:${preset}`}
                        aria-haspopup="menu"
                        aria-expanded={builtinSubmenuPreset === preset}
                        aria-label={`Действия: ${LAYOUT_PRESET_DISPLAY_NAMES_RU[preset]}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserSubmenuId(null);
                          setBuiltinSubmenuPreset((current) =>
                            current === preset ? null : preset,
                          );
                        }}
                      >
                        <MoreHorizIcon fontSize="small" aria-hidden />
                      </button>
                      {builtinSubmenuPreset === preset ? (
                        <div className="workspace-menu__submenu" role="menu">
                          <button
                            type="button"
                            className="workspace-menu__submenu-item"
                            role="menuitem"
                            onClick={() => handleResetBuiltin(preset)}
                          >
                            Сбросить к исходному
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

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
                      role="menuitem"
                      data-workspace-more={`user:${workspace.id}`}
                      aria-haspopup="menu"
                      aria-expanded={userSubmenuId === workspace.id}
                      aria-label={`Действия: ${workspace.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBuiltinSubmenuPreset(null);
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

      <IconButton
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
        icon={
          isLayoutEditMode ? (
            <CheckIcon fontSize="small" aria-hidden />
          ) : (
            <EditOutlinedIcon fontSize="small" aria-hidden />
          )
        }
        variant="ghost"
        size="sm"
      ></IconButton>

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

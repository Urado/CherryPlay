import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ClearIcon from '@mui/icons-material/Clear';
import FolderIcon from '@mui/icons-material/Folder';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  Fragment,
} from 'react';
import { createPortal } from 'react-dom';

import { useAudioPathDurations, useItemSelection } from '@shared/hooks';
import { getPlatformCapabilities, isPlatformInitialized } from '@shared/platform';
import { DEMO_MUSIC_ROOT } from '@shared/platform/fixtures/fileBrowserTree';
import { fileService, ipcService } from '@shared/services';
import { useDemoPlayerStore, useSettingsStore, useUIStore } from '@shared/stores';
import { useDebounce, logger } from '@shared/utils';
import { formatTrackDuration } from '@shared/utils/durationUtils';
import {
  createFileBrowserNavState,
  goBackInFileBrowserHistory,
  normalizeFileBrowserPath,
  type FileBrowserNavState,
  pushFileBrowserPath,
} from '@shared/utils/fileBrowserNavigationHistory';

import { FileBrowserItemRow } from './FileBrowserItemRow';

export const FileBrowser: React.FC = () => {
  const setFileBrowserPath = useSettingsStore((state) => state.setFileBrowserPath);
  const [pathNav, setPathNav] = useState<FileBrowserNavState>(() => createFileBrowserNavState(''));
  const currentPath = pathNav.entries[pathNav.index] ?? '';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [items, setItems] = useState<
    Array<{ name: string; path: string; isDirectory: boolean; size?: number }>
  >([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevealPath, setPendingRevealPath] = useState<string | null>(null);
  const focusRequest = useUIStore((state) => state.fileBrowserFocusRequest);
  const acknowledgeFocusRequest = useUIStore((state) => state.acknowledgeFileBrowserFocus);
  const {
    currentTrack: activeTrack,
    status: playerStatus,
    loadTrack: loadDemoTrack,
    play,
    pause,
  } = useDemoPlayerStore();
  const activeTrackPath = activeTrack?.path;
  const { usesFixtureFileBrowser } = getPlatformCapabilities();

  useEffect(() => {
    const initializePath = async () => {
      if (!isPlatformInitialized()) {
        setLoading(false);
        setError('Платформа приложения не инициализирована.');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const saved = useSettingsStore.getState().fileBrowserPath;
        let initialPath: string;
        if (saved && saved.trim() !== '') {
          initialPath = saved.trim();
        } else if (usesFixtureFileBrowser) {
          initialPath = DEMO_MUSIC_ROOT;
        } else {
          try {
            initialPath = await ipcService.getSystemPath('music');
          } catch {
            initialPath = await ipcService.getSystemPath('home');
          }
        }
        setPathNav(createFileBrowserNavState(initialPath));
      } catch (err) {
        setError((err as Error).message || 'Failed to initialize file browser');
        logger.error('Failed to initialize file browser', err);
        setLoading(false);
      }
    };

    void initializePath();
  }, [usesFixtureFileBrowser]);

  useEffect(() => {
    if (currentPath && currentPath.trim() !== '') {
      setFileBrowserPath(currentPath);
    }
  }, [currentPath, setFileBrowserPath]);

  const goToPath = useCallback((path: string) => {
    setPathNav((state) => pushFileBrowserPath(state, path));
  }, []);

  const handleChooseFolder = useCallback(async () => {
    if (!isPlatformInitialized()) {
      return;
    }
    try {
      const path = await ipcService.showFolderDialog({
        title: 'Выберите папку',
        defaultPath: currentPath || undefined,
      });
      if (path && path.trim() !== '') {
        goToPath(path.trim());
      }
    } catch (err) {
      logger.error('Failed to choose folder', err);
    }
  }, [currentPath, goToPath]);

  const loadDirectory = async (path: string) => {
    if (!isPlatformInitialized()) {
      setLoading(false);
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const contents = await fileService.listFolder(path);
      setItems(contents);
      setDurations({});
    } catch (err) {
      setError((err as Error).message || 'Failed to load directory');
      logger.error('Failed to load directory', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const audioPaths = useMemo(
    () =>
      items
        .filter((item) => !item.isDirectory && fileService.isValidAudioFile(item.path))
        .map((item) => item.path),
    [items],
  );

  const requestAudioDuration = useCallback((path: string) => {
    if (!isPlatformInitialized()) {
      return Promise.reject(new Error('Platform API not available'));
    }
    return ipcService.getAudioDuration(path);
  }, []);

  const onBrowserDurationResolved = useCallback((path: string, duration: number) => {
    setDurations((prev) => (prev[path] === duration ? prev : { ...prev, [path]: duration }));
  }, []);

  const onBrowserDurationError = useCallback((_path: string, error: Error) => {
    logger.warn(`File browser duration: ${error.message}`);
  }, []);

  useAudioPathDurations({
    paths: usesFixtureFileBrowser ? [] : audioPaths,
    requestDuration: requestAudioDuration,
    onResolved: onBrowserDurationResolved,
    onError: onBrowserDurationError,
    batchSize: 5,
  });

  useEffect(() => {
    if (currentPath) {
      loadDirectory(currentPath);
    }
  }, [currentPath]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const { path } = focusRequest;
    const directory = fileService.getParentPath(path);
    setSearchQuery('');
    setPendingRevealPath(path);

    if (
      directory &&
      normalizeFileBrowserPath(directory) !== normalizeFileBrowserPath(currentPath)
    ) {
      goToPath(directory);
    }

    acknowledgeFocusRequest();
  }, [focusRequest, currentPath, acknowledgeFocusRequest, goToPath]);

  useEffect(() => {
    if (!pendingRevealPath) {
      return;
    }

    const hasItem = items.some((item) => item.path === pendingRevealPath);
    if (!hasItem) {
      return;
    }

    setSelectedPaths(new Set([pendingRevealPath]));

    const selectorValue =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(pendingRevealPath)
        : pendingRevealPath.replace(/"/g, '\\"');

    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-file-path="${selectorValue}"]`);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        element.classList.add('file-browser-item--pulse');
        setTimeout(() => element.classList.remove('file-browser-item--pulse'), 1200);
      }
    });

    setPendingRevealPath(null);
  }, [items, pendingRevealPath]);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const filteredItems = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return items;
    }

    const query = debouncedSearchQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, debouncedSearchQuery]);

  const fileBrowserSelectionItems = useMemo(
    () => filteredItems.map((item) => ({ id: item.path })),
    [filteredItems],
  );

  const { selectAll: selectAllVisible, deselectAll: deselectAllVisible } = useItemSelection({
    items: fileBrowserSelectionItems,
    selectedIds: selectedPaths,
    onSelectionChange: setSelectedPaths,
  });

  const hasSelectedPaths = selectedPaths.size > 0;

  // Breadcrumbs jump by path (handleNavigate); Back still uses history only — same as typical file managers.
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    return fileService.getPathSegments(currentPath);
  }, [currentPath]);

  const [overflowIndex, setOverflowIndex] = useState(0);
  const [breadcrumbDropdownOpen, setBreadcrumbDropdownOpen] = useState(false);
  const [breadcrumbDropdownAnchor, setBreadcrumbDropdownAnchor] = useState<DOMRect | null>(null);
  const breadcrumbsContainerRef = useRef<HTMLDivElement>(null);
  const breadcrumbsContentRef = useRef<HTMLDivElement>(null);
  const breadcrumbEllipsisRef = useRef<HTMLButtonElement>(null);
  const breadcrumbDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOverflowIndex(0);
  }, [currentPath]);

  useEffect(() => {
    const el = breadcrumbsContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOverflowIndex(0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const container = breadcrumbsContainerRef.current;
    const content = breadcrumbsContentRef.current;
    if (!container || !content || breadcrumbs.length === 0) return;
    if (content.scrollWidth > container.clientWidth && overflowIndex < breadcrumbs.length - 1) {
      setOverflowIndex((prev) => prev + 1);
    }
  }, [breadcrumbs, overflowIndex]);

  const openBreadcrumbDropdown = useCallback(() => {
    const rect = breadcrumbEllipsisRef.current?.getBoundingClientRect();
    if (rect) {
      setBreadcrumbDropdownAnchor(rect);
      setBreadcrumbDropdownOpen(true);
    }
  }, []);

  const closeBreadcrumbDropdown = useCallback(() => {
    setBreadcrumbDropdownOpen(false);
    setBreadcrumbDropdownAnchor(null);
  }, []);

  useEffect(() => {
    if (!breadcrumbDropdownOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBreadcrumbDropdown();
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const container = breadcrumbsContainerRef.current;
      const dropdown = breadcrumbDropdownRef.current;
      if (container && !container.contains(target) && !dropdown?.contains(target)) {
        closeBreadcrumbDropdown();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [breadcrumbDropdownOpen, closeBreadcrumbDropdown]);

  const handleNavigate = async (path: string) => {
    try {
      const stats = await fileService.readFileMeta(path);
      if (stats && stats.isDirectory) {
        goToPath(path);
        setSelectedPaths(new Set());
      }
    } catch (err) {
      logger.error('Failed to navigate', err);
    }
  };

  const handleDoubleClick = (item: { path: string; isDirectory: boolean }) => {
    if (item.isDirectory) {
      handleNavigate(item.path);
    }
  };

  const handleBack = useCallback(() => {
    setPathNav((state) => goBackInFileBrowserHistory(state));
    setSelectedPaths(new Set());
  }, []);

  const selectSingleItem = (path: string) => {
    setSelectedPaths(new Set([path]));
  };

  const handleItemKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    item: { path: string; isDirectory: boolean },
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (item.isDirectory) {
        handleNavigate(item.path);
      } else {
        selectSingleItem(item.path);
      }
    }

    if (event.key === ' ') {
      event.preventDefault();
      selectSingleItem(item.path);
    }
  };

  const handleUp = useCallback(() => {
    const parent = fileService.getParentPath(currentPath);
    if (
      parent != null &&
      normalizeFileBrowserPath(parent) !== normalizeFileBrowserPath(currentPath)
    ) {
      goToPath(parent);
      setSelectedPaths(new Set());
    }
  }, [currentPath, goToPath]);

  const handleBreadcrumbClick = (path: string) => {
    handleNavigate(path);
  };

  const handleItemClick = (e: React.MouseEvent, path: string) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(path)) {
          newSet.delete(path);
        } else {
          newSet.add(path);
        }
        return newSet;
      });
    } else if (e.shiftKey && selectedPaths.size > 0) {
      const itemsArray = items.map((item) => item.path);
      const lastSelected = Array.from(selectedPaths).pop();
      if (lastSelected) {
        const lastIndex = itemsArray.indexOf(lastSelected);
        const currentIndex = itemsArray.indexOf(path);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const range = itemsArray.slice(start, end + 1);

          setSelectedPaths((prev) => new Set([...prev, ...range]));
        }
      }
    } else {
      setSelectedPaths(new Set([path]));
    }
  };

  const handleDragStart = (e: React.DragEvent, path: string) => {
    const pathsToDrag =
      selectedPaths.has(path) && selectedPaths.size > 1 ? Array.from(selectedPaths) : [path];

    const filesToDrag = pathsToDrag.filter((p) => {
      const item = items.find((i) => i.path === p);
      return item && !item.isDirectory;
    });
    const directoriesToDrag = pathsToDrag.filter((p) => {
      const item = items.find((i) => i.path === p);
      return item && item.isDirectory;
    });

    if (filesToDrag.length === 0 && directoriesToDrag.length === 0) {
      e.preventDefault();
      return;
    }

    setDraggedPath(path);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'fileBrowser',
        paths: filesToDrag,
        directories: directoriesToDrag,
      }),
    );
  };

  const handleDragEnd = () => {
    setDraggedPath(null);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    return `${kb.toFixed(1)} KB`;
  };

  const DURATION_PLACEHOLDER = 'длительность…';
  const formatFileMeta = (item: { path: string; size?: number }, isAudio: boolean): string => {
    const parts: string[] = [];
    const duration = durations[item.path];
    if (duration != null && Number.isFinite(duration)) {
      parts.push(formatTrackDuration(duration));
    } else if (isAudio && usesFixtureFileBrowser) {
      parts.push('Demo');
    } else if (isAudio) {
      parts.push(DURATION_PLACEHOLDER);
    }
    if (item.size != null && item.size > 0) {
      parts.push(formatFileSize(item.size));
    }
    return parts.join(' • ');
  };

  const handlePlayFile = useCallback(
    async (item: { path: string; name: string }) => {
      try {
        const track = {
          id: item.path,
          path: item.path,
          name: item.name,
        };
        const isSameTrack = activeTrackPath === item.path;
        if (!isSameTrack || playerStatus === 'ended') {
          await loadDemoTrack(track, 'file-browser-preview');
        }
        await play();
      } catch (err) {
        logger.error('Failed to preview file from browser', err);
      }
    },
    [activeTrackPath, playerStatus, loadDemoTrack, play],
  );

  const parentPath = fileService.getParentPath(currentPath);
  const canGoBack = pathNav.index > 0;
  const hasDifferentParentPath =
    parentPath != null
      ? normalizeFileBrowserPath(parentPath) !== normalizeFileBrowserPath(currentPath)
      : false;
  const canGoUp = hasDifferentParentPath;

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <div className="file-browser-nav">
          <button
            className="nav-button"
            onClick={handleBack}
            disabled={!canGoBack || loading}
            title="Назад (по истории навигации)"
            type="button"
            aria-label="Назад по истории навигации"
          >
            <ArrowBackIcon />
          </button>
          <button
            className="nav-button"
            onClick={handleUp}
            disabled={!canGoUp || loading}
            title="К родительской папке"
            type="button"
            aria-label="К родительской папке"
          >
            <ArrowUpwardIcon />
          </button>
          <div className="breadcrumbs" ref={breadcrumbsContainerRef}>
            <div className="breadcrumbs-inner" ref={breadcrumbsContentRef}>
              {overflowIndex > 0 && (
                <>
                  <button
                    type="button"
                    className="breadcrumb-ellipsis"
                    ref={breadcrumbEllipsisRef}
                    onClick={openBreadcrumbDropdown}
                    disabled={loading}
                    title="Скрытые элементы пути"
                    aria-expanded={breadcrumbDropdownOpen}
                    aria-haspopup="menu"
                  >
                    …
                  </button>
                  <span className="breadcrumb-separator"> &gt; </span>
                </>
              )}
              {breadcrumbs.slice(overflowIndex).map((crumb, i) => (
                <Fragment key={crumb.path}>
                  {i > 0 && <span className="breadcrumb-separator"> &gt; </span>}
                  <button
                    type="button"
                    className="breadcrumb-item"
                    onClick={() => handleBreadcrumbClick(crumb.path)}
                    disabled={loading}
                  >
                    {crumb.name}
                  </button>
                </Fragment>
              ))}
            </div>
            {breadcrumbDropdownOpen &&
              breadcrumbDropdownAnchor &&
              createPortal(
                <div
                  ref={breadcrumbDropdownRef}
                  className="breadcrumb-dropdown"
                  role="menu"
                  style={{
                    position: 'fixed',
                    top: breadcrumbDropdownAnchor.bottom + 4,
                    left: breadcrumbDropdownAnchor.left,
                    minWidth: Math.max(breadcrumbDropdownAnchor.width, 160),
                  }}
                >
                  {[...breadcrumbs.slice(0, overflowIndex)].reverse().map((crumb) => (
                    <button
                      key={crumb.path}
                      type="button"
                      className="breadcrumb-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        handleBreadcrumbClick(crumb.path);
                        closeBreadcrumbDropdown();
                      }}
                    >
                      {crumb.name}
                    </button>
                  ))}
                </div>,
                document.body,
              )}
          </div>
          <div className="file-browser-toolbar-actions">
            {hasSelectedPaths ? (
              <button
                type="button"
                className="nav-button"
                onClick={deselectAllVisible}
                disabled={loading}
                title="Снять выделение"
                aria-label="Снять выделение"
              >
                <ClearIcon />
              </button>
            ) : (
              filteredItems.length > 0 && (
                <button
                  type="button"
                  className="nav-button"
                  onClick={selectAllVisible}
                  disabled={loading}
                  title="Выбрать всё"
                  aria-label="Выбрать всё"
                >
                  <SelectAllIcon />
                </button>
              )
            )}
            <button
              type="button"
              className="file-browser-choose-folder"
              onClick={handleChooseFolder}
              disabled={loading}
              title="Выбрать папку"
            >
              <FolderIcon /> Папка
            </button>
          </div>
        </div>
        <input
          type="text"
          className="file-browser-search"
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="file-browser-list">
        {loading ? (
          <div className="empty-state">
            <p>Загрузка...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <p style={{ color: '#d32f2f' }}>Ошибка: {error}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <p>Папка пуста</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = selectedPaths.has(item.path);
            const isDragging = draggedPath === item.path;
            const isAudioFile = !item.isDirectory && fileService.isValidAudioFile(item.path);
            const isActiveAudio = isAudioFile && activeTrackPath === item.path;
            const isPlayingAudio = isActiveAudio && playerStatus === 'playing';
            const secondaryMeta =
              !item.isDirectory && formatFileMeta(item, isAudioFile)
                ? formatFileMeta(item, isAudioFile)
                : '';

            return (
              <FileBrowserItemRow
                key={item.path}
                item={item}
                isSelected={isSelected}
                isDragging={isDragging}
                isAudioFile={isAudioFile}
                isActiveAudio={isActiveAudio}
                isPlayingAudio={isPlayingAudio}
                primaryContent={item.name}
                secondaryContent={secondaryMeta}
                onPlay={() => void handlePlayFile(item)}
                onPause={pause}
                onClick={(e) => handleItemClick(e, item.path)}
                onDoubleClick={() => handleDoubleClick(item)}
                onDragStart={(e) => handleDragStart(e, item.path)}
                onDragEnd={handleDragEnd}
                onKeyDown={(event) => handleItemKeyDown(event, item)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

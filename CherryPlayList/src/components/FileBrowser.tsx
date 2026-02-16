import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import React, { useState, useMemo, useEffect, KeyboardEvent, useCallback } from 'react';

import { fileService, ipcService } from '@shared/services';
import { useDemoPlayerStore, useUIStore } from '@shared/stores';
import { useDebounce, logger } from '@shared/utils';
import { formatTrackDuration } from '@shared/utils/durationUtils';

export const FileBrowser: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
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

  // Initialize with system music folder
  useEffect(() => {
    const initializePath = async () => {
      try {
        setLoading(true);
        setError(null);
        // Try to get music folder, fallback to home if not available
        let initialPath: string;
        try {
          initialPath = await ipcService.getSystemPath('music');
        } catch {
          initialPath = await ipcService.getSystemPath('home');
        }
        setCurrentPath(initialPath);
        await loadDirectory(initialPath);
      } catch (err) {
        setError((err as Error).message || 'Failed to initialize file browser');
        logger.error('Failed to initialize file browser', err);
      } finally {
        setLoading(false);
      }
    };

    initializePath();
  }, []);

  // Load directory contents
  const loadDirectory = async (path: string) => {
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

  const DURATION_CONCURRENCY = 5;
  useEffect(() => {
    const audioPaths = items
      .filter((item) => !item.isDirectory && fileService.isValidAudioFile(item.path))
      .map((item) => item.path);
    if (audioPaths.length === 0) return;

    let cancelled = false;

    const run = async () => {
      for (let i = 0; i < audioPaths.length; i += DURATION_CONCURRENCY) {
        if (cancelled) return;
        const chunk = audioPaths.slice(i, i + DURATION_CONCURRENCY);
        const results = await Promise.allSettled(chunk.map((p) => ipcService.getAudioDuration(p)));
        if (cancelled) return;
        setDurations((prev) => {
          const next = { ...prev };
          chunk.forEach((path, idx) => {
            const result = results[idx];
            if (result.status === 'fulfilled' && Number.isFinite(result.value)) {
              next[path] = result.value;
            }
          });
          return next;
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [items]);

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

    if (directory && directory !== currentPath) {
      setCurrentPath(directory);
    }

    acknowledgeFocusRequest();
  }, [focusRequest, currentPath, acknowledgeFocusRequest]);

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

  // Debounce search query to avoid excessive filtering on rapid typing
  // For future recursive search, this will prevent excessive IPC calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return items;
    }

    const query = debouncedSearchQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, debouncedSearchQuery]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    return fileService.getPathSegments(currentPath);
  }, [currentPath]);

  const handleNavigate = async (path: string) => {
    try {
      const stats = await fileService.readFileMeta(path);
      if (stats && stats.isDirectory) {
        setCurrentPath(path);
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

  const handleBack = () => {
    const parent = fileService.getParentPath(currentPath);
    if (parent) {
      setCurrentPath(parent);
      setSelectedPaths(new Set());
    }
  };

  const selectSingleItem = (path: string) => {
    setSelectedPaths(new Set([path]));
  };

  const handleItemKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
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

  const handleUp = () => {
    handleBack();
  };

  const handleBreadcrumbClick = (path: string) => {
    handleNavigate(path);
  };

  const handleItemClick = (e: React.MouseEvent, path: string) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: toggle selection
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
      // Shift+Click: select range
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
      // Regular click: single selection
      setSelectedPaths(new Set([path]));
    }
  };

  const handleDragStart = (e: React.DragEvent, path: string) => {
    // If item is selected, drag all selected items
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
  const canGoBack = parentPath !== null;

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <div className="file-browser-nav">
          <button
            className="nav-button"
            onClick={handleBack}
            disabled={!canGoBack || loading}
            title="Назад"
          >
            <ArrowBackIcon />
          </button>
          <button
            className="nav-button"
            onClick={handleUp}
            disabled={!canGoBack || loading}
            title="Вверх"
          >
            <ArrowUpwardIcon />
          </button>
          <div className="breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && <span className="breadcrumb-separator"> &gt; </span>}
                <button
                  className="breadcrumb-item"
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  disabled={loading}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
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

            return (
              <div
                key={item.path}
                className={`file-browser-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                data-file-path={item.path}
                onClick={(e) => handleItemClick(e, item.path)}
                onDoubleClick={() => handleDoubleClick(item)}
                draggable
                onDragStart={(e) => handleDragStart(e, item.path)}
                onDragEnd={handleDragEnd}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => handleItemKeyDown(event, item)}
                aria-pressed={isSelected}
              >
                <div className="file-browser-item-icon">
                  {item.isDirectory ? (
                    <FolderIcon className="folder-icon" />
                  ) : (
                    <InsertDriveFileIcon className="file-icon" />
                  )}
                </div>
                <div className="file-browser-item-info">
                  <div className="file-browser-item-name">{item.name}</div>
                  {!item.isDirectory && formatFileMeta(item, isAudioFile) && (
                    <div className="file-browser-item-size">
                      {formatFileMeta(item, isAudioFile)}
                    </div>
                  )}
                </div>
                {isAudioFile && (
                  <div className="file-browser-item-actions">
                    <button
                      type="button"
                      className={`file-browser-play-button ${isActiveAudio ? 'active' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isPlayingAudio) {
                          pause();
                        } else {
                          void handlePlayFile(item);
                        }
                      }}
                      title={isPlayingAudio ? 'Пауза' : 'Воспроизвести'}
                    >
                      {isPlayingAudio ? (
                        <PauseIcon fontSize="small" />
                      ) : (
                        <PlayArrowIcon fontSize="small" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

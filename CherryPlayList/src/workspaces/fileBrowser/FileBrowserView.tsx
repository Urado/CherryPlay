import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import React, { useState, useMemo, useEffect, KeyboardEvent, useCallback } from 'react';

import { WorkspaceId } from '@core/types/workspace';
import { FileRow, ItemList, EmptyState } from '@shared/components';
import { FileItem } from '@shared/components/rows/FileRow';
import { usePlaybackPreview } from '@shared/hooks';
import { fileService, ipcService } from '@shared/services';
import { useUIStore } from '@shared/stores';
import { useDebounce, logger } from '@shared/utils';

interface FileBrowserViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const FileBrowserView: React.FC<FileBrowserViewProps> = ({
  workspaceId,
  zoneId: _zoneId,
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRevealPath, setPendingRevealPath] = useState<string | null>(null);
  const focusRequest = useUIStore((state) => state.fileBrowserFocusRequest);
  const acknowledgeFocusRequest = useUIStore((state) => state.acknowledgeFileBrowserFocus);

  // Use unified playback preview hook
  const { activeTrackId, playerStatus, startPlayback, pausePlayback } = usePlaybackPreview({
    workspaceId,
  });
  // For file browser, we track by path since files don't have stable IDs
  const activeTrackPath = activeTrackId;

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
    } catch (err) {
      setError((err as Error).message || 'Failed to load directory');
      logger.error('Failed to load directory', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Reload directory when path changes
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
      const element = document.querySelector<HTMLElement>(`[data-item-id="${selectorValue}"]`);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        element.classList.add('file-browser-item--pulse');
        setTimeout(() => element.classList.remove('file-browser-item--pulse'), 1200);
      }
    });

    setPendingRevealPath(null);
  }, [items, pendingRevealPath]);

  // Debounce search query to avoid excessive filtering on rapid typing
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

  const handleDoubleClick = (item: FileItem) => {
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

  const handleItemKeyDown = (event: KeyboardEvent<HTMLDivElement>, item: FileItem) => {
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

  // Handle play for file items using the unified hook
  const handlePlayFile = useCallback(
    (item: FileItem) => {
      // Create a track object from the file item
      // Using path as ID since files don't have stable IDs
      const track = {
        id: item.path,
        path: item.path,
        name: item.name,
      };
      startPlayback(track);
    },
    [startPlayback],
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

      <ItemList
        className="file-browser-list"
        showEmptyState={!loading}
        emptyState={
          error ? (
            <EmptyState message={`Ошибка: ${error}`} />
          ) : (
            <EmptyState message="Папка пуста" />
          )
        }
      >
        {loading ? (
          <EmptyState message="Загрузка..." />
        ) : (
          filteredItems.map((item) => {
            const isSelected = selectedPaths.has(item.path);
            const isDragging = draggedPath === item.path;
            const isAudioFile = !item.isDirectory && fileService.isValidAudioFile(item.path);
            const isActiveAudio = isAudioFile && activeTrackPath === item.path;
            const isPlayingAudio = isActiveAudio && playerStatus === 'playing';

            return (
              <FileRow
                key={item.path}
                item={item}
                isSelected={isSelected}
                isDragging={isDragging}
                isAudioFile={isAudioFile}
                isActive={isActiveAudio}
                isPlaying={isPlayingAudio}
                onClick={handleItemClick}
                onDoubleClick={handleDoubleClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onKeyDown={handleItemKeyDown}
                onPlay={() => handlePlayFile(item)}
                onPause={pausePlayback}
              />
            );
          })
        )}
      </ItemList>
    </div>
  );
};

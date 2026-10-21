import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface CollectionOption {
  id: string;
  name: string;
}

interface CollectionPickerProps {
  collectionId: string;
  name: string;
  collections: CollectionOption[];
  onSelect: (collectionId: string) => void;
  onCreate: () => void;
  onRename: (name: string) => void;
  onDelete?: (collectionId: string) => void;
}

export const CollectionPicker: React.FC<CollectionPickerProps> = ({
  collectionId,
  name,
  collections,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cancelRenameRef = useRef(false);

  const finishRename = useCallback((commit: boolean) => {
    if (!commit) cancelRenameRef.current = true;
    const value = draft.trim();
    if (commit && value) onRename(value);
    setEditing(false);
    setDraft(name);
  }, [draft, name, onRename]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => setDraft(name), [name]);

  const closeMenu = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const beginRename = () => {
    closeMenu(false);
    setDraft(name);
    setEditing(true);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (open && (event.key === 'Enter' || event.key === ' ')) {
      setOpen(false);
      return;
    }
    const key = event.key;
    setOpen(true);
    window.requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)');
      if (!items?.length) return;
      if (key === 'Enter' || key === ' ') {
        const selectedItem = menuRef.current?.querySelector<HTMLButtonElement>(
          '[role="menuitemradio"][aria-checked="true"]',
        );
        (selectedItem ?? items[0]).focus();
        return;
      }
      (key === 'ArrowDown' ? items[0] : items[items.length - 1]).focus();
    });
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [],
    );
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  };

  return (
    <div className={`workspace-menu collection-picker${open ? ' collection-picker--open' : ''}`} ref={rootRef}>
      <div className="workspace-pill">
        {editing ? (
          <input
            ref={inputRef}
            className="workspace-pill__rename-input"
            value={draft}
            aria-label="Название подборки"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') finishRename(true);
              if (event.key === 'Escape') finishRename(false);
            }}
            onBlur={() => {
              if (cancelRenameRef.current) {
                cancelRenameRef.current = false;
                return;
              }
              finishRename(true);
            }}
          />
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className="workspace-pill__label-btn"
            aria-label={`Подборка: ${name}`}
            aria-haspopup="menu"
            aria-expanded={open}
            onKeyDown={handleTriggerKeyDown}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="workspace-pill__name">{name}</span>
          </button>
        )}
        {!editing && (
          <button
            type="button"
            className="workspace-pill__rename-btn"
            title="Переименовать"
            aria-label="Переименовать подборку"
            onClick={beginRename}
          >
            <DriveFileRenameOutlineIcon className="workspace-pill__rename-icon" aria-hidden />
          </button>
        )}
        {!editing && (
          <button
            type="button"
            className="workspace-pill__chevron-btn"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Открыть список подборок"
            onKeyDown={handleTriggerKeyDown}
            onClick={() => setOpen((value) => !value)}
          >
            <ArrowDropDownIcon className="workspace-pill__chevron" aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div
          ref={menuRef}
          className="workspace-menu__panel collection-picker__panel"
          role="menu"
          aria-label="Подборки проекта"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="workspace-menu__section-label" role="presentation">Подборки проекта</div>
          {collections.map((collection) => (
            <div className="workspace-menu__row collection-picker__row" key={collection.id}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={collection.id === collectionId}
                className="workspace-menu__item collection-picker__select"
                onClick={() => {
                  closeMenu();
                  if (collection.id !== collectionId) onSelect(collection.id);
                }}
              >
                <span className="workspace-menu__item-label-text">{collection.name}</span>
                {collection.id === collectionId && <CheckIcon className="workspace-menu__check" aria-hidden />}
              </button>
              {onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  className="workspace-menu__item collection-picker__delete"
                  aria-label={`Удалить подборку ${collection.name}`}
                  title="Удалить подборку"
                  onClick={() => {
                    closeMenu(false);
                    onDelete(collection.id);
                  }}
                >
                  <CloseIcon aria-hidden />
                </button>
              )}
            </div>
          ))}
          <div className="workspace-menu__separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="workspace-menu__item"
            onClick={() => {
              closeMenu();
              onCreate();
            }}
          >
            Создать новую подборку
          </button>
        </div>
      )}
    </div>
  );
};

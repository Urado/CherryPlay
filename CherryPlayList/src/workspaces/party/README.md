# Party module

Два зарегистрированных workspace для онлайн-вечеринки и общая party-подсистема (store + runtime hook). Подробнее: [docs/modules/workspaces/party.md](../../../docs/modules/workspaces/party.md).

## Workspaces

| | Party Editor | Party Preview |
| --- | --- | --- |
| **ID** | `party-editor-workspace` | `party-preview-workspace` |
| **Тип** | `party-editor` | `party-preview` |
| **View** | `PartyEditorView` | `PartyPreviewView` |
| **Wrapper** | `PartyEditorViewWrapper` | `PartyPreviewViewWrapper` |

Регистрация в `index.ts`. Тип `party` / `party-workspace` не используется.

**Party Editor:** баннер привязки, `PartyTrackDisplaySection`, `PartyEditor`, auth, недоступность сервера, entitlement.

**Party Preview:** только `PartyPreview` (read-only потребление runtime: тема, кастомизация, preview playlist, playback).

Оба wrapper проверяют `enableStreaming`; при `false` — disabled-сообщение (`PartyViewWrapper.css`).

## Party subsystem

```
party/
├── partyWorkspaceStore.ts       # Zustand: форма, server/theme/lifecycle UI state
├── partyWorkspaceUtils.ts       # константы, нормализация
├── partyWorkspaceReconnectRefs.ts  # singleton reconnect + mount count
├── usePartyWorkspace.ts         # usePartyWorkspaceRuntime()
├── PartyEditorView.tsx / PartyPreviewView.tsx
├── *ViewWrapper.tsx
├── index.ts                     # register обоих workspace
└── components/                  # PartyEditor, PartyTrackDisplaySection, …
```

- **Store** — изменяемое UI-состояние вечеринки (не дублирует `linkedParty` / `partyTrackDisplay` из `projectStore`).
- **`usePartyWorkspaceRuntime()`** — load linked party, reconnect, theme access, handlers (`handleCreateParty`, `handlePublish`, …), derived для Preview.
- **Reconnect** — один таймер на сессию через `partyWorkspaceReconnectRefs`, даже если Editor и Preview смонтированы вместе.

## Состояние и API

- `projectStore` — плейлист, `meta.linkedParty`, `meta.partyTrackDisplay`
- `partyService` — HTTP API вечеринок
- `partyWorkspaceStore` — эфемерное runtime-состояние формы и онлайн-UI

## Layout

Пресеты `party` и `aimp-party` — три колонки: player или aimp (50%), editor (25%), preview (25%). См. `layoutStore.ts`, `layoutPreset.ts`.

Persist layout **v3**: legacy-зона `party` / `party-workspace` автоматически раскладывается в editor + preview (`migrateLegacyPartyLayout`).

## Зависимости

- `@cherryplay/components`
- `@shared/stores/projectStore`
- `@shared/services/partyService`

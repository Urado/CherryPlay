# Party module

Два зарегистрированных workspace для онлайн-вечеринки и общая party-подсистема (stores + runtime hook). Подробнее: [docs/modules/workspaces/party.md](../../../docs/modules/workspaces/party.md). UX пульта и настроек: [docs/party-header-control-ux.md](../../../docs/party-header-control-ux.md).

## Workspaces

|             | Party Editor             | Party Preview             |
| ----------- | ------------------------ | ------------------------- |
| **ID**      | `party-editor-workspace` | `party-preview-workspace` |
| **Тип**     | `party-editor`           | `party-preview`           |
| **View**    | `PartyEditorView` (stub) | `PartyPreviewView`        |
| **Wrapper** | `PartyEditorViewWrapper` | `PartyPreviewViewWrapper` |

Регистрация в `index.ts`. Тип `party` / `party-workspace` не используется.

**Настройки:** центральный модал `PartySettingsModal` (`openPartySettingsModal` из пульта ⚙ / Create / К настройкам). При `draft-unlinked` — только info + видимость + **Создать** / **Привязать**. После link — метаданные (карточка/extended), дизайн, `PartyTrackDisplaySection` (по фазе), Copy URL, каталог, **Обновить** / legacy Make Ready, приглушённая **В архив** (confirm / blockedByLive / quiet). **Нет** в модале: Publish, Unarchive, return-to-draft.

**Design в превью:** `partySettingsUiStore` (`previewDesignOpen`) + `PartyPreviewDesignNav` (≡) / `PartyPreviewDesignPanel` в `PartyPreviewView` (панель свёрнута по умолчанию; без меню секций).

**Party Preview:** `PartyPreview` через `usePartyPreviewEffectiveState()`; connectivity-баннеры; всегда нижняя `PartyWorkspaceDemoPanel` `mode="preview"`.

Пресет **«Играть для гостей»**: player + party-preview (без party-editor).

Оба wrapper → `PartyStreamingGate` (runtime provider only). **Нет** gate по `enableStreaming`; офлайн — `PartyConnectivityBanner` внутри view.

## Party subsystem

```
party/
├── partyWorkspaceStore.ts           # production: форма, server/theme/lifecycle UI
├── partySettingsUiStore.ts          # previewDesignOpen (design panel collapse)
├── partyProgramEndedStore.ts        # ephemeral programEnded + reminder
├── partyHeaderCommands.ts           # publishPartyToSite, archivePartyFromHeader, unarchivePartyFromHeader
├── partyPreviewScenarioStore.ts   # preview scenario: sync/detached overrides
├── partyPreviewScenarioActions.ts # продуктовые мутации сценария (не demo-gated)
├── partyPreviewEffectiveState.ts  # resolvePartyPreviewEffectiveState + usePartyPreviewEffectiveState()
├── partyPreviewMockPlayback.ts    # mock live + connection-break map
├── partyEditorDemoStore.ts        # editor demo overlay (blockedOverride)
├── partyWorkspaceDemoActions.ts   # demo orchestration (guardDemoMode)
├── partyWorkspaceUtils.ts
├── partyWorkspaceReconnectRefs.ts
├── usePartyWorkspace.ts           # usePartyWorkspaceRuntime()
├── usePartySettingsFormState.ts   # shared form state for modal + preview design
├── PartyEditorView.tsx / PartyPreviewView.tsx
├── PartyPreviewDesignPanel.tsx
├── PartyWorkspaceDemoPanel.tsx    # thin UI consumer scenario actions (preview mode)
```

- **Preview scenario store** — локальная симуляция превью; default `isSynchronized: true`; сброс — `resetPreviewScenario()` / кнопка **«Снова как на сайте»** в preview-панели (эквивалент `syncPreviewWithProduction()`).
- **Editor demo store** — только overlay blocked-reason в demo mode редактора.
- **`usePartyPreviewEffectiveState()`** — единая точка merge для рендера preview (см. модульную документацию).

## Состояние и API

- `projectStore` — плейлист, `meta.linkedParty`, `meta.partyTrackDisplay`
- `partyService` — HTTP API вечеринок
- `partyWorkspaceStore` — production runtime (не scenario/demo)

## Layout

Пресет `party` (и `aimp-party`): **player + party-preview** (50/50). Зона `party-editor` — только в кастомных layout. См. `layoutPresetFactories.ts`, `layoutPreset.ts`.

Persist layout **v3**: legacy-зона `party` / `party-workspace` автоматически раскладывается в editor + preview (`migrateLegacyPartyLayout`).

## Зависимости

- `@cherryplay/components`
- `@shared/stores/projectStore`
- `@shared/services/partyService`

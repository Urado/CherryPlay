# Party module

Два зарегистрированных workspace для онлайн-вечеринки и общая party-подсистема (stores + runtime hook). Подробнее: [docs/modules/workspaces/party.md](../../../docs/modules/workspaces/party.md).

## Workspaces

| | Party Editor | Party Preview |
| --- | --- | --- |
| **ID** | `party-editor-workspace` | `party-preview-workspace` |
| **Тип** | `party-editor` | `party-preview` |
| **View** | `PartyEditorView` | `PartyPreviewView` |
| **Wrapper** | `PartyEditorViewWrapper` | `PartyPreviewViewWrapper` |

Регистрация в `index.ts`. Тип `party` / `party-workspace` не используется.

**Party Editor:** баннер привязки, `PartyTrackDisplaySection`, контроль каталога **«В каталоге»** / **«По ссылке»**, `PartyEditor`, auth, connectivity-баннеры, entitlement.

**Party Preview:** `PartyPreview` через `usePartyPreviewEffectiveState()`; connectivity-баннеры; всегда нижняя `PartyWorkspaceDemoPanel` `mode="preview"`.

Оба wrapper → `PartyStreamingGate` (runtime provider only). **Нет** gate по `enableStreaming`; офлайн — `PartyConnectivityBanner` внутри view.

## Party subsystem (три store)

```
party/
├── partyWorkspaceStore.ts           # production: форма, server/theme/lifecycle UI
├── partyPreviewScenarioStore.ts   # preview scenario: sync/detached overrides
├── partyPreviewScenarioActions.ts # продуктовые мутации сценария (не demo-gated)
├── partyPreviewEffectiveState.ts  # resolvePartyPreviewEffectiveState + usePartyPreviewEffectiveState()
├── partyPreviewMockPlayback.ts    # mock live + connection-break map
├── partyEditorDemoStore.ts        # editor demo overlay (blockedOverride)
├── partyWorkspaceDemoActions.ts   # demo orchestration (guardDemoMode)
├── partyWorkspaceUtils.ts
├── partyWorkspaceReconnectRefs.ts
├── usePartyWorkspace.ts           # usePartyWorkspaceRuntime()
├── PartyEditorView.tsx / PartyPreviewView.tsx
├── PartyWorkspaceDemoPanel.tsx    # thin UI consumer scenario actions (preview mode)
├── *ViewWrapper.tsx
├── index.ts
└── components/
    ├── PartyPreviewScenarioControls.tsx  # scenario UI (panel variant in preview)
    └── PartyEditor, PartyTrackDisplaySection, …
```

- **Production store** — форма и онлайн-UI; сбросы `resetPartyWorkspaceState` / `resetPartyLinkState` **не** трогают scenario и editor demo.
- **Preview scenario store** — локальная симуляция превью; default `isSynchronized: true`; сброс — `resetPreviewScenario()` / кнопка «Сброс сценария» в preview-панели (эквивалент `syncPreviewWithProduction()`).
- **Editor demo store** — только overlay blocked-reason в demo mode редактора.
- **`usePartyPreviewEffectiveState()`** — единая точка merge для рендера preview (см. модульную документацию).

## Состояние и API

- `projectStore` — плейлист, `meta.linkedParty`, `meta.partyTrackDisplay`
- `partyService` — HTTP API вечеринок
- `partyWorkspaceStore` — production runtime (не scenario/demo)

## Layout

Пресеты `party` и `aimp-party` — три колонки: player или aimp (50%), editor (25%), preview (25%). См. `layoutPresetFactories.ts` (фабрики), `layoutPreset.ts` (сигнатуры).

Persist layout **v3**: legacy-зона `party` / `party-workspace` автоматически раскладывается в editor + preview (`migrateLegacyPartyLayout`).

## Зависимости

- `@cherryplay/components`
- `@shared/stores/projectStore`
- `@shared/services/partyService`

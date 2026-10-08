# Shell theme foundation

## Token inventory and decision

`src/styles/shell-palette.css` is imported by `src/styles/primitives.css`, which is loaded by CherryPlayWeb and CherryPlayList. It is the shared runtime source for shell colors and primitive dimensions.

CherryPlayList `src/styles/variables.css` previously repeated the shared colors and supplied app-only spacing and typography values. It now contains only List-specific tokens. `src/theme/theme.ts` and `src/theme/generateCSS.ts` have no application imports; the generator is referenced only by the old styles README example, so neither defines runtime colors.

CherryPlayWeb previously replaced the shared blue accent with green in `src/index.css`. That override is removed so both shells use the existing List blue accent (`#4a9eff`). Shared shell tokens are scoped by `data-shell-theme="dark"` on the document element. Party pages keep their independent `data-theme` attribute.

The Web route inventory in `CherryPlayWeb/docs/pages.md` includes service pages (`/login`, `/cabinet`, `/admin/...`, legal routes) and party routes (`/party/:shortCode`, `/party/:shortCode/info`). Party view and info roots set `data-theme`; party navigation, info links, and lifecycle controls resolve local theme variables. Each registered PartyTheme defines aliases for shared primitive borders, states, button contrast, and shadow tokens. PartyTheme portals keep their own `data-theme` wrapper under `document.body`. In List, the theme selector and guide overlays carry the selected PartyTheme explicitly; unrelated workspace portals remain in the shell context.

## Boundary contract

- `data-shell-theme` selects the application shell palette. It does not identify a PartyTheme.
- PartyTheme variables are declared on elements carrying `data-theme`. Their local values override inherited shell tokens inside party content.
- `data-theme` is scoped to a PartyTheme root. `applyPartyTheme` requires that root element and does not apply a theme to `document.documentElement`.
- A portal rendered under `document.body` inherits the document shell palette. Theme-specific portal content must keep a `data-theme` wrapper, as the spring-cross-step cancellation tooltip already does.
- Shell primitive CSS reads semantic tokens such as `--accent-primary`, `--state-error`, and `--ui-border` on the primitive element. It does not cache them in inherited `--cp-*` aliases, so a primitive placed inside a PartyTheme can resolve that theme's local values.
- `--cp-*` remains the namespace for primitive dimensions and sizes. PartyTheme keeps control of its own `data-theme` variables and does not need to set `data-shell-theme`.

## CherryPlayList integration

`src/styles/index.css` imports shared `primitives.css` first and app-specific `variables.css` second; `entry.tsx` then loads the themed PartyTheme styles. The latter supplies spacing, typography, and layout-edit tokens only. Workspace geometry and edit-mode tokens remain List-owned.

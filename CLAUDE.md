# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Workspace-level context (the three-tier architecture, the DB/API contract, the
> `./start-*.sh` run scripts, branch strategy) lives in the **root `CLAUDE.md`** one
> directory up. This file is scoped to the **React frontend** (`shimano-pcm-web/`).
> On the `uat-v1` branch. Author commits as **corpfield**.

## What this is

The **PCM (Process Capability Metrics)** dashboard — a React 19 / Create React App SPA
that visualises SPC capability indices (Cp/Cpk/Pp/Ppk) for Shimano Heat-Treatment
quality. Served at **`/PCM`** (router basename), not `/`. Talks to the .NET API over
REST/JSON; can also run fully **backend-free** in demo mode against captured fixtures.

## Commands

```bash
npm install --legacy-peer-deps     # React 19 vs react-scripts 5 peer conflicts
npm run start:demo                 # backend-free dev server on :3002 (mock fixtures, no API/DB)
npm run build:demo                 # deployable static build, backend-free  → build/
npm start                          # live-API dev (needs NODE_OPTIONS=--openssl-legacy-provider; use root start-web.sh)
npm test                           # CRA/Jest watch — only the default smoke test exists; no real suite
```

- `start:demo` / `build:demo` set `REACT_APP_DEMO_MODE=mock` + `NODE_OPTIONS=--openssl-legacy-provider`.
  This is the **client-demo artifact** and the normal way to develop UI here.
- `npm start` alone fails on Node 17+ without `NODE_OPTIONS=--openssl-legacy-provider`; the root
  `start-web.sh` injects it. Append `?mode=light` / `?mode=dark` to any URL to force a colour mode.
- There is no lint script; ESLint runs inline via `react-app` config during the build (CRA).
  A production build treats warnings as errors unless `CI=false` is set.

## Big-picture architecture

### Provider/render tree (who wraps whom)

`src/index.js` calls **`installMockAdapter()` before render** (so demo mode is wired before any
axios call), then mounts:

```
ContextProvider (global reducer store — src/context/ContextProvider.js)
└─ App  →  ColorModeProvider  →  AppInner
   └─ ThemeProvider theme={createPcmTheme(mode)}   ← light/dark rebuilt on mode change
      └─ QueryClientProvider (react-query — present but most data uses raw axios)
         └─ TimeSeriesContext.Provider
            └─ AuthLayout (SPC Portal SSO redirect; bypassed on localhost OR demo build)
               └─ NavBar (two-tier) + <Box footer> + <Routes>
```

### Routing (`src/App.js`)

`/` **and** `/lot-cpk-bar` both render `LotCPKBarChart` (Individual-Lot scorecard). Other key routes:
`/lots-cpk-ppk-bar` → `LotsCPPKBarChart` (Dimension scorecard), `/lots-historical-summary` →
`HistoricalOverallLots`, `/nc-lot-bar` → `NCLotRankBar` (Key Focus), `/data-purge-config` →
`DataPurgeConfig`. The `*-clicked-table` / `*-distribution-table` / `subsample-scatter` routes are
**drill-in views** reached by clicking a bar/point on a scorecard.

### Global filter state is the cross-component contract

The scorecard filters (Dept, MachineId, Material/DimensionDesc, CAT, Start/End Month) live in the
**`ContextProvider` reducer** (`UPDATE_FILTERS` action), read via **`useValue()`**. Scorecard pages
own a local `filters` state and *push* it to context; drill-in tables/charts and `NCLotRankBar`
*read* filters straight from context (`state.filters`) so a click navigates without re-selecting.
When changing filter behaviour, trace both the local state and the `dispatch({type:'UPDATE_FILTERS'})`
sync `useEffect`.

### Data layer

All HTTP is **raw axios to `window.baseURL`** (see Gotchas) — `react-query` is installed but barely
used. Endpoints are POST-with-`{filter}` or GET-with-params; some multiplex on a body discriminator
(`/unified-data` switches on `dataType`: `ACNCdata_daily` / `ACNCdata_monthly` / `IndividualLot`).

### Mock seam (`src/mocks/`) — how demo mode works

`install.js` swaps `axios.defaults.adapter` for `resolver.mjs`, which **normalises the URL path**
(strips host + query) and returns the matching fixture from `fixtures.js` (JSON in `fixtures/`).
Routes that also vary by request body switch on a discriminator (e.g. `/unified-data` reads
`dataType`, `/unified-data-nc-rank` reads `datatype`). **Unmapped routes return `[]`** (and log) so
the demo never crashes. To add an endpoint to the demo: capture its live response → save under
`fixtures/` → import it in `fixtures.js` → add a `case` in `resolver.mjs`. `fixtures.js` is imported
at the entry point, so a malformed fixture JSON **breaks the build** — validate it.

### Design system & theming

`src/theme/pcmTheme.js` exports a single **`createPcmTheme(mode)`** factory building both light and
dark palettes, with project tokens on **`theme.palette.custom`** (e.g. `custom.nav`, `custom.navText`).
Colour mode lives in `src/context/ColorModeContext.js` — `useColorMode()` gives `{mode, toggle}`;
initial mode is `?mode=` URL param → `localStorage('pcm-color-mode')` → default `dark`.
**Always use theme tokens** (`text.primary`, `background.paper`, `divider`, `action.hover`,
`primary.main`, `custom.*`) — legacy code (notably `components/charts/NCLotRankBar.css`) hardcodes
`#fff`/`#121212`/`!important` that look fine in dark but break light mode. Known recurring tokens to
keep (do not revert to hardcoded values): the italic "ⓘ Important Note" text uses **`primary.main`**
(was `#9ad0ff`, unreadable on light); furnace/pie section headers use `primary`/`success`/`warning.main`.
Always sanity-check a change in **both** `?mode=light` and `?mode=dark`.

### Scorecard UI conventions (follow these when editing or adding pages)

- **Two-tier `NavBar.js`**: Tier 1 = brand header (white Shimano logo chip via cropped
  `backgroundImage`, "PCM Dashboard" text, SPL select, SPC Portal link, light/dark toggle); Tier 2 =
  module tab bar driven by `NAV_ITEMS` with an active-underline `tabSx(isActive)`.
- **Filters are a horizontal top bar**, not a left sidebar: a bordered `background.paper` strip below
  the tab bar — `FILTERS` label → segmented `COUNT`/`PERCENT` pill → `Autocomplete` fields
  (`minWidth:160, flex:'1 1 160px'`, `flexWrap`) → compact **Clear** + a collapse chevron gated on a
  `filterOpen` state (BRD S1/G4 retractable). `LotCPKBarChart`, `LotsCPPKBarChart`, `NCLotRankBar`
  all share this shape; `HistoricalOverallLots` uses the equivalent shared `components/FilterManager.js`.
- **Shared chart UI**: `components/charts/KpiTile.js` (colour-tinted stat tile + exported `KPI`
  palette) and `components/charts/StackTotalLabels.js` (stacked-bar total labels via MUI X Charts
  `useXScale`/`useYScale`). Charts use **`@mui/x-charts`** — other chart libs in `package.json`
  (plotly, chart.js, syncfusion, d3) belong to archived/testing components, not the live scorecards
  (exception: the Subsample histogram in `OverallLotsDistributionTable.js` is a real **Plotly** `<Plot>`).
- **`StackTotalLabels` props** (used by `LotCPKBarChart` + `LotsCPPKBarChart`): `categories`,
  `totals` (printed number + y-anchor in COUNT mode); `positions` (separate y-anchor — used in PERCENT
  mode so the *count* total prints above the ~100%-tall bar); `labels` (override printed text);
  `angle` (rotate −90° to stand totals vertically). The charts pass `angle={-90}` and force angled
  x-axis tick labels (`tickLabelInterval: () => true`, `tickLabelStyle.angle: 45`) **only when there
  are >14 data points**, so dense ranges don't overlap. Keep that 14-point threshold consistent.
- **Bar-chart `margin` must use concrete numbers, never `undefined`** — MUI x-charts treats
  `margin={{ bottom: undefined }}` as invalid and collapses the plot (bars vanish, x-axis jumps to
  top). Build a full object per case, e.g. `margin={showAllTicks ? {top:75,bottom:90} : {top:55}}`.

### Drill-in view conventions (`*-clicked-table`, `*-distribution-table`)

`OverallLotsClickedTable`, `IndividualLotsClickedTable`, and `OverallLotsDistributionTable` are the
drill-in pages reached from a scorecard. Keep them consistent:

- **Layout**: a row flex (`display:flex, gap:{xs:1,md:3}`) with a left **pie-filter panel** and a
  right **content card**, both using the card pattern (`bgcolor:'background.paper'`, `border:'1px
  solid'`, `borderColor:'divider'`, `borderRadius:2`). The pie panel uses **donut** pies
  (`innerRadius:45`) centred with `justifyContent:'center'`; section headers are theme tokens
  (`primary.main` / `success.main` / `warning.main`), not hardcoded pastels.
- **They require router `state`** (the clicked row/period/metric) passed via `navigate(path,{state})`.
  Opening the URL directly throws (`Cannot destructure 'state'`/`reading 'Dept'`) — this is expected,
  not a bug. To screenshot one headlessly, temporarily add a **module-level** stable fallback object
  and use `location.state || FALLBACK` (a fallback created inline per-render re-fires the fetch
  `useEffect` forever — must be a stable reference), then revert.
- **Clickable row + nested action button**: when a `<TableRow onClick>` navigates AND a `<Button>`
  inside it also navigates, the button's click **bubbles** to the row → two `navigate()` calls →
  duplicate history entry (browser Back needs two clicks) or landing on the wrong page. Always
  `e.stopPropagation()` in the inner button's `onClick`.
- **Plotly histogram theming**: `OverallLotsDistributionTable`'s `<Plot>` defaults to a white
  background. Theme it via `useTheme()` — `paper_bgcolor`/`plot_bgcolor:'rgba(0,0,0,0)'` (inherit
  card bg) and `theme.palette.text.*`/`divider` for fonts/axes/grid. The "No data" overlay text in
  MUI x-charts is overridden with `slotProps={{ noDataOverlay: { message: 'No Result' } }}`.
- The column-filter **`<Popover>` option lists** must use theme tokens (`text.primary`, inherited
  `background.paper`, `divider`) — do not hardcode `#fff`/`#333`/`#eee` (white box in dark mode,
  invisible text in light). The blue selected/hover highlight is fine in both modes.

### Verifying UI without a browser

No browser tool; render headless with any Chromium browser and Read the screenshot. Use
`--virtual-time-budget=9000` so async axios data settles before the capture. Add `?mode=light` /
`?mode=dark` to verify both themes.

macOS (Brave):
```bash
"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1500,1300 --virtual-time-budget=9000 \
  --screenshot=/tmp/shot.png "http://localhost:3002/PCM/?mode=dark"   # then Read /tmp/shot.png
```

Windows (Chrome, via the Bash tool — this is the dev box used in practice):
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1500,1000 --virtual-time-budget=9000 \
  --screenshot="$OUT/shot.png" "http://localhost:3002/PCM/lot-cpk-bar?mode=dark"
```
The CRA dev server is **slow to first-compile** here (often >2 min); poll
`curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/PCM/` until it returns `200` before
screenshotting, and stop it afterwards via the port's owning PID (`Get-NetTCPConnection -LocalPort
3002 … taskkill`). For drill-in pages, use the stable-fallback-`state` trick described above.

## Gotchas (frontend-specific)

- **API base URL is `window.baseURL`, set in `public/index.html` from `%REACT_APP_BASE_URL%`**
  (CRA build-time interpolation, the `%PUBLIC_URL%` mechanism — `process.env.X` does NOT work in an
  inline script). There is a **single `.env`** (no `.env.development`/`.env.production`), so
  `REACT_APP_BASE_URL` has one value for all modes — currently the prod API
  `https://spl-spc01.shimano.com.sg:3004`. For local dev against a local backend, edit that line to
  `http://localhost:5000`. Irrelevant in demo mode (the mock adapter strips the host; if
  `REACT_APP_BASE_URL` is unset, `window.baseURL` is empty and `mocks/install.js` falls back to `/api`).
- **`public/index.html` and `package-lock.json` are `skip-worktree`'d** so local-run edits never
  commit to `uat-v1`. Check `git ls-files -v | grep '^S'`; `git update-index --no-skip-worktree <f>`
  to edit one for real. NOTE: now that `index.html` is env-driven (no hardcoded host), un-skipping it
  and committing the `%REACT_APP_BASE_URL%` version is safe and recommended.
- **Auth bypass** (`src/app/auth/layout.jsx`): the SPC Portal SSO redirect is skipped when
  `hostname` is localhost/127.0.0.1 **or** `REACT_APP_DEMO_MODE==='mock'` — both inert in a real
  production build, so this is committed to `uat-v1`. Don't push a localhost-only hack to `UAT`/`main`.
- **Basename `/PCM`** (`REACT_APP_BASE_PATH`): `http://localhost:3002/` renders blank; use `/PCM`.
- Port **3002** (3000/3001 usually taken on macOS); the live API is on **5259**.

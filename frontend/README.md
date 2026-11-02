# Skelly Ultra frontend

The **Skelly** sidebar panel and the **Skelly Ultra** dashboard card, written in
TypeScript with [Lit](https://lit.dev) and built with [Vite](https://vite.dev)
into one ES module:
`custom_components/skelly_ultra/frontend/skelly-ultra.js`.

The built bundle is committed, because HACS installs the integration straight
from git, with no build step. The integration serves the bundle, loads it on
every page (so dashboards know the card) and registers the panel
(`custom_components/skelly_ultra/frontend.py`). This folder is outside
`custom_components/`, so HACS doesn't install it.

## Building

You need Node.js 22 or later (CI uses 24).

```bash
cd frontend
npm ci              # once, and after package-lock.json changes
npm run build       # writes custom_components/skelly_ultra/frontend/skelly-ultra.js
npm run dev         # rebuilds on every change
npm run check       # Biome (lint + format), TypeScript, unit tests (vitest)
npm run format      # fixes formatting and import order
```

Commit the rebuilt bundle together with the source change. CI rebuilds it and
fails if the committed bundle doesn't match the sources.

## Trying it in Home Assistant

Copy or mount `custom_components/skelly_ultra` into a Home Assistant
configuration and restart Home Assistant. The bundle URL carries a hash of the
bundle that Home Assistant computes at startup, so after a rebuild without a
restart, reload the browser with its cache disabled (devtools, Network,
"Disable cache").

- The panel is at `/skelly-ultra` (sidebar: **Skelly**). Each Skelly's
  options (Settings, Devices & services, Skelly Ultra, Configure) have a
  switch to hide it; the panel shows while any Skelly has it on.
- The card is in the dashboard editor's card picker as **Skelly Ultra**, or in
  YAML as `type: custom:skelly-ultra-card`.

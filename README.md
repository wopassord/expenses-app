# Ledger

A lightweight personal expense tracker. Static app (GitHub Pages) + data in a
**private** GitHub repo, written through the GitHub API with a fine-grained
token that only this browser knows.

```
docs/                       ← the app, served by GitHub Pages
  index.html, css/, vendor/chart.umd.js, sw.js, manifest.webmanifest
  js/
    models/        domain: catalog (types, sources, categories), transaction, settings
    repositories/  persistence: GitHub / local stores, DataRepository (offline queue, conflict retry)
    services/      stats, projection, recurring, autocomplete
    views/         pure HTML templates + Chart.js wrappers
    controllers/   wire views to the repository; one per tab
    main.js        app shell, router, connection
tools/import_ods.py         one-off import of the original spreadsheet
```

Run locally: `python3 -m http.server -d docs 8000` → http://localhost:8000 (demo mode works offline).

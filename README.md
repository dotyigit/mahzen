# Mahzen (Tauri + Next.js Rewrite)

Mahzen is being rewritten as a high-performance desktop app using:

- `Tauri v2` (native shell + Rust core)
- `Next.js 16` (App Router frontend)
- `shadcn/ui` + Tailwind v4 (design system)
- `SQLite` (single `mahzen.sqlite` database in app data)

## Current status

Implemented:

- Tauri + Next.js project scaffold
- Tray icon and desktop window control
- SQLite database bootstrapping and migrations
- Rust repositories + Tauri commands for:
  - targets
  - sync profiles
  - transfer queue
- New control-plane style UI shell wired to native commands
- Desktop bundle path verified (`tauri build --debug`)

Planned next:

- Full S3 operations layer (list/upload/download/presign/copy/move/delete)
- Real transfer executor + progress events
- Sync planner/executor parity with the defined migration spec
- Dedicated tray panel window + global drop upload flow

## Development

Install dependencies:

```bash
npm install
```

Run desktop app in development:

```bash
npm run tauri:dev
```

Run web-only frontend (without native commands):

```bash
npm run dev
```

Lint:

```bash
npm run lint
```

Production bundle:

```bash
npm run tauri:build
```

## Project layout

```text
src/                 Next.js frontend
src-tauri/           Rust core + Tauri config
docs/                Architecture and migration drafts
```

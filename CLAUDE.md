# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Mahzen

Mahzen is a native desktop S3/S3-compatible object storage manager built with Tauri v2 (Rust backend) and Next.js 16 (React frontend). It manages storage targets, sync profiles, and transfer queues with a local SQLite database — no external backend.

## Development Commands

```bash
npm install               # Install frontend dependencies
npm run tauri:dev         # Run full desktop app (Tauri + Next.js dev server)
npm run dev               # Run web-only frontend at localhost:3000 (no native commands)
npm run lint              # ESLint
npm run tauri:build       # Production desktop bundle
```

Rust changes require the Tauri dev server (`npm run tauri:dev`). The Rust backend is at `src-tauri/` and builds via Cargo automatically through the Tauri CLI.

There are no automated tests configured in this project.

## Architecture

**Two-layer design with a thin frontend and thick Rust backend:**

```
React UI → lib/tauri.ts (invokeSafe) → Rust #[tauri::command] → SQLite / AWS S3 SDK → Response
```

### Frontend (`src/`)
- Next.js 16 App Router with static export (`output: "export"`) — serves as Tauri's webview content
- `src/app/page.tsx` is the main entry point (~870 lines) managing UI state with useState/useCallback and direct Tauri calls
- All backend communication goes through `src/lib/tauri.ts` which wraps `@tauri-apps/api` invoke calls with `isTauriRuntime()` guard
- Types are centralized in `src/lib/types.ts` — mirrors Rust models with camelCase fields
- `src/lib/transfer-store.ts` is a custom store using `useSyncExternalStore` for in-memory transfer UI state (tracks active transfer progress, speed, ZIP metadata via Tauri event listeners — separate from the DB-backed transfer queue)
- Forms use react-hook-form + zod schemas (schema files in `src/components/forms/` and `src/components/sync/`)
- Data tables use `@tanstack/react-table` (`src/components/shared/data-table.tsx`)
- UI built with shadcn/ui (New York style) + Radix primitives + Tailwind v4
- Path alias: `@/*` maps to `./src/*`

#### Context Architecture
- `src/contexts/app-context.tsx` provides `AppProvider`/`useApp` — manages targets, buckets, navigation, and settings state
- `src/contexts/transfer-context.tsx` provides `TransferProvider`/`useTransfers` — manages transfer queue and sync operations
- `src/components/app-shell.tsx` wraps the UI with both providers
- These contexts are used by sidebar, header, content, transfer, sync, and command palette components

#### Component Organization
- `ui/` — shadcn/ui primitives (button, card, dialog, input, etc.)
- `sidebar/` — app-sidebar, target-item, target-list, sidebar-footer
- `header/` — app-header, breadcrumb-nav
- `content/` — buckets-view, objects-view, bucket-card, empty-state
- `forms/` — target-form-dialog, target-form-schema, confirm-dialog
- `sync/` — sync-profiles-list, sync-profile-card, sync-profile-form-dialog
- `transfers/` — transfer-panel, transfer-table, transfer-columns, transfer-status-badge
- `shared/` — data-table, data-table-pagination, data-table-column-header
- `command/` — command-palette

### Backend (`src-tauri/`)
- **Commands** (`src/commands/`): Tauri command handlers organized by domain — `targets.rs`, `objects.rs`, `files.rs`, `sync.rs`, `transfers.rs`, `settings.rs`. Decorated with `#[tauri::command]`.
- **Repositories** (`src/core/storage/repositories/`): Data access layer following repository pattern — each entity gets a `*_repo.rs` with `list`, `upsert`, `delete_many`. Repos: `targets_repo`, `credentials_repo`, `sync_profiles_repo`, `transfer_repo`, `bucket_stats_repo`, `settings_repo`.
- **Storage** (`src/core/storage/`): SQLite connection wrapper using `Mutex<Connection>` with WAL mode. Migrations run on startup via `migrations.rs`.
- **S3** (`src/core/s3/`): AWS SDK client builder supporting custom endpoints (R2, MinIO, DO Spaces) with force-path-style detection. Provides `list_buckets`, `list_objects_page`, `put_object`, `get_object`, `delete_objects`, `create_folder`, `presign`, `bucket_stats`.
- **Models** (`src/models.rs`): Rust structs (13+) with `#[serde(rename_all = "camelCase")]`.
- **State** (`src/app_state.rs`): `AppState` struct holding `Arc<SqliteStorage>`, passed to all commands via Tauri managed state.

### Key conventions
- Rust uses snake_case; frontend sees camelCase (via `#[serde(rename_all = "camelCase")]`)
- Timestamps are Unix epoch seconds (i64 in Rust, number in TypeScript)
- SQLite booleans stored as i64 (0/1), converted in queries
- JSON arrays stored as text columns (e.g., `pinned_buckets_json`), deserialized with serde_json
- Error handling: `anyhow::Result<T>` with `.map_err(|e| e.to_string())` in Rust, try/catch with Sonner toasts in React
- New commands must be registered in `src-tauri/src/lib.rs` invoke handler

## Tauri Command Surface

Commands follow the pattern `entity_action`. All commands registered in `src-tauri/src/lib.rs`:

**Targets:**
- `targets_list`, `targets_upsert`, `targets_delete`
- `target_credentials_get`, `target_credentials_upsert`
- `target_buckets_list`, `target_connection_test`

**Objects (S3 operations):**
- `target_objects_list`, `target_objects_list_page`, `target_objects_list_recursive`
- `target_object_upload`, `target_object_download`, `target_objects_download_zip`
- `target_objects_delete`, `target_object_presign`
- `target_folder_create`, `target_bucket_stats`

**Bucket Stats Cache:**
- `bucket_stats_cache_list`, `bucket_stats_cache_upsert`

**Files:**
- `list_directory_files` (local filesystem traversal for upload picker)

**Sync:**
- `sync_profiles_list`, `sync_profiles_upsert`, `sync_profiles_delete`

**Transfers:**
- `transfer_queue_list`, `transfer_queue_upsert`, `transfer_queue_delete`, `transfer_queue_clear_terminal`

**Settings:**
- `settings_get`, `settings_upsert`

When adding a new command: define the handler in `commands/`, add the TypeScript wrapper in `lib/tauri.ts`, and register it in `lib.rs`.

## Styling

- Tailwind v4 with OKLCH color variables defined in `globals.css`
- shadcn/ui components live in `src/components/ui/` — add new ones via `npx shadcn@latest add <component>`
- Custom fonts: Inter (sans), JetBrains Mono (mono) via `next/font/google`
- Light/dark themes via CSS variables and `next-themes`

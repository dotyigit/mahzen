# Mahzen -> Tauri Rewrite Draft (macOS, No Custom Backend)

## 1) What the current Swift app is doing

This is the behavior to preserve.

### App shell
- Main window + menu bar panel run from the same process.
- On first launch, app is regular (`Dock` visible); when main window closes, app switches to accessory mode (menu bar only).
- Duplicate app instances are prevented on launch.

### Targets and credentials
- Supports multiple S3-compatible targets (`AWS`, `R2`, `DO Spaces`, `Hetzner`, `MinIO`, `Other`).
- Target config is persisted in SQLite (no JSON stores).
- Credentials are stored in macOS Keychain (debug fallback file exists in current Swift app).
- Each target has: endpoint, region (optional), force-path-style, optional default bucket, pinned buckets.

### Browser UX
- Three-column feel: bucket/sidebar + object list + inspector/details.
- Bucket listing merges server buckets with pinned/default buckets (fallback even when list fails).
- Object listing uses paginated `ListObjectsV2` (1000 keys/page), folder-prefix navigation, search filtering.
- Bucket/prefix metrics are computed in background.

### Object operations
- Upload file(s), upload directory recursively.
- Download object(s), prefix, or full bucket.
- Delete objects (chunked bulk delete).
- Copy/move/rename (same-target server-side copy; cross-target copy via download+reupload).
- Presigned URL generation for GET/PUT.
- Object metadata/tag/storage-class editing.

### Transfer system
- Central transfer queue with max concurrency = 4.
- Pause/resume/cancel, retry for retryable failures, aggregate progress.
- Queue is persisted and restored across app restarts.

### Sync system (two-way backup style)
- Sync profiles: local folder <-> bucket/prefix.
- Dry-run and real run.
- Planner compares local + remote + previous snapshot to produce actions:
  - upload / download / conflict-local-wins / conflict-remote-wins / skipped / delete-detected.
- Executor runs executable actions in parallel batches (4).
- Snapshot and run history are persisted.
- Scheduler checks every minute and runs due profiles.

### Menu bar and drop behavior
- Menu bar panel has independent target/bucket selection from main window.
- Bucket rows accept drag/drop for instant upload.
- Menu bar panel shows compact transfer progress and controls.
- "Open" button syncs selected tray target/bucket back into main window context.
- Floating global drop panel appears during desktop file drag; dropping uploads to currently selected tray bucket.

---

## 2) Tauri rewrite target architecture

### Key decision
- No custom remote backend.
- App talks directly to S3-compatible providers using user credentials.
- Keep all critical logic in Rust (not webview timers) for reliability when UI is hidden.

### Process model (recommended v1)
- Single Tauri process.
- Rust core manages:
  - S3 operations
  - transfer queue workers
  - sync planner/executor/scheduler
  - persistence
- Frontend is `Next.js` + `shadcn/ui` and stays UI-only.

Optional v2:
- Move workers into a sidecar daemon if you later need stronger isolation or independent lifetime.

### Frontend stack
- Use Tauri + Next.js integration flow: [Tauri Next.js guide](https://tauri.app/start/frontend/nextjs/).
- Use Next.js App Router for view composition.
- Use `shadcn/ui` for primitives and consistent desktop-grade component styling.
- Keep all S3, transfer, sync, and persistence logic in Rust commands/events.

---

## 3) Proposed module layout

```text
src-tauri/
  src/
    main.rs
    app_state.rs
    commands/
      targets.rs
      buckets.rs
      objects.rs
      transfers.rs
      sync.rs
      presign.rs
      metrics.rs
    core/
      s3/
        client.rs
        sigv4.rs
        xml_parsers.rs
      storage/
        paths.rs
        sqlite.rs
        migrations.rs
        repositories/
          targets_repo.rs
          transfer_repo.rs
          sync_profiles_repo.rs
          sync_state_repo.rs
          app_prefs_repo.rs
      credentials/
        keychain.rs
      transfer/
        manager.rs
        model.rs
      sync/
        planner.rs
        executor.rs
        scheduler.rs
        model.rs
      ops/
        object_ops.rs
        object_properties.rs
      metrics/
        metrics_computer.rs
```

Frontend (Next.js + shadcn):

```text
src/
  app/
    page.tsx
    layout.tsx
  components/
    main-window.tsx
    tray-panel.tsx
    sync-profiles.tsx
    ui/              // shadcn generated components
  state/
    mainStore.ts
    trayStore.ts   // independent tray state (important)
  api/
    tauri.ts
```

---

## 4) Window + tray behavior spec

### Main window
- Full object manager UI (targets, buckets, browser, inspector, sync profiles).

### Tray panel window
- Small undecorated window (~320px width) opened from tray icon.
- Contains:
  - target selector (tray-local)
  - bucket list (tray-local)
  - drag/drop upload on bucket rows
  - transfer compact status + controls
  - open-main button + quit button

### State separation rule
- `mainStore.selectedTargetId/selectedBucket` and `trayStore.selectedTargetId/selectedBucket` are separate.
- Only when user clicks `Open` in tray: propagate tray selection -> main selection.

### Dock visibility behavior (macOS)
- Start regular app mode on first launch.
- If last main window closes, switch to accessory policy so app remains tray/menu-bar style.
- Revert to regular policy when opening main window again.

---

## 5) Command and event contract (draft)

### Tauri commands (Rust)
- `targets_list()`
- `targets_upsert(payload)`
- `targets_delete(ids)`
- `credentials_save(target_id, creds)`
- `credentials_load(target_id)`
- `buckets_list(target_id)`
- `objects_list_page(target_id, bucket, prefix, continuation_token, max_keys, delimiter)`
- `objects_delete(target_id, bucket, keys[])`
- `objects_copy_or_move(payload)`
- `object_properties_get(target_id, bucket, key)`
- `object_properties_patch(payload)`
- `presign_create(target_id, bucket, key, method, expires_seconds, content_type)`
- `transfer_upload_files(target_id, bucket, prefix, paths[])`
- `transfer_upload_directory(target_id, bucket, prefix, dir_path)`
- `transfer_download_objects(target_id, bucket, keys[], destination_dir)`
- `transfer_pause(id)`
- `transfer_resume(id)`
- `transfer_cancel(id)`
- `transfer_clear_completed()`
- `transfer_clear_finished()`
- `transfer_list()`
- `sync_profiles_list()`
- `sync_profiles_upsert(payload)`
- `sync_profiles_delete(ids)`
- `sync_run(profile_id, dry_run)`
- `sync_history_list(profile_id)`
- `metrics_compute_bucket(target_id, bucket)`
- `metrics_compute_prefix(target_id, bucket, prefix)`

### Events emitted to frontend
- `transfer://updated` (queue snapshot + aggregate progress)
- `sync://progress` (stage, counts, current path, percent)
- `sync://status` (summary/failure text)
- `metrics://updated`
- `app://error`

---

## 6) Persistence schema (SQLite only)

Use Tauri app data dir (macOS):
- `mahzen.sqlite`

Core tables:
- `targets`
- `transfer_queue`
- `sync_profiles`
- `sync_snapshot`
- `sync_run_history`
- `app_preferences` (window/tray local settings)

Credentials:
- macOS Keychain service name similar to current app (stable key naming by target id).

Why SQLite-only:
- Faster reads/writes and filtering than scattered JSON files.
- Atomic updates for queue/sync/profile consistency.
- Simpler schema migrations as features grow.

---

## 7) Sync logic to keep (same rules)

### Planner
Inputs:
- local file map (relative path -> mtime,size,url)
- remote object map (relative path -> key,mtime,size)
- previous snapshot map

Action rules:
- local+remote both unchanged -> `skipped`
- both changed -> conflict resolve by mtime (`newest wins`)
- only local exists:
  - existed in snapshot -> `remoteDeleteDetected` (no delete propagation)
  - otherwise `upload`
- only remote exists:
  - existed in snapshot -> `localDeleteDetected` (no delete propagation)
  - otherwise `download`

### Executor
- Execute only upload/download/conflict-resolved actions.
- Batch parallelism = 4.
- Report per-action result + progress updates.
- Save new snapshot after successful run completion.

### Scheduler
- Tick every 60s.
- Run profiles where `enabled && next_run_at <= now && not already_running`.

---

## 8) Menu bar + global drop zone logic (like current app)

### Tray upload flow
1. User opens tray window.
2. Selects tray target and tray bucket.
3. Drops files/folders on bucket row.
4. Rust `transfer_manager` enqueues uploads.
5. Tray and main window both get `transfer://updated` events.

### Global drop zone flow (optional but matching current behavior)
1. Native macOS monitor detects file drag started.
2. Show small floating drop window near tray area.
3. If no tray bucket selected -> show empty state text.
4. On drop -> enqueue upload to tray target/bucket.
5. Auto-hide after drag ends.

Implementation note:
- This part may require a tiny macOS-specific Rust plugin/bridge for global drag monitoring and panel positioning.

---

## 9) Suggested implementation phases

### Phase 0: Scaffold
- Create Tauri project.
- Add Rust core modules and shared models.
- Add app data path + SQLite schema + migrations.

### Phase 1: Core S3 manager
- Targets + credentials + list buckets + list objects page.
- Build basic main UI (targets, buckets, objects).

### Phase 2: Transfer queue
- Upload/download + queue + progress events + pause/resume/cancel.
- Persist/restore transfer queue.

### Phase 3: Tray panel
- Tray icon + tray window.
- Independent tray state + drag/drop upload + compact transfer panel.
- Open-main handoff logic.

### Phase 4: Sync profiles
- Profile CRUD.
- Planner/executor/scheduler.
- Dry-run, run history, snapshot persistence.

### Phase 5: Global drop zone
- Native drag monitor bridge.
- Floating drop window upload integration.

### Phase 6: Packaging
- `.app` + `.dmg` distribution.
- Sign/notarize if needed for clean Gatekeeper UX.

---

## 10) First concrete tasks to start coding now

1. Scaffold `src-tauri/src/core/storage` with a SQLite connection layer and migration runner.
2. Create `mahzen.sqlite` migrations and repositories (`targets`, `transfer_queue`, `sync_profiles`, `sync_snapshot`, `sync_run_history`).
3. Port `StorageTarget`, `S3Credentials`, `S3Bucket`, `S3Object`, `SyncProfile`, `TransferItem` models to Rust.
4. Implement `targets_list`, `targets_upsert`, `targets_delete`, `credentials_save/load`.
5. Implement `buckets_list` and `objects_list_page`.
6. Scaffold Next.js (App Router) frontend and install shadcn/ui baseline components.
7. Build minimal main UI with target picker, bucket list, and paginated objects table.
8. Add tray icon + tray window with independent state (no transfer yet).
9. Add transfer manager and `transfer://updated` event stream.

This sequence gets you to a usable Tauri baseline quickly while preserving your current app architecture.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mahzen is a macOS native SwiftUI app for browsing, uploading, and downloading files to S3-compatible object storage (AWS S3, Cloudflare R2, DigitalOcean Spaces, Hetzner, MinIO, etc.).

## Build

This is an Xcode project with no external dependencies (uses only Foundation, SwiftUI, CryptoKit). Build and run via Xcode or:

```bash
xcodebuild -scheme "Mahzen" -configuration Debug build
```

There are no tests currently configured.

## Architecture

**Pattern:** MVVM with SwiftUI's reactive observer pattern.

**Key layers:**

- **App/** — Core state management. `AppModel` is the central state container (`@ObservableObject`) holding all shared app state (selected target, buckets, objects, metrics, etc.). `TransferManager` orchestrates concurrent upload/download queues (max 4 concurrent).
- **Models/** — Data structures: `StorageTarget` (S3 endpoint config + provider enum), `S3Bucket`/`S3Object`/`S3BrowserEntry` (domain objects), `TransferItem` (queue item with status tracking).
- **S3/** — S3 protocol implementation. `S3Client` handles REST API calls. `AWSSigV4Signer` implements AWS Signature V4 request signing. `S3TransferSession` wraps URLSession with byte-level progress callbacks via delegates. `S3MetricsComputer` is a Swift actor for off-main-thread bucket/prefix size calculation.
- **Storage/** — Persistence layer. `TargetsStore` saves targets as JSON to `~/Library/Application Support/Mahzen/targets.json`. `CredentialsStore` coordinates between `KeychainStore` (primary) and `FileCredentialsStore` (DEBUG fallback).
- **UI/** — SwiftUI views. `AppTheme` defines design tokens (warm orange accent, material effects, 12-14px corner radius).
- **Utilities/** — `ContentTypeResolver` for MIME detection, `Pasteboard` for macOS clipboard.

## Dual-Window System

The app has two independent UI surfaces:
1. **Main window** — Three-column `NavigationSplitView` (buckets sidebar, file browser, inspector)
2. **Menu bar extra** — Quick-access panel with its own independent target/bucket selection state

`AppDelegate` prevents duplicate instances and switches to `.accessory` activation policy when the main window closes.

## Concurrency Model

- `@MainActor` on `AppModel`, `TransferManager`, `TargetsStore`
- `S3MetricsComputer` is a Swift `actor` for background computation
- `S3TransferSession` uses `NSLock` for thread-safe nonisolated(unsafe) state
- `CheckedContinuation` bridges URLSession delegates to async/await
- Transfer progress updates are throttled to 100ms minimum intervals

## Credential Storage Flow

```
Save: Keychain → (fail in DEBUG) → File fallback
Load: Keychain → (fail in DEBUG) → File → attempt migrate back to Keychain
Delete: Both Keychain and File
```

## Entitlements

App sandbox enabled with network client access and user-selected file read-write access. A separate `.local.entitlements` file exists for ad-hoc signing during development.

## Conventions

- `Is*` prefix for booleans (`isLoadingBuckets`, `isTransferring`)
- `ensure*` for idempotent operations that may no-op
- `@Published` for model properties, `@State` for local view state
- `.task(id:)` and `.onChange()` for reactive async work in views
- All custom errors conform to `LocalizedError`
- Dependency injection on init for `AppModel`, `TargetsStore`, `CredentialsStore` (supports testing)

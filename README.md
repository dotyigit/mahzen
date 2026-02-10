<p align="center">
  <img src="Mahzen/Assets.xcassets/AppIcon.appiconset/icon_256x256.png" width="128" height="128" alt="Mahzen icon">
</p>

<h1 align="center">Mahzen</h1>

<p align="center">
  A free, open-source macOS app for managing S3-compatible object storage.<br>
  Browse, upload, and download files with a native SwiftUI interface.
</p>

<p align="center">
  <a href="https://github.com/dotyigit/mahzen/releases/latest"><img src="https://img.shields.io/github/v/release/dotyigit/mahzen?label=Download&color=E88F2E" alt="Latest Release"></a>
  <a href="https://github.com/dotyigit/mahzen/blob/main/LICENSE"><img src="https://img.shields.io/github/license/dotyigit/mahzen" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-macOS%2015%2B-blue" alt="Platform">
  <img src="https://img.shields.io/badge/swift-5-orange" alt="Swift">
</p>

---

## About

Mahzen is a native macOS application for working with S3-compatible object storage services. It provides a familiar three-column file browser interface for managing your buckets and objects, with support for concurrent transfers, a menu bar quick-access panel, and secure credential storage through the macOS Keychain.

The name "Mahzen" comes from the Turkish word for "cellar" or "vault" — a place to store things.

**Mahzen is and will always be free and open source. There is no paid version.**

## Features

- **Native macOS experience** — Built entirely with SwiftUI. No Electron, no web views.
- **Multi-provider support** — Works with AWS S3, Cloudflare R2, DigitalOcean Spaces, Hetzner Object Storage, MinIO, and any S3-compatible service.
- **Three-column browser** — Sidebar for buckets, file browser with folder navigation, and a detail inspector panel.
- **Upload files and folders** — Drag and drop or use the file picker. Uploads entire directory structures recursively.
- **Download anything** — Download individual files, folders, or entire bucket prefixes with preserved directory structure.
- **Concurrent transfers** — Up to 4 simultaneous uploads/downloads with real-time progress tracking.
- **Menu bar quick access** — A menu bar panel with independent target/bucket selection for quick drag-and-drop uploads without opening the main window.
- **Global drop zone** — Drag files anywhere on your Mac and a floating drop panel appears for instant uploads.
- **Bucket analytics** — View total size, object count, and per-prefix metrics computed in the background.
- **Search and filter** — Quickly find objects within buckets.
- **Pin buckets** — Pin frequently used buckets for quick access.
- **Multiple targets** — Manage connections to multiple storage providers simultaneously.
- **Secure credentials** — Access keys are stored in the macOS Keychain. Supports session tokens for temporary credentials.
- **Auto-updates** — Built-in update mechanism via Sparkle.
- **Sandboxed** — Runs in the macOS App Sandbox with only network and user-selected file access.

## Supported Providers

| Provider | Status |
|----------|--------|
| AWS S3 | Supported |
| Cloudflare R2 | Supported |
| DigitalOcean Spaces | Supported |
| Hetzner Object Storage | Supported |
| MinIO | Supported |
| Other S3-compatible | Supported |

Any service that implements the S3 REST API should work. Use the "Other (S3-Compatible)" option when adding a target for unlisted providers.

## Installation

### Homebrew (Recommended)

```bash
brew install dotyigit/tap/mahzen
```

### Manual Download

Download the latest `.dmg` from the [Releases](https://github.com/dotyigit/mahzen/releases/latest) page, open it, and drag Mahzen to your Applications folder.

### Build from Source

**Requirements:**
- macOS 15.0 (Sequoia) or later
- Xcode 16+

```bash
git clone https://github.com/dotyigit/mahzen.git
cd mahzen
xcodebuild -scheme "Mahzen" -configuration Debug build
```

Or open `Mahzen.xcodeproj` in Xcode and build with **Cmd+B**.

## Getting Started

1. **Launch Mahzen** and click the **+** button to add a storage target.
2. **Enter your credentials** — endpoint URL, access key, and secret key. Mahzen auto-detects regions for known providers.
3. **Browse your buckets** in the sidebar and click one to open the file browser.
4. **Upload** by dragging files into the browser or using the upload button.
5. **Download** by selecting objects and clicking download, or right-clicking for options.

For quick access, use the **menu bar icon** to upload and download without opening the main window.

## Architecture

Mahzen follows the **MVVM pattern** with SwiftUI's reactive observer system:

```
App/          Core state — AppModel (central state), TransferManager (transfer queue)
Models/       Data structures — StorageTarget, S3Bucket, S3Object, TransferItem
S3/           Protocol layer — S3Client (REST API), AWSSigV4Signer, S3TransferSession
Storage/      Persistence — TargetsStore (JSON), CredentialsStore (Keychain + fallback)
UI/           SwiftUI views — Browser, Inspector, Sidebar, Menu Bar, Transfer Panel
Utilities/    Helpers — ContentTypeResolver, Pasteboard
```

**No external dependencies** except [Sparkle](https://github.com/sparkle-project/Sparkle) for auto-updates. All S3 operations, AWS Signature V4 signing, and XML parsing are implemented from scratch using only Foundation and CryptoKit.

## Security

- **Keychain storage** — Credentials are stored in the macOS Keychain, encrypted by the OS.
- **App Sandbox** — The app runs in a sandbox with only network client access and user-selected file read/write.
- **AWS SigV4** — All S3 requests are signed with HMAC-SHA256 using CryptoKit. Payloads are SHA256-hashed.
- **No telemetry** — Mahzen does not collect any usage data or analytics.
- **Code-signed and notarized** — Release builds are signed with a Developer ID certificate and notarized by Apple.

## Contributing

Contributions are welcome! Whether it's bug reports, feature requests, or pull requests — all help is appreciated.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please keep the existing code style and conventions described in `CLAUDE.md`.

## License

This project is open source. See the [LICENSE](LICENSE) file for details.

## Links

- **Website:** [mahzen.dev](https://mahzen.dev)
- **Releases:** [github.com/dotyigit/mahzen/releases](https://github.com/dotyigit/mahzen/releases)
- **Issues:** [github.com/dotyigit/mahzen/issues](https://github.com/dotyigit/mahzen/issues)

#!/usr/bin/env bash
set -euo pipefail

# Bump version across all project files, commit, and tag.
# Usage:
#   ./scripts/bump-version.sh <version>
#   ./scripts/bump-version.sh 2.1.0

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${1:-}" ]; then
  CURRENT=$(jq -r '.version' "$ROOT_DIR/package.json")
  echo "Current version: $CURRENT"
  echo "Usage: $0 <new-version>"
  echo "Example: $0 2.1.0"
  exit 1
fi

NEW_VERSION="$1"

# Validate semver format
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in semver format (e.g. 2.1.0)"
  exit 1
fi

CURRENT=$(jq -r '.version' "$ROOT_DIR/package.json")
echo "Bumping version: $CURRENT → $NEW_VERSION"

# 1. package.json
jq --arg v "$NEW_VERSION" '.version = $v' "$ROOT_DIR/package.json" > "$ROOT_DIR/package.json.tmp"
mv "$ROOT_DIR/package.json.tmp" "$ROOT_DIR/package.json"

# 2. src-tauri/tauri.conf.json
jq --arg v "$NEW_VERSION" '.version = $v' "$ROOT_DIR/src-tauri/tauri.conf.json" > "$ROOT_DIR/src-tauri/tauri.conf.json.tmp"
mv "$ROOT_DIR/src-tauri/tauri.conf.json.tmp" "$ROOT_DIR/src-tauri/tauri.conf.json"

# 3. src-tauri/Cargo.toml (sed — no toml parser needed)
sed -i.bak -E "0,/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/s//version = \"$NEW_VERSION\"/" "$ROOT_DIR/src-tauri/Cargo.toml"
rm -f "$ROOT_DIR/src-tauri/Cargo.toml.bak"

echo "Updated:"
echo "  package.json          → $NEW_VERSION"
echo "  src-tauri/tauri.conf.json → $NEW_VERSION"
echo "  src-tauri/Cargo.toml      → $NEW_VERSION"

# 4. Commit and tag
cd "$ROOT_DIR"
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"

echo ""
echo "Committed and tagged v$NEW_VERSION"
echo "Run 'git push && git push origin v$NEW_VERSION' to trigger the release."

#!/usr/bin/env bash
# Builds an APK from the current working tree (uncommitted changes included) and copies it to release/.
# Unlike `pnpm release`, it doesn't need a clean tree and never publishes. Runs from any directory.
#   pnpm apk              debug APK   -> release/bliskfit-<version>-<commit>-debug.apk
#   pnpm apk --release    signed APK  -> release/bliskfit-<version>-<commit>-release.apk
set -euo pipefail
cd "$(dirname "$0")/.."

variant=debug
while [[ $# -gt 0 ]]; do
  case "$1" in
    --release) variant=release; shift ;;
    --debug) variant=debug; shift ;;
    --) shift ;; # pnpm passes its separator through
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

version=$(node -p "require('./package.json').version")
commit=$(git rev-parse --short HEAD)
[[ -n "$(git status --porcelain)" ]] && commit="${commit}-dirty"
apk="release/bliskfit-${version}-${commit}-${variant}.apk"

if [[ $variant == release ]]; then
  bash scripts/android.sh assembleRelease
else
  bash scripts/android.sh assembleDebug
fi
mkdir -p release
cp "android/app/build/outputs/apk/${variant}/app-${variant}.apk" "$apk"

echo "Built $(pwd)/$apk"

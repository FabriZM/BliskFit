#!/usr/bin/env bash
# Builds the signed release APK and publishes it as a GitHub Release, which the app's update check and Obtainium
# pick up. Tag: v<package.json version>-<build>, where build = git commit count = Android versionCode.
#   pnpm release                      build, then publish with the GitHub CLI (gh) if it's installed
#   pnpm release -- --notes "Fixes"   release notes shown in the app's update prompt
#   pnpm release -- --build-only      build and name the APK, don't publish
set -euo pipefail
cd "$(dirname "$0")/.."

notes=""
publish=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --notes) notes="$2"; shift 2 ;;
    --build-only) publish=0; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# The build number comes from the commit count, so the APK must match a commit that's on GitHub.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or stash your changes first: the build number must match a commit." >&2
  exit 1
fi
if [[ $publish == 1 ]]; then
  git fetch -q origin main
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
    echo "HEAD isn't the same as origin/main. Push first (the release tag points at that commit)." >&2
    exit 1
  fi
fi

version=$(node -p "require('./package.json').version")
build=$(git rev-list --count HEAD)
tag="v${version}-${build}"
apk="release/bliskfit-${version}-${build}.apk"

bash scripts/android.sh assembleRelease
mkdir -p release
cp android/app/build/outputs/apk/release/app-release.apk "$apk"

# Refuse to ship an unsigned or wrongly signed APK: installed copies could never update to it.
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
apksigner=$(ls -d "$ANDROID_HOME"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1 || true)
if [[ -n "$apksigner" ]]; then
  "$apksigner" verify --print-certs "$apk" | grep -m1 "certificate SHA-256 digest"
else
  echo "apksigner not found; signature not checked." >&2
fi
shasum -a 256 "$apk"

if [[ $publish == 0 ]]; then
  echo "Built $apk ($tag). Not published."
  exit 0
fi
if command -v gh >/dev/null; then
  gh release create "$tag" "$apk" --repo FabriZM/BliskFit --target "$(git rev-parse HEAD)" \
    --title "BliskFit ${version} (build ${build})" --notes "${notes:-BliskFit ${version}, build ${build}.}"
  echo "Published $tag."
else
  cat <<MSG
Built $apk. The GitHub CLI (gh) isn't installed, so publish it by hand:
  1. https://github.com/FabriZM/BliskFit/releases/new
  2. Tag: $tag (target: main), title: BliskFit ${version} (build ${build})
  3. Attach $apk, add notes, publish (not as a pre-release).
MSG
fi

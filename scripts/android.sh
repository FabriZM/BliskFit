#!/usr/bin/env bash
# Builds the web bundle for the Android app and runs a Gradle task.
#   bash scripts/android.sh sync            copy the web build into the Android project
#   bash scripts/android.sh assembleDebug   debug APK  -> android/app/build/outputs/apk/debug/app-debug.apk
#   bash scripts/android.sh assembleRelease signed APK -> android/app/build/outputs/apk/release/app-release.apk
#   bash scripts/android.sh install         build debug and install on the connected phone/emulator
set -euo pipefail
cd "$(dirname "$0")/.."

# Capacitor 8 needs JDK 21, whatever the shell's JAVA_HOME says (it may point at an older JDK for other projects).
# BLISKFIT_JAVA_HOME overrides it.
export JAVA_HOME="${BLISKFIT_JAVA_HOME:-$(/usr/libexec/java_home -v 21)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

task="${1:-assembleDebug}"

if [[ "$task" == "assembleRelease" ]]; then
  props="${BLISKFIT_KEYSTORE_PROPERTIES:-$HOME/.bliskfit-signing/keystore.properties}"
  if [[ ! -f "$props" ]]; then
    echo "No signing key at $props: the release APK would be unsigned and not installable." >&2
    exit 1
  fi
fi

# The Android app serves from the root of its own origin and bundles its assets (no service worker).
VITE_NATIVE=1 VITE_BASE=/ pnpm build
pnpm exec cap sync android

# Capacitor 8 needs JDK 21. A machine-wide org.gradle.java.home in ~/.gradle/gradle.properties would override
# JAVA_HOME, so pass it explicitly for this project only.
GRADLE=(./gradlew -Dorg.gradle.java.home="$JAVA_HOME")

cd android
case "$task" in
  sync) ;;
  install) "${GRADLE[@]}" installDebug ;;
  *) "${GRADLE[@]}" "$task" ;;
esac

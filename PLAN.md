# Gym App Plan

Personal gym tracker for Android. Built web-first as an offline PWA (installable from Chrome, shareable through a free static host), then wrapped as an APK with Capacitor once the live workout needs reliable timers/notifications. Same codebase for both. Data stays local on each device, with optional cloud backup.

## Stack
React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa, Recharts or uPlot, Zustand, Vitest, Capacitor (from M3b). Mobile-first, three bottom tabs (no Home), in this order: **Profile · Workout · Exercises**. The app opens on Profile.
- **Profile** (default screen): at the top, the week card (this week's training days against the goal, and the weekly streak); then Stats (charts, muscle volume, PRs) and body weight and measurements. Settings (goal, week start, language, units, rest popup, backup, gyms) open from a gear icon at the top right.
- **Workout:** today's suggested workout with Start (or Resume if a session is running), then routines (incl. programs). **History** (sessions, calendar, recent PRs) opens from an icon at the top right.
- **Exercises:** library, search by muscle and equipment, favorites, add exercise; later the interactive body figure.
An active session is a full-screen view; a persistent "workout in progress" bar sits above the tab bar on every screen. UI available in English and Spanish; kg/lb switchable.

## Tooling and supply chain security
- **Package manager: pnpm (done).** Migrated from npm: `pnpm-lock.yaml` is committed, `package-lock.json` is gone, `packageManager` pins pnpm 11.8.0, and the Pages workflow installs with `pnpm install --frozen-lockfile`. Dependency versions are exact pins. `workbox-window` is now an explicit dev dependency (pnpm's strict `node_modules` no longer lets `vite-plugin-pwa` find it by accident).
- **Install scripts blocked:** `ignoreScripts: true` in `pnpm-workspace.yaml`. Nothing needs a script today (`sharp` ships prebuilt binaries, `esbuild` isn't in the tree). If a package ever needs one, allowlist it explicitly after reviewing it.
- **Minimum release age: 3 days** (`minimumReleaseAge: 4320`, strict) in `pnpm-workspace.yaml`. It caught three of our own pins (`vite`, `i18next`, `@types/node`, each under 3 days old) and they were moved back one patch release. To move forward, wait for a release to age past 3 days, then bump deliberately after reading the changelog.
- Install with `--frozen-lockfile` in CI; run `pnpm audit` occasionally (clean at migration time).
- Keep the dependency list short and well known. Prefer a few lines of code over tiny single-purpose packages. Consider moving `sharp` out of the app's dependency tree if only the icon script needs it.
- GitHub Actions are referenced by major tag (`@v4`); pin them to commit SHAs if we want the strictest supply-chain posture.
- Never commit the APK signing key, keystore passwords or tokens; back up the key offline.

## Architecture decision
Stay with web + Capacitor rather than full native Kotlin: one codebase gives the shareable PWA and the APK, faster iteration, easy SVG/charts, and web-bundle updates. Business logic and the data model stay UI-independent so a native rewrite remains possible. Revisit only if a home-screen widget or Health Connect sync becomes important (native-only strengths).

## Data model
| Entity | Key fields |
|---|---|
| MuscleGroup | id, name, parent (e.g. Calves > Gastrocnemius, Soleus) |
| Exercise | name, tracking type (see below), equipment, primary muscles, secondary muscles, photo, demo image/animation URL, user video link, default rest, learned rest, source (seeded/custom) |
| ExerciseGymNote | exercise, gym (optional), setup note (seat height, pin, grip width), photo |
| Gym | id, name (optional feature; app works fully without any gym) |
| Routine | name, ordered RoutineExercise (target sets, rep range, rest override, superset group), archived |
| Program | name, weeks, schedule (routine per weekday) or rotation (A/B/C cycle) |
| WorkoutSession | start, end, routine ref, optional gym ref, notes, status (active/paused/finished), paused intervals |
| SetLog | session, exercise, weight, added/assist weight, reps, duration, distance, RPE, reps in reserve, failure flag, done time, set type (warm-up/working/drop) |
| ExerciseNote | exercise, text, pinned for next time |
| BodyWeight | date, weight |
| Measurement | date, type (chest, waist, biceps L/R, ... or custom), value |
| Settings | weekly goal, week start day, units, language, default rest, PR badge toggle, reminder days, streak freezes |

**Exercise tracking types** (decided in M0 schema, hard to retrofit):
- weight x reps (standard)
- bodyweight x reps
- bodyweight + added weight (weighted pull-ups)
- assisted bodyweight (assisted dips, weight subtracts)
- duration (planks)
- cardio (duration, distance, pace)

Muscle credit for stats comes from exercise-to-muscle links (primary full, secondary partial), never from the exercise name. IDs are UUIDs to allow future sync/sharing.

## Decisions
- PRs are auto-detected (weight, reps at weight, estimated 1RM via Epley, volume) and shown as a highlighted "PR" badge only. No animation. Recomputed from history so edits never leave stale flags.
- Interactive body figure is the last milestone; until then muscles are picked via chips/lists.
- Timers store timestamps and compute elapsed time (survive phone sleep). Paused time is excluded from session duration and from the 2-hour reminder.
- Business logic (PRs, streaks, 1RM, muscle volume, rest learning, overload hints) lives in pure, unit-tested functions.
- Active session is persisted after every change (crash safety).
- Export/import works from early on; request persistent storage.

## Milestones

### M0: Setup
Scaffold, PWA manifest/icons/service worker, tab shell, i18n setup (en/es), Dexie schema v1 including tracking types, gyms and pause intervals, with migrations. Settings store.
Done when: installs on Android from a dev URL and tabs navigate.

### M1: Exercise library
**Status: done.** Dataset: free-exercise-db (Unlicense, 876 exercises, demo images served from jsDelivr and cached by the service worker). Seeded muscles/exercises use stable ids (`m:<slug>`, `x:<id>`); custom ones use UUIDs. Schema v2 added a `meta` table (seed version). Seeded exercises are read-only; setup notes work on all.

Seed muscle hierarchy and exercises from an open dataset (check license first, e.g. free-exercise-db or wger). List/search/filter by muscle and equipment. Add/edit/delete custom exercises with tracking type, muscle selector and photo upload (compressed). Detail page with image/demo and optional own video link. Per-exercise machine/setup notes with photo (e.g. seat height); an optional gym tag on notes, managed from a hidden-away settings screen.
Done when: "Calf raise (seated machine X)" can be created with a photo, tagged to Calves and found by muscle, with seat-height notes.

### M2: Routines and programs
**Status: done (drag-and-drop not yet tried on a real touch device).** Superset members are contiguous and share one rest value (last one set in the group). Program weekday schedules are aligned to the configured week start; the active program id lives in `meta`. Rotation position is inferred from the last finished session, so each routine can appear once per rotation. The "Today's workout" card is on the Workout tab.

Unlimited routines: create, rename, duplicate, archive. Add exercises, drag to reorder, set sets/rep range/rest, group into supersets/circuits with a shared rest timer. Programs: multi-week schedules per weekday, or A/B/C rotation that suggests the next routine regardless of calendar day. "Today's workout" suggestion.
Done when: a full push/pull/legs split can be built and scheduled.

### M3: Live workout
**Status: built and checked in a desktop browser; needs a real gym session on the phone.** Notes: sets belong to a session exercise (`itemId`), so one exercise can appear twice. Weights are stored in kg and converted for display. The finish summary shows duration, sets, volume and exercises; the PR count joins it in M4 with PR detection. The forgotten-session prompt appears when the app is opened or visible; a closed PWA cannot fire the 2h notification, so true background reminders and rest-end alerts with the screen locked are M3b. Rest and learned rest: a set's rest is the routine override, else the exercise's learned rest (blended with each finished session's typical gap), else the exercise default, else the global default.

- Start from routine or empty, persistent session timer. Gym selection is optional and tucked away (e.g. in the session's overflow menu or defaulting to the last used gym); never required to start.
- Set logging adapted to tracking type: weight, reps, RPE, reps in reserve / failure flag, set type, done.
- Quick-repeat: one tap copies the previous set.
- Last-time hint: when starting a session (and when reaching each exercise), show last time's sets for that exercise (weight x reps; matches the session's gym only if one was set) with a one-tap "Use last weights" that fills every set; also available per exercise and per set. Hint is suggested, never applied silently. If a gym is set but has no history for the exercise, falls back to the most recent session in any gym.
- Per-exercise rest timer (vibration, sound, +/-15s), learned typical rest suggested per exercise.
- Pinned exercise notes and setup notes shown in the exercise view.
- Add/swap/skip/reorder mid-session; swap offers "this session", "this routine only" or "all future sessions".
- Pause and resume session; paused time is excluded from duration and the reminder.
- Live per-muscle set counter ("Chest: 12 sets so far").
- Wake Lock.
- Forgotten-session detection: 2h since start or since last done set (excluding pauses); prompt + service-worker notification; finish with end time = last set, or keep going.
- Finish summary: duration, volume, sets, PRs.
Done when: a real gym session works end to end.

### M3b: Android wrapper (APK)
**Status: built and verified on the Pixel 8 emulator (Android 17), not yet on a physical phone.** With the screen off, the rest-over notification fired and showed as "Go! Time for your next set." (checked in `dumpsys notification` and the shade). The 2-hour forgotten-workout alarm is registered with Android as an exact wake-up alarm 2h out (confirmed in `dumpsys alarm`); I could not advance the emulator clock to watch it fire. Notes:
- **Layout:** `capacitor.config.json` (JSON, because TypeScript 7 no longer exposes the compiler API Capacitor uses to read `.ts` config), app id `com.fabrizm.bliskfit`, Capacitor 8 with local-notifications, haptics and keep-awake. The `android/` project is committed (without build output or `local.properties`).
- **`lib/platform`:** one interface with a web implementation (Vibration, Wake Lock, service-worker notifications) and a native one (plugins loaded lazily, so the PWA never loads them). `TimerNotifications` is always mounted and owns the rest-over (id 1001) and 2h-forgotten (id 1002) notifications; when the OS notification is guaranteed, the in-app beep/vibration is skipped to avoid doubling up.
- **Foreground service:** not needed. Scheduled alarms fire without it, so rest timers survive screen lock without a persistent notification.
- **Exact alarms:** Android 14+ denies them by default and the plugin would otherwise throw the user into system settings on every schedule call. We schedule normally until access is granted, and a one-time dialog in the workout (plus Settings → Reminders) explains and opens the page. Without the grant, the alert may arrive a little late.
- **Training-day reminders:** the platform API supports them; the feature itself belongs to M5.
- **Gotcha:** never resolve a promise with a Capacitor plugin object (it's a proxy; `.then()` is rejected by the native bridge), so the native layer wraps it.
- **Building:** `pnpm android:debug` / `android:release` / `android:install` (`scripts/android.sh`). The native build uses `VITE_NATIVE=1 VITE_BASE=/` (no service worker). It needs JDK 21 and the Android SDK; the script passes JDK 21 explicitly because a machine-wide `org.gradle.java.home` would override `JAVA_HOME`. Launcher icons come from `public/icon.svg` via `pnpm icons:android`.
- **Signing key:** `~/.bliskfit-signing/` (`bliskfit-release.jks` + `keystore.properties`, mode 600, outside the repo). **Back it up offline; losing it means installed copies can never be updated.** The release APK is signed with it (verified with `apksigner`).
- **Versioning is automatic:** `versionCode` = number of git commits (a newer build always installs over an older one; Android rejects lower codes) and `versionName` = `package.json` version + build number, shown in Settings. Bump `version` in `package.json` for a notable release; `BLISKFIT_VERSION_CODE` overrides the code if ever needed. Build from a clean, committed state so the number matches the code, and never rewrite history that has produced an installed APK (the count could go backwards).
- **Not covered by the pnpm release-age policy:** Gradle/Maven dependencies. Keep Android library versions pinned by Capacitor and review upgrades.

Add Capacitor to the existing web app and build a debug/release APK for the owner's phone. Native plugins only for what the PWA can't do reliably: scheduled local notifications (rest timer end, 2h forgotten-session reminder, training-day reminders), haptics, keep-awake, optionally a foreground service so the rest timer survives screen lock. These sit behind a small platform interface (`lib/platform`) with browser fallbacks, so the PWA keeps working. Set up the release signing key (back it up: losing it breaks updates) and a build script.
Done when: with the screen locked, the rest timer alerts and the 2h reminder fires.

### M4: History and PRs
**Status: done (web-only; no native changes).** History (icon at the top right of Workout) is a list or a month calendar of training days; each workout opens a detail page (also shown right after finishing) with stats, notes, sets and PR badges, and can be edited (set values, delete sets, notes) or deleted with confirmation. PRs are shown as a "PR" pill in the live workout, the finish summary, History rows and the detail page, and each exercise has a Records section (current bests, best reps at each weight, PR history). A "Show PR badges" switch is in Settings.
PR rules (`lib/prs.ts`, unit-tested): always recomputed from the logged sets, never stored, so edits and deletes can't leave stale flags. A set must be strictly better than everything done before it; the first time an exercise is done is a baseline; warm-ups are ignored. Weighted lifts: heaviest weight, rep record at the same weight, estimated 1RM (Epley, a single counts at face value) and best set volume. Bodyweight reps: most reps. Duration: longest hold. Not yet: assisted bodyweight and cardio.
Not done: editing a past workout's date/time and adding exercises to a finished workout.

### Starting-weight suggestions (added after M4)
For an exercise that has never been done, the live workout suggests a starting weight and reps (a "💡 Suggested start" line, grey placeholders in the set fields, and a "Use suggestion" button that fills the sets; nothing is ever applied or logged automatically). Logic in `lib/suggest.ts`, unit-tested:
- **Similar exercise:** shares a primary muscle (parent and child count as the same, e.g. Calves and Gastrocnemius), same tracking type, and compatible mechanic (compound vs isolation) when both are known. The library now stores `mechanic` (seed v2); custom exercises can set it in the form. Re-seeding preserves learned rest times.
- **Estimate:** each similar exercise (top 3 by similarity: muscle overlap, same equipment, secondary muscles) contributes the mean of its best estimated 1RM over its last 3 workouts, normalised to a barbell-equivalent, converted to the new exercise's equipment (rough relative loads: dumbbell 0.4 per hand, cable 0.55, machine 0.9, EZ bar 0.9, kettlebell 0.35), then to the routine's target reps (midpoint of the rep range, else 10).
- **Conservative:** about 85% of the estimate, rounded to 2.5 kg (5 lb) steps. Labelled "rough guess" unless two or more similar exercises including the same equipment agree.
- Also covers bodyweight reps (a bit under similar exercises), weighted bodyweight (added load) and durations. Not for assisted bodyweight or cardio. No suggestion when nothing comparable has history.

### M5: Goals, streaks and reminders
**Status: done** (reminders verified on the Android emulator: 14 exact alarms registered, and finishing a workout cancels today's). Notes:
- **Goal per week:** changing the goal keeps past weeks at the goal they had (change log in `meta.goalHistory`; goal views are derived, nothing per week is stored). Changing it back within the same week leaves no trace.
- **Streak freezes:** automatic and derived, so history stays recomputable: a missed past week is bridged (not counted) while that calendar month (of the week's first day) still has a freeze left; the setting is "freezes per month", 0 = off. A bridged week with nothing to protect before it isn't counted or reported. The current week never needs one (an unmet current week just isn't counted yet). Changing the allowance or the goal re-derives the streak.
- **Week strip:** compact on Workout, larger on Profile (which is where the app opens). Trained days are tappable: one workout opens its detail, several open that day in the History calendar.
- **Weekly goal chart** (Profile): bars per week with a step line for each week's goal, range 8 weeks / 6 months / year, tap or arrow keys for a readout, a key, and a table view. Colours: goal met = the app green, missed = neutral grey, current week = lighter wash. The dataviz palette validator passes colour-blind and normal-vision separation and contrast for that pair; its categorical-only lightness-band and chroma checks don't apply to a met/missed pair, so identity also rides on the labelled goal line, the readout and the table.
- **Training-day reminders:** weekdays and a time in Settings; scheduled individually for the next 14 days (ids 2000-2013) so today's can be dropped once you've trained. Re-planned when the app opens, the day changes, settings change, permission changes, or a workout finishes. In the Android app they fire when the app is closed; in the browser only while it's open. If the app isn't opened for 14 days, reminders stop until the next open. Not yet: deriving the days from the active program, and skipping reminders once the week's goal is already met.

Weekly goal, training days per week, streak = consecutive weeks meeting the goal, configurable week start, optional streak freeze (e.g. one per month for illness/travel), week progress and streak shown at the top of the Workout tab, optional notifications on planned training days. Edge cases tested (week boundaries, skipped weeks, goal changes, freezes).

Two progress views:
1. **Week strip (linear):** a single row of the week's days (starting on the configured week start). Trained days are marked (filled dot/check, tappable to open that day's session), today is outlined, and future days are empty. Shown on the Workout tab next to the streak, and a larger version on Profile.
2. **Weekly goal graph:** a bar chart of workouts per week over the last 8-12 weeks, with a goal line. Bars that reach the goal are highlighted and misses are muted; the current week is shown as in progress. It uses the goal that applied in each past week (hence the per-week goal snapshot), and a range switch (8 weeks / 6 months / year).
Both are built from pure, tested functions over finished sessions, so they also reflect edits and deletes made in History..

### M6: Stats and body tracking
Per-exercise charts (max weight, e1RM, volume, reps) with date range, muscle-group weekly sets/volume, muscle balance (push/pull ratio, left/right measurement asymmetry), plateau detector, weekly summary (sessions, volume, new PRs, under-trained muscles), body weight log with trend, body measurements (standard + custom, left/right) with charts and change summaries. Gym comparison for the same exercise (only shown if gyms are used).

### M7: Data safety and sharing
- JSON export/import, CSV export of sets, persistent storage request.
- Optional automatic cloud backup (Google Drive file), restore on a new phone.
- CSV importer for other apps (Strong, Hevy).
- Share a routine as a file or link; share a session summary as an image.
- Distribution and updates (see "Updates and distribution" below): free static hosting for the PWA, GitHub Releases for APKs, in-app update checks, install instructions for friends.
Done when: wipe app, restore from backup, everything is back.

### M8: Extras (pick and choose)
Progressive overload hints (using RPE/RIR and failure data), plate calculator, warm-up generator, routine template library, progress photos, deload suggestions, dark mode, cardio polish.

### M9: Interactive body figure
Front/back SVG with tappable muscles feeding the muscle filter, zoom regions and pinch/pan for small muscles, heatmap of weekly sets, measurement overlays. Artwork: existing library vs custom, decided at this point.

## Updates and distribution
Two layers, so most updates need no new APK:
1. **Web bundle updates (most releases):** the APK ships with the app's web code bundled (works offline). On launch it checks a small `version.json` on the static host and downloads a newer web bundle in the background, applying it on next start. Options: a Capacitor live-update plugin (self-hostable ones exist, e.g. Capgo; verify current status/licensing at M7) or a small custom updater. The PWA version updates itself through its service worker ("update available" prompt).
2. **Native APK updates (rare: new plugins, permissions, Capacitor upgrades):** built and published as a GitHub Release (free hosting). The app checks the latest release; if a newer APK exists it shows "Update available", downloads it and hands it to Android's installer (needs the "install unknown apps" permission for the app and a confirmation tap each time; Android does not allow silent installs). APKs must always be signed with the same key. Zero-code alternative for friends: the Obtainium app pointed at the GitHub repo handles update checks and installs.
3. **Data safety across updates:** schema migrations tested, and an automatic pre-update JSON backup.

## Notes
- Health Connect integration is not possible from a plain PWA; only if the app is later wrapped natively (Capacitor, which would also allow an APK).

## Open items
- App name/branding (icons).
- Hosting provider (GitHub Pages/Releases assumed), live-update approach and cloud backup mechanism at M7.
- APK release signing key storage/backup at M3b.

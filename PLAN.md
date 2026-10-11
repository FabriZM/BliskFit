# Gym App Plan

Personal gym tracker for Android. Built web-first as an offline PWA (installable from Chrome, shareable through a free static host), then wrapped as an APK with Capacitor once the live workout needs reliable timers/notifications. Same codebase for both. Data stays local on each device, with optional cloud backup.

## Stack
React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa, Recharts or uPlot, Zustand, Vitest, Capacitor (from M3b). Mobile-first, three bottom tabs (no Home):
- **Workout** (default screen): top card with today's suggested workout + Start, or Resume if a session is running; week progress and streak; below, a segmented switch **Routines** (incl. programs) | **History** (sessions, calendar, recent PRs).
- **Exercises:** library, search/filters, add exercise; later the interactive body figure.
- **Profile:** Stats first (charts, muscle volume, PRs), then body weight and measurements, goals, settings, backup, gyms.
An active session is a full-screen view; a persistent "workout in progress" bar sits above the tab bar on every screen. UI available in English and Spanish; kg/lb switchable.

## Tooling and supply chain security
- **Package manager: pnpm.** M0 was scaffolded with npm (`package-lock.json`, exact versions already pinned), so migrating is a small one-time task now, before more dependencies pile up: `pnpm import` from the lockfile, delete `package-lock.json`, set the `packageManager` field, update the Pages workflow in `.github/` to use pnpm.
- Dependency install scripts are blocked by default; allowlist only what is needed via `onlyBuiltDependencies`. Expected: `esbuild` and `sharp` (native binary, used by the icon script). Review every addition.
- Set a minimum release age so brand-new package versions are not installed for a few days (verify the exact pnpm option name and version before relying on it).
- Commit the lockfile; install with `--frozen-lockfile` in CI. Keep exact version pins (no `^`) and update deliberately after reading changelogs; run `pnpm audit` occasionally.
- Keep the dependency list short and well known. Prefer a few lines of code over tiny single-purpose packages. Consider moving `sharp` out of the app's dependency tree if only the icon script needs it.
- Never commit the APK signing key, keystore passwords or tokens; back up the key offline.
- Fallback if staying on npm: `ignore-scripts=true` in `.npmrc`, `npm ci` in CI, same pinning rules.

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
Add Capacitor to the existing web app and build a debug/release APK for the owner's phone. Native plugins only for what the PWA can't do reliably: scheduled local notifications (rest timer end, 2h forgotten-session reminder, training-day reminders), haptics, keep-awake, optionally a foreground service so the rest timer survives screen lock. These sit behind a small platform interface (`lib/platform`) with browser fallbacks, so the PWA keeps working. Set up the release signing key (back it up: losing it breaks updates) and a build script.
Done when: with the screen locked, the rest timer alerts and the 2h reminder fires.

### M4: History and PRs
Session history and detail with edit/delete, calendar of training days, PR detection and badges (live, summary, history), PR list per exercise.

### M5: Goals, streaks and reminders
Weekly goal, training days per week, streak = consecutive weeks meeting the goal, configurable week start, optional streak freeze (e.g. one per month for illness/travel), week progress and streak shown at the top of the Workout tab, optional notifications on planned training days. Edge cases tested (week boundaries, skipped weeks, goal changes, freezes).

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

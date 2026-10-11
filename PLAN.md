# Gym App Plan

Personal gym tracker for Android. Built web-first as an offline PWA (installable from Chrome, shareable through a free static host), then wrapped as an APK with Capacitor once the live workout needs reliable timers/notifications. Same codebase for both. Data stays local on each device, with optional cloud backup.

## Stack
React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa, Recharts or uPlot, Zustand, Vitest, Capacitor (from M3b). Mobile-first, three bottom tabs (no Home), in this order: **Profile · Workout · Exercises**. The app opens on Profile.
- **Profile** (default screen): at the top, the week card (this week's training days against the goal, and the weekly streak); then your pinned stats (a few cards chosen from the full Stats panel, which opens from a "See all" link) and the gym visit card. Settings (goal, week start, language, units, rest popup, backup, gyms) open from a gear icon at the top right.
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
| Gym | id, name, optional visit allowance (none by default; if set: visits per period and billing day, no rollover; plus optional manual day adjustments); app works fully without any gym or allowance |
| Routine | name, ordered RoutineExercise (target sets, rep range, rest override, superset group), archived |
| Program | name, weeks, schedule (routine per weekday) or rotation (A/B/C cycle), optional default gym |
| WorkoutSession | start, end, routine ref, optional gym ref, notes, status (active/paused/finished), paused intervals |
| SetLog | session, exercise, weight, added/assist weight, reps, duration, distance, RPE, reps in reserve, failure flag, done time, set type (warm-up/working/drop) |
| ExerciseNote | exercise, text, pinned for next time |
| BodyWeight | date, weight |
| Measurement | date, type (chest, waist, biceps L/R, ... or custom), value |
| ProgressPhoto | id, date, tag (free text, user-defined), photo (resized blob), optional note |
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
**Status: built and checked in a desktop browser; needs a real gym session on the phone.** Notes: sets belong to a session exercise (`itemId`), so one exercise can appear twice. Weights are stored in kg and converted for display. The finish summary shows duration, sets, volume and exercises; the PR count joins it in M4 with PR detection. The forgotten-session prompt appears when the app is opened or visible; a closed PWA cannot fire the 2h notification, so true background reminders and rest-end alerts with the screen locked are M3b. Rest and learned rest: a set's rest is the routine/session override, else the exercise's saved "always" value (`customRestSec`), else its learned rest (blended with each finished session's typical gap), else the exercise default, else the global default. From the exercise menu (⏱ Rest) the rest can be changed for this session only, or saved for this and future sessions of that exercise (which also updates any routine that already overrides it, so an older routine value can't beat the new choice); 0 means no timer, and "Reset to automatic" forgets the saved value. Re-seeding the library preserves both learned and saved rests.

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
- **Week strip:** on Profile only (which is where the app opens), with the streak and freezes. Nothing about the week or the streak is shown on the Workout tab. Trained days are tappable: one workout opens its detail, several open that day in the History calendar.
- **Weekly goal chart** (Profile): bars per week with a step line for each week's goal, range 8 weeks / 6 months / year, tap or arrow keys for a readout, a key, and a table view. Colours: goal met = the app green, missed = neutral grey, current week = lighter wash. The dataviz palette validator passes colour-blind and normal-vision separation and contrast for that pair; its categorical-only lightness-band and chroma checks don't apply to a met/missed pair, so identity also rides on the labelled goal line, the readout and the table.
- **Training-day reminders:** weekdays and a time in Settings; scheduled individually for the next 14 days (ids 2000-2013) so today's can be dropped once you've trained. Re-planned when the app opens, the day changes, settings change, permission changes, or a workout finishes. In the Android app they fire when the app is closed; in the browser only while it's open. If the app isn't opened for 14 days, reminders stop until the next open. Not yet: deriving the days from the active program, and skipping reminders once the week's goal is already met.

Weekly goal, training days per week, streak = consecutive weeks meeting the goal, configurable week start, optional streak freeze (e.g. one per month for illness/travel), week progress and the streak on Profile, optional notifications on planned training days. Edge cases tested (week boundaries, skipped weeks, goal changes, freezes).

Two progress views:
1. **Week strip (linear):** a single row of the week's days (starting on the configured week start). Trained days are marked (filled dot/check, tappable to open that day's session), today is outlined, and future days are empty. Shown on Profile only (with the streak); not on the Workout tab.
2. **Weekly goal graph:** a bar chart of workouts per week over the last 8-12 weeks, with a goal line. Bars that reach the goal are highlighted and misses are muted; the current week is shown as in progress. It uses the goal that applied in each past week (hence the per-week goal snapshot), and a range switch (8 weeks / 6 months / year).
Both are built from pure, tested functions over finished sessions, so they also reflect edits and deletes made in History..

### M5b: Gym visit plan (optional)
**Status: done.** Notes on decisions the spec left open:
- **Where:** the plan is configured per gym under Profile → Settings → Gyms (collapsed "Visit plan (optional)" on each gym; Save plan / Remove plan). The Profile "Gym visits" section only exists while at least one gym has a plan.
- **No rollover:** unused visits are lost at the end of each period, and going over just shows the real count (e.g. "13 of 12", 0 left): the user deals with it. `since` (the period the plan was set up in) only limits how far back past periods are listed; visits earlier in that same period still count.
- **Editing visits:** the card has an edit button (✎) that opens a day grid for the period (‹ › to go to earlier periods back to when the plan was set up). Days with a workout count automatically; tap a day to add one you forgot to log, or remove one the gym didn't count. Adjustments are stored per gym (`visitAdjustments`, by date) and always win over the workouts; turning a day back to what the workouts say deletes the adjustment, so nothing redundant is kept. They survive removing and re-adding the plan. Future days can't be toggled.
- **Periods:** start on the billing day each month, clamped to short months (31 → last day of Feb/Apr...), 1 = calendar month. "Days left" includes today.
- **Pace hint:** "about every N days" (rounded down so you don't undershoot), "most days", "every remaining day", or "N visits more than days left".
- **Default gym:** a program has an optional default gym (Program editor). It applies to routines in the *active* program (schedule or rotation) however they are started; everything else uses the last used gym; deleted gyms are never used. The gym stays optional and changeable from the session menu.
- **Fixing a visit afterwards:** History → workout → Edit now has the date/time and gym (shifting a session moves its sets and pauses with it), since the count follows both.
- **Not done:** the optional "visits unused near period end" notification.

For gyms that include a limited number of visits per period (e.g. 12 per month). Entirely optional: with no plan configured, nothing about it appears anywhere.
- **No allowance by default:** a new gym has none and behaves exactly like today. Setting an allowance is a deliberate, optional step in Profile > Gyms (visits per period, billing day or calendar month), and it can be cleared again at any time without losing session history.
- **Tied to a gym:** the allowance is a property of the Gym, and only gyms that have one get a card.
- **Shown only on Profile, and only for gyms with an allowance:** a compact card, e.g. "Gym X: 7 of 12 visits · 5 left · 9 days left", with a thin progress bar, plus past periods ("last period: 11 of 12") and an edit option to correct which days count. Not shown on the Workout tab.
- **Gym selection in a workout:** stays optional and tucked away. The gym is preselected automatically: the program's default gym if the session comes from a program that has one, otherwise the last used gym. It can be changed or cleared from the session menu.
- **What counts as a visit:** each calendar day with at least one finished working session at that gym counts once. A session needs at least one completed non-warm-up set; empty or warm-up-only sessions don't count. Two sessions on the same day count as one.
- **Derived, not stored:** used and remaining visits are calculated from history for the current period window, so edits and deletes in History keep it correct. Period windows follow the billing day (handle short months, e.g. a billing day of 31), not just the calendar month.
- **Pace hint:** remaining visits vs. days left ("about every 2 days to use them all").
- Optional later: a notification a few days before the period ends with unused visits.
Tests: period boundaries, billing-day edge cases, same-day sessions, sessions without a gym, editing a past session's gym or date.
Done when: a gym with no allowance shows nothing; with a 12-visit allowance, finishing a working session at that gym moves the Profile card from N to N+1 once per day.

### M6: Stats and body tracking
**Status: done (web-only; checked in a desktop browser with seeded data, not yet on the phone).** All four build steps are in. Notes on decisions:
- **Layout:** Stats panel at `/profile/stats` (section, range, exercise and card live in the URL, so a pinned card on Profile deep-links to its chart), Body log at `/profile/body`. Gyms section is only offered once two gyms have finished sessions.
- **Pure logic** in `lib/stats.ts` (series per exercise and metric, week buckets, muscle credit and roll-up, plateau, trend, gym comparison), `lib/body.ts` (measurement types, asymmetry, photo rules), `lib/pins.ts` and `lib/pinCards.ts` (pin identity, cap, cleanup, what a card plots); all unit-tested, plus `db/body.test.ts` for photo storage, the daily limit and tag renames. Schema v4 adds `progressPhotos`; weights are stored in kg and measurements in cm.
- **Weekly numbers** group a session's sets by the week the session started. The weekly summary compares this week so far with all of last week. Muscle groups total their own muscles; secondary muscles count half. Under-trained groups are the top-level ones below the target (neck is exempt), averaged over the last 4 weeks on Overview and over the selected range on Muscles.
- **Left/right measurements** are stored as `<name>_l` / `<name>_r` (custom names can be sided too). Trend line is an EMA (alpha 0.2 per weigh-in).
- **Pins** are stored in Settings (`pinnedStats`, `pinsDismissed`, `setsTarget`, `plateauSessions`; all default-valued, no migration). One pin per card regardless of range; unpinning at the 6-pin cap still works. Pins to deleted targets are dropped on Profile.
- **Photos:** resized to 1280px / JPEG 0.8 on capture, 6 per calendar day (also enforced when editing a photo's date), tags are free text reusing existing spellings.
- **Not done:** the plateau window and weekly-sets target are only adjustable for the target (in the panel); the plateau length has a setting field but no control yet. Assisted and cardio PRs are still not computed (charts for them work).
A full **Stats panel** (Profile → Stats, route `/profile/stats`) holds every training chart and number, including how body weight, measurements and progress photos have varied. Logging them happens on a separate **Body log screen** (Profile → Log body, route `/profile/body`). Profile itself only shows the stats you **pin**, so it stays short and personal. Everything is derived from finished sessions, sets and body entries (nothing aggregated is stored), so edits and deletes in History flow through, same as goals and gym visits.

**Panel layout:** a segmented switch at the top (five sections), each section a scroll of cards sharing one date-range control (4 weeks / 3 months / 6 months / year / all).
- **Overview:** weekly summary (sessions, total volume, new PRs, under-trained muscles) with a previous-week comparison; recent PRs.
- **Exercises:** pick an exercise (search, favorites first), then charts for max weight, estimated 1RM (Epley), volume and reps per session; plateau flag when the best e1RM hasn't improved over the last N sessions (default 5, at least 3 weeks); PRs list for that exercise. Charts respect the tracking type (assisted: lower is better; duration/cardio: time, distance, pace instead of weight).
- **Muscles:** weekly sets and volume per muscle group (primary full credit, secondary partial, from the exercise-muscle links), with the drill-down from group to muscle; balance block with push/pull ratio and left/right asymmetry from measurements; under-trained list (below a set-per-week target, default 10, adjustable).
- **Body:** read-only. Body weight with a smoothed trend line and change over the range; each measurement (standard and custom, left/right pairs side by side) with a chart and change summary; left/right asymmetry. **Progress photos:** a timeline grid filtered by tag, tap for full size, and a compare view (pick any two dates with the same tag, side by side or with a slider; defaults to first vs latest). Empty state links to the Body log screen.
- **Gyms:** same-exercise comparison across gyms (best set, e1RM, volume per gym). Section only exists when sessions have been logged at two or more gyms, matching the "nothing shown unless used" rule from M5b.

**Body log screen** (separate from the Stats panel, with its own link on Profile): entry only. Add today's weight, add a measurement (standard set plus custom types, left/right), add a progress photo (camera or gallery, a tag (suggested from your existing ones, or new), optional note, date defaults to today but can be backdated), and edit or delete past entries in a simple dated list. No charts here; it links to the Stats panel's Body section to see the effect.

**Progress photos:**
- **Limit: 6 photos per day** (per calendar date, across all tags). The date is the photo's date, so backdating into a full day is also blocked. When the day is full, adding another asks you to delete one of that day's photos first; nothing is deleted automatically. There is no overall cap, so storage grows over time: the Body log screen shows the space photos use, and photos are stored resized to keep it small.
- **Tags** exist so you can compare like with like (e.g. full body shots apart from selfies). They are entirely user-defined: no presets. When adding a photo, the tags you have used before are suggested as one-tap chips, or you type a new one. A tag exists only while a photo uses it; renaming a tag (from the photo edit sheet) renames it on all its photos. Photos can be untagged.
- Stored locally as resized blobs in IndexedDB (reusing `lib/image.ts`, same approach as exercise photos), never uploaded anywhere. Full-size originals aren't kept. Standard quality: `compressImage` with the longest side capped at 1280px and JPEG quality 0.8 (about 150-300 KB per photo, versus 3-5 MB from a phone camera), a slightly larger cap than the 1024px used for exercise photos so zooming in compare view stays sharp. Photos are never upscaled; the phone's orientation is respected.
- Private by default: photos appear only in the panel's Body section, never on Profile unless pinned, and never in session summaries or share images (M7).
- A photo can be pinned as a "latest photo" or "first vs latest" card (tag chosen when pinning); pinned photo cards respect the same 6-pin cap. Pins show a thumbnail instead of a sparkline.
- Included in JSON export/backup (M7 must handle blobs and the size they add); deleting a photo removes the blob for good.

**Pinning:**
- Every card in the Stats panel, including body weight and each measurement, has a pin toggle (photos pin as described above). A pin stores *what* is shown, not a snapshot: `{ kind, exerciseId?, muscleId?, measurement?, range }` (body weight and each measurement type are their own kinds, e.g. waist, left biceps), so "Bench press e1RM, 3 months" and "Squat e1RM, 3 months" are two pins. Persisted in Settings (`pinnedStats`, ordered), default-empty field so old data needs no migration.
- Profile renders pins as compact cards: title, current value, change over the range, and a small sparkline. Tap opens the panel scrolled to that card with the same range. Body weight's pin has an inline "+ add today" action.
- "Edit" mode on Profile's stats section reorders and unpins; capped at 6 pins to keep the tab light. First launch with history and no pins shows three suggested defaults (weekly summary, weekly sets by muscle, body weight) with a one-tap dismiss; with no history, an empty hint pointing to the panel.
- A pin whose exercise or measurement is deleted disappears silently.

**Build order** (each step shippable on its own):
1. Pure functions (`lib/stats.ts`: series per exercise and metric, range bucketing, muscle credit, plateau, summary, trend smoothing) with tests, then the panel shell, range control, pin framework and Profile pinned section, with the Exercises section as the first real content.
2. Overview and Muscles (weekly summary, set/volume per muscle, under-trained, push/pull).
3. Body log screen (entry, edit, delete, including photos) and the panel's Body section (trend, left/right asymmetry, change summaries, charts, photo timeline and compare, pinning).
4. Gym comparison.

**Decisions to confirm:**
- Push/pull is derived from muscle groups (push: chest, shoulders, triceps; pull: back, biceps), not from exercise names. Exercises hitting both count for both at their credit weight.
- Trend line is an exponential moving average on body weight (so a single weigh-in doesn't jump the line); raw points still shown.
- Charts reuse the Recharts/uPlot choice and the dataviz palette conventions from `GoalChart` (table view and readout for accessibility).

Tests: photo storage and deletion, the 6-photos-per-day limit (including backdated), compare defaults (first vs latest per tag), range bucketing and week boundaries, muscle credit split, plateau detection (flat, rising, too few sessions), tracking-type metrics (assisted, duration), trend smoothing, left/right asymmetry, pin persistence and deleted-target cleanup, gym section hidden with fewer than two gyms.
Done when: pinning "Bench press e1RM" in the panel shows it on Profile with a sparkline and tapping it opens the panel on that chart; unpinning removes it; logging a waist measurement on the Body log screen and pinning it from the panel's Body section shows it on Profile, and tapping it opens that chart; a body weight entry moves the trend and the Profile card; a progress photo logged on the Body log screen shows in the panel's timeline and in compare, and can be pinned; the Gyms section appears only after logging at two gyms.

### M7: Data safety and sharing
**Status: step 1 (backup, restore, CSV) done, web-checked; not yet tried on the phone.** Notes:
- **Screen:** Settings → Backup and data (`/profile/backup`); the persistent-storage status moved there (web only, since the installed app's data isn't evicted).
- **Backup file** (`db/backup.ts`): one JSON file, `{ app: 'bliskfit', format: 1, schemaVersion, appVersion, exportedAt, tables }`, every Dexie table as stored, blobs inlined as `{ $blob: type, data: base64 }`. Restoring replaces everything in one transaction (all or nothing), fills settings added since with defaults, refuses files that aren't backups or come from a newer schema, asks for confirmation with a summary (date, workouts, routines, photos), then reloads the app. "Last backup" date kept in `meta`.
- **CSV** (`lib/csv.ts`): one row per logged set of finished workouts, in the user's units, blank sets skipped, UTF-8 with BOM. Export only (spreadsheets); not an import format.
- **Saving files:** `platform.saveFile` downloads in the browser; in the app it writes to the cache with `@capacitor/filesystem` and opens the share sheet with `@capacitor/share` (save to Files or Drive, send it).
- **Sharing routines and programs (done, web-checked):** "Share link" / "Share file" on the routine and program editors; Workout → Import (`/import`) takes a link, a pasted link or a file. The package (`lib/share.ts`, `{ app: 'bliskfit-share', format: 1, kind, routines, program?, exercises }`) holds the routines (a program's routines once each, referred to by index) plus definitions of the custom exercises they use; seeded exercises go by id (`x:…`, same on every phone). Nothing personal travels: no history, gyms, notes, photos or learned rest. Links carry the package deflated and base64url-encoded in the URL fragment (never reaches a server; ~500 characters for a 3-routine program); from the Android app they point at the public web app. Incoming data is untrusted: validation keeps only known fields, bounds numbers (sets 1-20, weeks ≤ 12) and allows only http(s) links. Importing always adds copies (a taken name becomes "Push (2)"), creates missing custom exercises under the sender's id (so a second import reuses them), leaves out exercises the app doesn't know, drops the program's gym, doesn't make the program active and starts week 1 this week.
- **Next:** session summary image, Strong/Hevy CSV importer, automatic cloud backup, distribution and updates. The Android app doesn't open shared links itself yet (they open the web app); an app link for `fabrizm.github.io` would fix that.
- JSON export/import (including progress photos from M6), CSV export of sets, persistent storage request.
- Optional automatic cloud backup (Google Drive file), restore on a new phone.
- CSV importer for other apps (Strong, Hevy).
- Share a routine as a file or link; share a session summary as an image.
- Distribution and updates (see "Updates and distribution" below): free static hosting for the PWA, GitHub Releases for APKs, in-app update checks, install instructions for friends.
Done when: wipe app, restore from backup, everything is back.

### M8: Extras (pick and choose)
Progressive overload hints (using RPE/RIR and failure data), plate calculator, warm-up generator, routine template library, deload suggestions, dark mode, cardio polish.

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

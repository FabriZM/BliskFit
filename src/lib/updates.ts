/**
 * Android app updates come from GitHub Releases. A release is tagged `v<version>-<build>` (e.g. v0.4.0-72, where
 * the build number is the Android versionCode) and carries one APK. The app compares that build number with its
 * own and, if newer, offers the APK, which Android installs over the current app (same signing key, data kept).
 */
/** Recent releases, not GitHub's "latest" (which is by date): the newest build is picked from these. */
export const RELEASES_API = 'https://api.github.com/repos/FabriZM/BliskFit/releases?per_page=20'
export const RELEASES_PAGE = 'https://github.com/FabriZM/BliskFit/releases/latest'

export interface AppRelease {
  version: string
  build: number
  apkUrl: string
  pageUrl: string
  notes?: string
}

export const releaseTag = (version: string, build: number) => `v${version}-${build}`
export const apkName = (version: string, build: number) => `bliskfit-${version}-${build}.apk`

/** Reads GitHub's "latest release" response; undefined if it isn't one of ours (bad tag, no APK, draft). */
export function parseRelease(json: unknown): AppRelease | undefined {
  const r = json as { tag_name?: unknown; html_url?: unknown; body?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown }
  if (!r || typeof r.tag_name !== 'string' || r.draft || r.prerelease) return undefined
  const m = /^v(\d+\.\d+\.\d+)-(\d+)$/.exec(r.tag_name)
  if (!m) return undefined
  const assets = Array.isArray(r.assets) ? r.assets as { name?: unknown; browser_download_url?: unknown }[] : []
  const apk = assets.find((a) => typeof a.name === 'string' && a.name.endsWith('.apk') && typeof a.browser_download_url === 'string')
  // Only ever send people to GitHub for the download.
  const apkUrl = apk?.browser_download_url as string | undefined
  if (!apkUrl || !/^https:\/\/github\.com\//.test(apkUrl)) return undefined
  return {
    version: m[1],
    build: Number(m[2]),
    apkUrl,
    pageUrl: typeof r.html_url === 'string' && r.html_url.startsWith('https://github.com/') ? r.html_url : RELEASES_PAGE,
    notes: typeof r.body === 'string' && r.body.trim() ? r.body.trim().slice(0, 2000) : undefined,
  }
}

/**
 * The release to serve: the highest build among the published ones, so an older build published later (or GitHub
 * picking "latest" by date) never wins.
 */
export function newestRelease(list: unknown): AppRelease | undefined {
  if (!Array.isArray(list)) return undefined
  return list.map(parseRelease).filter((r): r is AppRelease => !!r).reduce<AppRelease | undefined>((best, r) => (!best || r.build > best.build ? r : best), undefined)
}

/** What to download: a fresh lookup wins if it found something newer than the release the user was shown. */
export const pickDownload = (offered: AppRelease, fresh: AppRelease | undefined): AppRelease =>
  fresh && fresh.build > offered.build ? fresh : offered

/** How often the app looks for a new release (GitHub allows 60 unauthenticated requests an hour). */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

export const shouldCheck = (lastCheckedAt: number | undefined, now: number) => lastCheckedAt === undefined || now - lastCheckedAt >= CHECK_INTERVAL_MS

/** The release to offer: only one newer than this build. */
export const offer = (release: AppRelease | undefined, currentBuild: number): AppRelease | undefined =>
  release && release.build > currentBuild ? release : undefined

// Generates the web icons (favicon + PWA) from Logo/BliskFit-Logo.png. Run: pnpm icons
import sharp from 'sharp'

export const LOGO = 'Logo/BliskFit-Logo.png'
// The teal logo has see-through cutouts, so it sits on a white tile; teal on the app's dark grey is too faint.
export const TILE = '#ffffff'

// The logo scaled to fit a size x size square (transparent padding keeps it centred).
export const logo = (size) =>
  sharp(LOGO).trim().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()

// Logo at `ratio` of a size x size canvas filled with `background`.
export const tile = async (size, ratio, background = TILE) =>
  sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: await logo(Math.round(size * ratio)), gravity: 'center' }])
    .png()

if (import.meta.url === `file://${process.argv[1]}`) {
  // Rounded white tile so the favicon reads on both light and dark browser tabs.
  const round = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14"/></svg>')
  await sharp(await (await tile(64, 0.8)).toBuffer()).composite([{ input: round, blend: 'dest-in' }]).png().toFile('public/favicon.png')
  await (await tile(192, 0.8)).toFile('public/pwa-192.png')
  await (await tile(512, 0.8)).toFile('public/pwa-512.png')
  // Maskable: artwork inside the 80% safe-zone circle.
  await (await tile(512, 0.6)).toFile('public/pwa-maskable-512.png')
  console.log('web icons written')
}

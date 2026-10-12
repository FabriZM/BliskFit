// Generates the Android launcher and notification icons from Logo/BliskFit-Logo.png. Run: pnpm icons:android
import sharp from 'sharp'
import { mkdirSync, rmSync } from 'node:fs'
import { logo, tile } from './make-icons.mjs'

const res = 'android/app/src/main/res'
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

for (const [name, scale] of Object.entries(densities)) {
  const dir = `${res}/mipmap-${name}`
  mkdirSync(dir, { recursive: true })
  const legacy = Math.round(48 * scale)
  await (await tile(legacy, 0.72)).toFile(`${dir}/ic_launcher.png`)
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`)
  await sharp(await (await tile(legacy, 0.6)).toBuffer()).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`)
  // 108dp canvas; the logo's box is 46% of it so its corners stay inside the 72dp mask circle.
  const canvas = Math.round(108 * scale)
  await (await tile(canvas, 0.46, { r: 0, g: 0, b: 0, alpha: 0 })).toFile(`${dir}/ic_launcher_foreground.png`)

  // Status bar icon: Android only uses the alpha channel, so a white silhouette of the logo.
  const ddir = `${res}/drawable-${name}`
  mkdirSync(ddir, { recursive: true })
  const stat = Math.round(24 * scale)
  const art = Math.round(stat * 0.9)
  const white = { create: { width: art, height: art, channels: 4, background: '#ffffff' } }
  const shape = await sharp(await logo(art)).composite([{ input: white, blend: 'in' }]).png().toBuffer()
  await sharp({ create: { width: stat, height: stat, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shape, gravity: 'center' }])
    .png().toFile(`${ddir}/ic_stat_bliskfit.png`)
}
// Replaced by the PNGs above (the old vector dumbbell).
rmSync(`${res}/drawable/ic_stat_bliskfit.xml`, { force: true })
console.log('android icons written')

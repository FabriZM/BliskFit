// Generates the Android launcher icons from public/icon.svg. Run: pnpm icons:android
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'

const svg = readFileSync('public/icon.svg', 'utf8')
// Adaptive foreground = the artwork without its dark background square (Android supplies the background colour).
const artOnly = Buffer.from(svg.replace(/<rect width="512" height="512"[^>]*\/>/, ''))
const full = Buffer.from(svg)
const res = 'android/app/src/main/res'
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

for (const [name, scale] of Object.entries(densities)) {
  const dir = `${res}/mipmap-${name}`
  mkdirSync(dir, { recursive: true })
  const legacy = Math.round(48 * scale)
  await sharp(full).resize(legacy, legacy).png().toFile(`${dir}/ic_launcher.png`)
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`)
  await sharp(full).resize(legacy, legacy).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`)
  // 108dp canvas; artwork scaled to 66% so it stays inside the adaptive-icon safe zone.
  const canvas = Math.round(108 * scale)
  const art = Math.round(canvas * 0.66)
  const inner = await sharp(artOnly).resize(art, art).png().toBuffer()
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'center' }]).png().toFile(`${dir}/ic_launcher_foreground.png`)
}
console.log('android launcher icons written')

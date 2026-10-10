import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg')
await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png')
// Maskable: shrink artwork into the safe zone on a solid background.
const inner = await sharp(svg).resize(360, 360).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#111827' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile('public/pwa-maskable-512.png')

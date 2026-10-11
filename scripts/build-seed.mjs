// Downloads free-exercise-db (Unlicense) and writes a compact seed file.
// Usage: npm run seed   (commit the result; the app never fetches the raw dataset)
import { writeFileSync } from 'node:fs'

const URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const all = await (await fetch(URL)).json()
const out = all.map((e) => ({
  id: e.id,
  n: e.name,
  c: e.category,
  e: e.equipment ?? null,
  p: e.primaryMuscles,
  s: e.secondaryMuscles,
  i: e.images.length,
}))
writeFileSync('src/data/seed-exercises.json', JSON.stringify(out))
console.log(`wrote ${out.length} exercises`)

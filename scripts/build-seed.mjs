// Downloads free-exercise-db (Unlicense) and writes a compact seed file.
// Usage: npm run seed   (commit the result; the app never fetches the raw dataset)
import { writeFileSync } from 'node:fs'

const URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

// The dataset has no instructions for these; written by hand so every seeded exercise has a how-to.
const HOW_TO = {
  Iron_Cross: [
    'Stand with your feet shoulder-width apart, holding a light dumbbell in each hand at your sides with palms facing in.',
    'Squat down until your thighs are about parallel to the floor while raising the dumbbells straight in front of you to shoulder height.',
    'Stand back up while sweeping the dumbbells out to your sides, keeping them at shoulder height so your body forms a cross.',
    'Bring the dumbbells back in front of you, then lower them to your sides. Repeat for the prescribed repetitions.',
  ],
  'One-Arm_Kettlebell_Swings': [
    'Stand with your feet slightly wider than shoulder-width apart and a kettlebell on the floor just in front of you.',
    'Hinge at the hips with a flat back and grab the handle with one hand. Your free arm can stay out to the side for balance.',
    'Hike the kettlebell back between your legs, then drive your hips forward forcefully to swing it up to chest height, keeping the arm straight.',
    'Let the kettlebell fall back between your legs while hinging at the hips again, and go straight into the next swing.',
    'Complete the prescribed repetitions, then switch hands.',
  ],
  Push_Press: [
    'Hold a barbell across the front of your shoulders with a grip slightly wider than shoulder-width, elbows slightly in front of the bar. Stand with your feet hip-width apart.',
    'Dip by bending your knees a few inches while keeping your torso upright and your weight on your heels.',
    'Drive up through your legs explosively and use that momentum to press the bar straight overhead until your arms are locked out.',
    'Lower the bar under control back to your shoulders, absorbing the weight with a slight bend in the knees. Repeat.',
  ],
  Side_Bridge: [
    'Lie on your side with your legs straight and stacked, propped up on your forearm with the elbow directly under your shoulder.',
    'Lift your hips off the floor so your body forms a straight line from head to feet. This will be your starting position.',
    'Hold this position for the prescribed time while breathing steadily, without letting your hips sag.',
    'Lower your hips back to the floor and repeat on the other side.',
  ],
  Side_Jackknife: [
    'Lie on your side with your legs straight and stacked. Place your lower arm across your stomach and your top hand behind your head.',
    'Raise your top leg while bringing your upper body up and toward it, crunching your obliques so your elbow and knee move toward each other.',
    'Pause at the top, then slowly lower back to the starting position.',
    'Complete the prescribed repetitions, then switch sides.',
  ],
}

const all = await (await fetch(URL)).json()
const out = all.map((e) => ({
  id: e.id,
  n: e.name,
  c: e.category,
  e: e.equipment ?? null,
  m: e.mechanic ?? null,
  l: e.level,
  p: e.primaryMuscles,
  s: e.secondaryMuscles,
  i: e.images.length,
  h: e.instructions?.length ? e.instructions.map((s) => s.trim()).filter(Boolean) : HOW_TO[e.id] ?? [],
}))
const missing = out.filter((r) => !r.h.length).map((r) => r.id)
if (missing.length) throw new Error(`no how-to for: ${missing.join(', ')}`)
writeFileSync('src/data/seed-exercises.json', JSON.stringify(out))
console.log(`wrote ${out.length} exercises`)

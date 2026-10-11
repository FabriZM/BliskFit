import type { Exercise, ID, Program, Routine, RoutineExercise, TrackingType } from '../db/types'

/**
 * A shared routine or program: self-contained, so it can be added on a phone that doesn't have the sender's
 * custom exercises. Sent as a file or packed into a link. Nothing personal travels (no history, gyms, notes or
 * photos), and the receiver always gets new copies, never an overwrite of their own routines.
 */
export const SHARE_APP = 'bliskfit-share'
export const SHARE_FORMAT = 1

/** Exercise definition as shared: what's needed to recreate a custom one. Photos and learned rest stay home. */
export type SharedExercise = Pick<Exercise, 'id' | 'name' | 'trackingType' | 'equipment' | 'mechanic' | 'primaryMuscleIds'
  | 'secondaryMuscleIds' | 'demoUrl' | 'videoUrl' | 'defaultRestSec'>

export type SharedRoutineExercise = Omit<RoutineExercise, 'id'>
export interface SharedRoutine { name: string; exercises: SharedRoutineExercise[] }

/** Routines are referred to by their index in `routines`. */
export interface SharedProgram {
  name: string
  weeks: number
  mode: Program['mode']
  schedule?: Record<number, Record<number, number>>
  rotation?: number[]
}

export interface SharePackage {
  app: typeof SHARE_APP
  format: number
  kind: 'routine' | 'program'
  routines: SharedRoutine[]
  program?: SharedProgram
  /** Only custom exercises; seeded ones have the same id on every phone. */
  exercises: SharedExercise[]
}

export class ShareError extends Error {
  constructor(public reason: 'invalid' | 'newer' | 'backup') { super(reason) }
}

const isSeeded = (id: ID) => id.startsWith('x:')

function sharedExercise(e: Exercise): SharedExercise {
  const { id, name, trackingType, equipment, mechanic, primaryMuscleIds, secondaryMuscleIds, demoUrl, videoUrl, defaultRestSec } = e
  return { id, name, trackingType, equipment, mechanic, primaryMuscleIds, secondaryMuscleIds, demoUrl, videoUrl, defaultRestSec }
}

const sharedRoutine = (r: Routine): SharedRoutine => ({
  name: r.name,
  exercises: r.exercises.map(({ id: _id, ...rest }) => rest),
})

function customExercises(routines: Routine[], exercises: Map<ID, Exercise>): SharedExercise[] {
  const ids = new Set(routines.flatMap((r) => r.exercises.map((e) => e.exerciseId)).filter((id) => !isSeeded(id)))
  return [...ids].flatMap((id) => { const e = exercises.get(id); return e ? [sharedExercise(e)] : [] })
}

export function packRoutine(r: Routine, exercises: Map<ID, Exercise>): SharePackage {
  return { app: SHARE_APP, format: SHARE_FORMAT, kind: 'routine', routines: [sharedRoutine(r)], exercises: customExercises([r], exercises) }
}

/** Packs a program with the routines it uses (in first-use order); references to deleted routines are dropped. */
export function packProgram(p: Program, routines: Map<ID, Routine>, exercises: Map<ID, Exercise>): SharePackage {
  const used: Routine[] = []
  const index = new Map<ID, number>()
  const ref = (rid: ID): number | undefined => {
    if (!index.has(rid)) {
      const r = routines.get(rid)
      if (!r) return undefined
      index.set(rid, used.push(r) - 1)
    }
    return index.get(rid)
  }
  const program: SharedProgram = { name: p.name, weeks: p.weeks, mode: p.mode }
  if (p.mode === 'rotation') program.rotation = (p.rotation ?? []).flatMap((rid) => { const i = ref(rid); return i === undefined ? [] : [i] })
  else {
    program.schedule = {}
    for (let w = 0; w < p.weeks; w++) {
      const days: Record<number, number> = {}
      for (const [day, rid] of Object.entries(p.schedule?.[w] ?? {})) { const i = ref(rid); if (i !== undefined) days[Number(day)] = i }
      program.schedule[w] = days
    }
  }
  return {
    app: SHARE_APP, format: SHARE_FORMAT, kind: 'program', program,
    routines: used.map(sharedRoutine), exercises: customExercises(used, exercises),
  }
}

const TRACKING: TrackingType[] = ['weight_reps', 'bodyweight_reps', 'bodyweight_added', 'assisted_bodyweight', 'duration', 'cardio']
export const MAX_PROGRAM_WEEKS = 12
const MAX_ROUTINES = 50
const MAX_ITEMS = 100

const isStr = (v: unknown): v is string => typeof v === 'string'
const str = (v: unknown, max = 200) => (isStr(v) ? v.slice(0, max) : undefined)
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined
const url = (v: unknown) => (isStr(v) && /^https?:\/\//i.test(v) ? v.slice(0, 500) : undefined)
const ids = (v: unknown) => (Array.isArray(v) ? v.filter(isStr).slice(0, 20) : [])
/** Drops undefined fields so stored rows look like ones made in the app. */
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

class Invalid extends Error {}
const must = <T>(v: T | undefined): T => { if (v === undefined) throw new Invalid(); return v }

/**
 * Checks untrusted input (a file or link someone sent) and returns a clean copy holding only known fields with
 * sane values (http(s) links only, bounded numbers), or throws ShareError.
 */
export function validatePackage(data: unknown): SharePackage {
  const p = data as Record<string, unknown> | null
  if (p?.app === 'bliskfit') throw new ShareError('backup')
  if (!p || p.app !== SHARE_APP || typeof p.format !== 'number') throw new ShareError('invalid')
  if (p.format > SHARE_FORMAT) throw new ShareError('newer')
  try {
    if (!Array.isArray(p.routines) || p.routines.length === 0 || p.routines.length > MAX_ROUTINES || !Array.isArray(p.exercises)) throw new Invalid()
    const routines: SharedRoutine[] = p.routines.map((r: Record<string, unknown>) => {
      if (!Array.isArray(r?.exercises) || r.exercises.length > MAX_ITEMS) throw new Invalid()
      return {
        name: must(str(r.name, 100)),
        exercises: r.exercises.map((e: Record<string, unknown>) => compact({
          exerciseId: must(str(e?.exerciseId)),
          targetSets: must(num(e.targetSets, 1, 20)),
          repMin: num(e.repMin, 0, 999),
          repMax: num(e.repMax, 0, 999),
          restSec: num(e.restSec, 0, 3600),
          supersetGroup: str(e.supersetGroup, 64),
        })),
      }
    })
    const exercises: SharedExercise[] = p.exercises.slice(0, MAX_ROUTINES * MAX_ITEMS).map((e: Record<string, unknown>) => {
      const trackingType = e?.trackingType as TrackingType
      if (!TRACKING.includes(trackingType)) throw new Invalid()
      return compact({
        id: must(str(e.id)),
        name: must(str(e.name, 100)),
        trackingType,
        equipment: str(e.equipment, 50),
        mechanic: e.mechanic === 'compound' || e.mechanic === 'isolation' ? e.mechanic : undefined,
        primaryMuscleIds: ids(e.primaryMuscleIds),
        secondaryMuscleIds: ids(e.secondaryMuscleIds),
        demoUrl: url(e.demoUrl),
        videoUrl: url(e.videoUrl),
        defaultRestSec: num(e.defaultRestSec, 0, 3600),
      })
    })
    const n = routines.length
    const index = (i: unknown) => { if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= n) throw new Invalid(); return i as number }
    let program: SharedProgram | undefined
    if (p.kind === 'program') {
      const sp = p.program as Record<string, unknown> | undefined
      const weeks = must(num(sp?.weeks, 1, MAX_PROGRAM_WEEKS))
      if (sp?.mode === 'rotation') {
        if (!Array.isArray(sp.rotation)) throw new Invalid()
        program = { name: must(str(sp.name, 100)), weeks, mode: 'rotation', rotation: sp.rotation.map(index) }
      } else if (sp?.mode === 'weekday') {
        const raw = (sp.schedule ?? {}) as Record<string, Record<string, unknown>>
        if (typeof raw !== 'object') throw new Invalid()
        const schedule: Record<number, Record<number, number>> = {}
        for (let w = 0; w < weeks; w++) {
          const days = raw[w] ?? {}
          if (typeof days !== 'object' || days === null) throw new Invalid()
          schedule[w] = Object.fromEntries(Object.entries(days)
            .filter(([d]) => /^[0-6]$/.test(d)).map(([d, i]) => [Number(d), index(i)]))
        }
        program = { name: must(str(sp.name, 100)), weeks, mode: 'weekday', schedule }
      } else throw new Invalid()
    } else if (p.kind !== 'routine') throw new Invalid()
    return { app: SHARE_APP, format: SHARE_FORMAT, kind: p.kind, routines, exercises, ...(program && { program }) }
  } catch (e) {
    if (e instanceof Invalid || e instanceof TypeError) throw new ShareError('invalid')
    throw e
  }
}

// --- Links: the package JSON, deflated and base64url-encoded into the URL fragment (never sent to a server). ---

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer())
}

const toBase64Url = (bytes: Uint8Array) => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function encodeLinkData(p: SharePackage): Promise<string> {
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(p)), new CompressionStream('deflate-raw')))
}

export async function decodeLinkData(d: string): Promise<SharePackage> {
  let json: unknown
  try { json = JSON.parse(new TextDecoder().decode(await pipe(fromBase64Url(d), new DecompressionStream('deflate-raw')))) }
  catch { throw new ShareError('invalid') }
  return validatePackage(json)
}

/** Finds the share data in a pasted link (…#/import?d=…) or a bare code. */
export function linkDataFrom(text: string): string | undefined {
  const t = text.trim()
  const m = /[?&]d=([A-Za-z0-9_-]+)/.exec(t)
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{16,}$/.test(t) ? t : undefined
}

export const shareFileName = (name: string) =>
  `${name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'routine'}.bliskfit.json`

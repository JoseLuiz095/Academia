import type { MotionPreset, MuscleGroup } from '../types'
import type { ExerciseEnvironment } from './exerciseLibraryTypes'

export type ExerciseCatalogSource = 'repdb' | 'open'
export type RepDbExercise = {
  id: string
  name: string
  description: string
  equipment: string
  level: 'beginner' | 'intermediate' | 'advanced'
  environment: ExerciseEnvironment
  muscles: MuscleGroup[]
  preset: Exclude<MotionPreset, 'auto'>
  startImage: string
  peakImage: string
  source: ExerciseCatalogSource
}

type RepDbApiExercise = { id?: string; name_en?: string; description_en?: string; equipment?: string; difficulty?: string; is_bodyweight?: boolean; primary_muscles?: string[]; secondary_muscles?: string[]; images?: { flat?: { start?: string; peak?: string; main?: string } } }
type OpenExerciseApiExercise = { id?: string; name?: string; level?: string; equipment?: string | null; primaryMuscles?: string[]; secondaryMuscles?: string[]; instructions?: string[]; images?: string[] }

const catalogUrl = 'https://exercise-dataset.com/exercises.json'
const imageBaseUrl = 'https://exercise-dataset.com/'
const openCatalogUrl = '/exercise-catalog/free-exercise-db.json'
const openImageBaseUrl = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

const muscleMap: Record<string, MuscleGroup | undefined> = {
  pectoralis_major: 'chest', pectoralis_minor: 'chest', chest: 'chest',
  latissimus_dorsi: 'back', upper_back: 'back', lower_back: 'back', middle_back: 'back', trapezius: 'back', traps: 'back', rhomboids: 'back', erector_spinae: 'back', lats: 'back',
  anterior_deltoid: 'shoulders', lateral_deltoid: 'shoulders', posterior_deltoid: 'shoulders', deltoids: 'shoulders', shoulders: 'shoulders',
  biceps: 'arms', biceps_brachii: 'arms', triceps: 'arms', triceps_brachii: 'arms', forearms: 'arms', brachialis: 'arms', brachioradialis: 'arms',
  rectus_abdominis: 'core', transverse_abdominis: 'core', obliques: 'core', serratus_anterior: 'core', abs: 'core', abdominals: 'core',
  glutes: 'glutes', gluteus_maximus: 'glutes', gluteus_medius: 'glutes',
  quadriceps: 'quadriceps', rectus_femoris: 'quadriceps', vastus_lateralis: 'quadriceps', vastus_medialis: 'quadriceps',
  hamstrings: 'hamstrings', biceps_femoris: 'hamstrings', semitendinosus: 'hamstrings', semimembranosus: 'hamstrings',
  calves: 'calves', gastrocnemius: 'calves', soleus: 'calves', tibialis_anterior: 'calves',
}

function toImageUrl(path: string | undefined, baseUrl: string) { return path ? new URL(path, baseUrl).toString() : '' }

function toPreset(name: string): Exclude<MotionPreset, 'auto'> {
  const value = name.toLocaleLowerCase('en-US')
  if (/squat|leg press|step.?up/.test(value)) return 'squat'
  if (/lunge|split squat/.test(value)) return 'lunge'
  if (/push.?up|bench press|chest press|fly/.test(value)) return 'pushup'
  if (/row|pulldown|pull.?up/.test(value)) return 'row'
  if (/deadlift|good morning|hip hinge/.test(value)) return 'deadlift'
  if (/press|raise|extension/.test(value)) return 'press'
  if (/plank|crunch|sit.?up|rollout/.test(value)) return 'plank'
  return 'strength'
}

function toLevel(value?: string): RepDbExercise['level'] {
  const level = value?.toLocaleLowerCase('en-US')
  if (level === 'advanced' || level === 'expert') return 'advanced'
  if (level === 'intermediate') return 'intermediate'
  return 'beginner'
}

function toMuscles(primary: string[] = [], secondary: string[] = []): MuscleGroup[] {
  const mapped = [...primary, ...secondary].map((muscle) => muscleMap[muscle.toLocaleLowerCase('en-US')]).filter((muscle): muscle is MuscleGroup => Boolean(muscle))
  const unique = [...new Set(mapped)].slice(0, 4)
  return unique.length ? unique : ['core']
}

function mapRepDbExercise(exercise: RepDbApiExercise): RepDbExercise | null {
  const startImage = toImageUrl(exercise.images?.flat?.start ?? exercise.images?.flat?.main, imageBaseUrl)
  const peakImage = toImageUrl(exercise.images?.flat?.peak ?? exercise.images?.flat?.main, imageBaseUrl)
  if (!exercise.id || !exercise.name_en || !startImage) return null
  return { id: exercise.id, name: exercise.name_en, description: exercise.description_en || 'Demonstração visual selecionada da biblioteca de exercícios.', equipment: (exercise.equipment || 'bodyweight').replaceAll('_', ' '), level: toLevel(exercise.difficulty), environment: exercise.is_bodyweight ? 'home' : 'gym', muscles: toMuscles(exercise.primary_muscles, exercise.secondary_muscles), preset: toPreset(exercise.name_en), startImage, peakImage: peakImage || startImage, source: 'repdb' }
}

function mapOpenExercise(exercise: OpenExerciseApiExercise): RepDbExercise | null {
  const startImage = toImageUrl(exercise.images?.[0], openImageBaseUrl)
  const peakImage = toImageUrl(exercise.images?.[1] ?? exercise.images?.[0], openImageBaseUrl)
  if (!exercise.id || !exercise.name || !startImage) return null
  return { id: exercise.id, name: exercise.name, description: exercise.instructions?.slice(0, 2).join(' ') || 'Demonstração visual selecionada da biblioteca aberta.', equipment: (exercise.equipment || 'bodyweight').replaceAll('_', ' '), level: toLevel(exercise.level), environment: exercise.equipment === 'body only' ? 'home' : 'gym', muscles: toMuscles(exercise.primaryMuscles, exercise.secondaryMuscles), preset: toPreset(exercise.name), startImage, peakImage: peakImage || startImage, source: 'open' }
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('catalog unavailable')
  return response.json() as Promise<unknown>
}

export async function fetchRepDbExercises(signal?: AbortSignal): Promise<RepDbExercise[]> {
  try {
    const payload = await fetchJson(catalogUrl, signal) as { exercises?: RepDbApiExercise[] }
    const catalog = (payload.exercises ?? []).flatMap((exercise) => { const mapped = mapRepDbExercise(exercise); return mapped ? [mapped] : [] })
    if (catalog.length) return catalog
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
  }
  const fallback = await fetchJson(openCatalogUrl, signal) as OpenExerciseApiExercise[]
  const catalog = fallback.flatMap((exercise) => { const mapped = mapOpenExercise(exercise); return mapped ? [mapped] : [] })
  if (!catalog.length) throw new Error('Não foi possível carregar o catálogo ampliado.')
  return catalog
}

export const repDbCreditUrl = 'https://repdb.co'
export const openExerciseDbCreditUrl = 'https://github.com/yuhonas/free-exercise-db'
export const openExerciseDbCount = 876

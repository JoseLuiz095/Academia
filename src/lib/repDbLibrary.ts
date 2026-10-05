import type { MotionPreset, MuscleGroup } from '../types'
import type { ExerciseEnvironment } from './exerciseMotionLibrary'

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
}

type RepDbApiExercise = {
  id?: string
  name_en?: string
  description_en?: string
  equipment?: string
  difficulty?: string
  is_bodyweight?: boolean
  primary_muscles?: string[]
  secondary_muscles?: string[]
  images?: { flat?: { start?: string; peak?: string; main?: string } }
}

const catalogUrl = 'https://exercise-dataset.com/exercises.json'
const imageBaseUrl = 'https://exercise-dataset.com/'

const muscleMap: Record<string, MuscleGroup | undefined> = {
  pectoralis_major: 'chest', pectoralis_minor: 'chest', chest: 'chest',
  latissimus_dorsi: 'back', upper_back: 'back', lower_back: 'back', trapezius: 'back', rhomboids: 'back', erector_spinae: 'back',
  anterior_deltoid: 'shoulders', lateral_deltoid: 'shoulders', posterior_deltoid: 'shoulders', deltoids: 'shoulders', shoulders: 'shoulders',
  biceps: 'arms', biceps_brachii: 'arms', triceps: 'arms', triceps_brachii: 'arms', forearms: 'arms', brachialis: 'arms', brachioradialis: 'arms',
  rectus_abdominis: 'core', transverse_abdominis: 'core', obliques: 'core', serratus_anterior: 'core', abs: 'core',
  glutes: 'glutes', gluteus_maximus: 'glutes', gluteus_medius: 'glutes',
  quadriceps: 'quadriceps', rectus_femoris: 'quadriceps', vastus_lateralis: 'quadriceps', vastus_medialis: 'quadriceps',
  hamstrings: 'hamstrings', biceps_femoris: 'hamstrings', semitendinosus: 'hamstrings', semimembranosus: 'hamstrings',
  calves: 'calves', gastrocnemius: 'calves', soleus: 'calves', tibialis_anterior: 'calves',
}

function toImageUrl(path?: string) { return path ? new URL(path, imageBaseUrl).toString() : '' }

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
  if (value === 'advanced') return 'advanced'
  if (value === 'intermediate') return 'intermediate'
  return 'beginner'
}

function toMuscles(source: RepDbApiExercise): MuscleGroup[] {
  const mapped = [...(source.primary_muscles ?? []), ...(source.secondary_muscles ?? [])]
    .map((muscle) => muscleMap[muscle])
    .filter((muscle): muscle is MuscleGroup => Boolean(muscle))
  const unique = [...new Set(mapped)].slice(0, 4)
  return unique.length ? unique : ['core']
}

export async function fetchRepDbExercises(signal?: AbortSignal): Promise<RepDbExercise[]> {
  const response = await fetch(catalogUrl, { signal })
  if (!response.ok) throw new Error('Não foi possível carregar o catálogo ampliado.')
  const payload = await response.json() as { exercises?: RepDbApiExercise[] }
  return (payload.exercises ?? []).flatMap((exercise) => {
    const startImage = toImageUrl(exercise.images?.flat?.start ?? exercise.images?.flat?.main)
    const peakImage = toImageUrl(exercise.images?.flat?.peak ?? exercise.images?.flat?.main)
    if (!exercise.id || !exercise.name_en || !startImage) return []
    const mapped: RepDbExercise = {
      id: exercise.id,
      name: exercise.name_en,
      description: exercise.description_en || 'Demonstração visual selecionada da biblioteca de exercícios.',
      equipment: (exercise.equipment || 'bodyweight').replaceAll('_', ' '),
      level: toLevel(exercise.difficulty),
      environment: exercise.is_bodyweight ? 'home' : 'gym',
      muscles: toMuscles(exercise),
      preset: toPreset(exercise.name_en),
      startImage,
      peakImage: peakImage || startImage,
    }
    return [mapped]
  })
}

export const repDbCreditUrl = 'https://repdb.co'

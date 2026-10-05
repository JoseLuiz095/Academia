import type { MotionPreset, MuscleGroup } from '../types'
import type { ExerciseEnvironment } from './exerciseLibraryTypes'

export type VitalExercise = {
  id: string
  name: string
  description: string
  equipment: string
  level: 'beginner' | 'intermediate' | 'advanced'
  environment: ExerciseEnvironment
  muscles: MuscleGroup[]
  preset: Exclude<MotionPreset, 'auto'>
  videoUrl: string
}

type VitalApiExercise = {
  bodyPart?: string
  equipment?: string
  id?: string
  name?: string
  target?: string
  secondaryMuscles?: string[]
  instructions?: string[]
  description?: string
  difficulty?: string
}

const localMetadataUrl = '/exercise-videos/vital/50gymworkouts.json'
const remoteMetadataUrl = 'https://pub-a63d6296f71940e5b51f4f8065d7b660.r2.dev/VitalAnimations/Free50/50gymworkouts.json'
const videoBaseUrl = '/exercise-videos/vital/'

const muscleMap: Record<string, MuscleGroup | undefined> = {
  chest: 'chest', pectorals: 'chest', pectoralis: 'chest',
  back: 'back', lats: 'back', latissimus: 'back', 'upper back': 'back', 'lower back': 'back', traps: 'back',
  shoulder: 'shoulders', shoulders: 'shoulders', delts: 'shoulders', deltoids: 'shoulders',
  biceps: 'arms', triceps: 'arms', 'upper arms': 'arms', 'lower arms': 'arms', forearms: 'arms',
  abs: 'core', core: 'core', obliques: 'core',
  glutes: 'glutes', gluteus: 'glutes',
  quads: 'quadriceps', quadriceps: 'quadriceps', 'upper legs': 'quadriceps',
  hamstrings: 'hamstrings', 'posterior chain': 'hamstrings',
  calves: 'calves', 'lower legs': 'calves',
}

function toPreset(name: string): Exclude<MotionPreset, 'auto'> {
  const value = name.toLocaleLowerCase('en-US')
  if (/squat|leg press|step.?up/.test(value)) return 'squat'
  if (/lunge|split squat/.test(value)) return 'lunge'
  if (/push.?up|bench press|chest press|fly/.test(value)) return 'pushup'
  if (/row|pulldown|pull.?up|chin.?up/.test(value)) return 'row'
  if (/deadlift|good morning|hip hinge/.test(value)) return 'deadlift'
  if (/press|raise|extension|curl/.test(value)) return 'press'
  if (/plank|crunch|sit.?up|rollout/.test(value)) return 'plank'
  return 'strength'
}

function toLevel(value?: string): VitalExercise['level'] {
  const level = value?.toLocaleLowerCase('en-US')
  if (level === 'advanced') return 'advanced'
  if (level === 'intermediate') return 'intermediate'
  return 'beginner'
}

function toMuscles(source: VitalApiExercise): MuscleGroup[] {
  const values = [source.target, ...(source.secondaryMuscles ?? [])]
    .filter(Boolean)
    .flatMap((value) => {
      const normalized = value!.toLocaleLowerCase('en-US')
      return [muscleMap[normalized], ...Object.entries(muscleMap).filter(([key]) => normalized.includes(key)).map(([, muscle]) => muscle)]
    })
    .filter((muscle): muscle is MuscleGroup => Boolean(muscle))
  const unique = [...new Set(values)].slice(0, 4)
  return unique.length ? unique : ['core']
}

export async function fetchVitalExercises(signal?: AbortSignal): Promise<VitalExercise[]> {
  let response = await fetch(localMetadataUrl, { signal })
  if (!response.ok) response = await fetch(remoteMetadataUrl, { signal })
  if (!response.ok) throw new Error('Não foi possível carregar as animações HD 3D locais.')
  const payload = await response.json() as VitalApiExercise[]
  return payload.flatMap((exercise) => {
    if (!exercise.id || !exercise.name) return []
    const instructions = exercise.instructions?.slice(0, 2).join(' ')
    const description = exercise.description || instructions || 'Animação HD 3D selecionada da biblioteca de exercícios.'
    const mapped: VitalExercise = {
      id: exercise.id,
      name: exercise.name,
      description,
      equipment: (exercise.equipment || 'Equipamento de academia').replaceAll('_', ' '),
      level: toLevel(exercise.difficulty),
      environment: 'gym',
      muscles: toMuscles(exercise),
      preset: toPreset(exercise.name),
      videoUrl: new URL(`${exercise.id}.mp4`, videoBaseUrl).toString(),
    }
    return [mapped]
  })
}

export const vitalCreditUrl = 'https://vitalanimations.com'
export const vitalExerciseCount = 50

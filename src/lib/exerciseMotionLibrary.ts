import type { MotionPreset, MuscleGroup } from '../types'

export type ExerciseMotionDefinition = {
  id: string
  name: string
  description: string
  preset: Exclude<MotionPreset, 'auto'>
  muscles: MuscleGroup[]
  equipment: string
  level: 'beginner' | 'intermediate' | 'advanced'
}

export const EXERCISE_MOTION_LIBRARY: ExerciseMotionDefinition[] = [
  { id: 'squat', name: 'Agachamento livre', description: 'Flexão e extensão de joelhos e quadril.', preset: 'squat', muscles: ['quadriceps', 'glutes', 'core'], equipment: 'Peso corporal ou barra', level: 'beginner' },
  { id: 'lunge', name: 'Afundo alternado', description: 'Passada com controle de joelho e quadril.', preset: 'lunge', muscles: ['quadriceps', 'glutes', 'hamstrings'], equipment: 'Peso corporal ou halteres', level: 'beginner' },
  { id: 'bench-press', name: 'Supino reto', description: 'Empurrar a carga com estabilidade dos ombros.', preset: 'pushup', muscles: ['chest', 'shoulders', 'arms'], equipment: 'Banco e barra ou halteres', level: 'intermediate' },
  { id: 'push-up', name: 'Flexão de braços', description: 'Empurrar o corpo mantendo o tronco alinhado.', preset: 'pushup', muscles: ['chest', 'shoulders', 'arms', 'core'], equipment: 'Peso corporal', level: 'beginner' },
  { id: 'row', name: 'Remada curvada', description: 'Puxar a carga em direção ao tronco.', preset: 'row', muscles: ['back', 'arms', 'core'], equipment: 'Barra ou halteres', level: 'intermediate' },
  { id: 'deadlift', name: 'Levantamento terra', description: 'Extensão de quadril com coluna estabilizada.', preset: 'deadlift', muscles: ['hamstrings', 'glutes', 'back', 'core'], equipment: 'Barra ou kettlebell', level: 'advanced' },
  { id: 'shoulder-press', name: 'Desenvolvimento com halteres', description: 'Empurrar os pesos acima da cabeça.', preset: 'press', muscles: ['shoulders', 'arms', 'core'], equipment: 'Halteres', level: 'intermediate' },
  { id: 'plank', name: 'Prancha frontal', description: 'Isometria com estabilização de tronco.', preset: 'plank', muscles: ['core', 'shoulders'], equipment: 'Peso corporal', level: 'beginner' },
  { id: 'cat-cow', name: 'Alongamento gato-vaca', description: 'Mobilidade suave da coluna em quatro apoios.', preset: 'strength', muscles: ['core', 'back'], equipment: 'Peso corporal', level: 'beginner' },
  { id: 'lateral-raise', name: 'Elevação lateral', description: 'Elevar os braços até a linha dos ombros.', preset: 'press', muscles: ['shoulders', 'arms'], equipment: 'Halteres leves', level: 'beginner' },
]

export function findExerciseMotion(id?: string | null) {
  return EXERCISE_MOTION_LIBRARY.find((exercise) => exercise.id === id) ?? null
}

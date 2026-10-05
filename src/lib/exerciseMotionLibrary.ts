import type { MotionPreset, MuscleGroup } from '../types'

export type ExerciseEnvironment = 'home' | 'gym' | 'both'
export type ExerciseMotionDefinition = {
  id: string
  name: string
  description: string
  preset: Exclude<MotionPreset, 'auto'>
  muscles: MuscleGroup[]
  equipment: string
  level: 'beginner' | 'intermediate' | 'advanced'
  environment: ExerciseEnvironment
  modelUrl: string
}

const model = (id: string) => `/exercise-models/${id}.glb`

// OpenGym3D Exercise Pack (MIT). See public/exercise-models/OPENGYM3D-LICENSE.txt.
export const EXERCISE_MOTION_LIBRARY: ExerciseMotionDefinition[] = [
  { id: 'squat', name: 'Agachamento livre', description: 'Agachamento com peso corporal e controle de joelhos.', preset: 'squat', muscles: ['quadriceps', 'glutes', 'hamstrings', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('squat') },
  { id: 'sumo-squat', name: 'Agachamento sumô', description: 'Base ampla com ênfase em quadríceps e glúteos.', preset: 'squat', muscles: ['quadriceps', 'glutes', 'hamstrings', 'core'], equipment: 'Halter opcional', level: 'beginner', environment: 'both', modelUrl: model('sumo_squat') },
  { id: 'lunge', name: 'Afundo à frente', description: 'Passada controlada para pernas e glúteos.', preset: 'lunge', muscles: ['quadriceps', 'glutes', 'hamstrings', 'calves', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('lunge') },
  { id: 'reverse-lunge', name: 'Afundo reverso', description: 'Passada para trás com estabilidade de quadril.', preset: 'lunge', muscles: ['quadriceps', 'glutes', 'hamstrings', 'calves', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('reverse_lunge') },
  { id: 'deadlift', name: 'Levantamento terra', description: 'Dobradiça de quadril com barra.', preset: 'deadlift', muscles: ['hamstrings', 'glutes', 'back', 'core', 'arms'], equipment: 'Barra', level: 'intermediate', environment: 'gym', modelUrl: model('deadlift') },
  { id: 'romanian-deadlift', name: 'Terra romeno', description: 'Dobradiça de quadril com foco em posteriores.', preset: 'deadlift', muscles: ['hamstrings', 'glutes', 'back', 'core', 'arms'], equipment: 'Barra', level: 'intermediate', environment: 'gym', modelUrl: model('romanian_deadlift') },
  { id: 'good-morning', name: 'Good morning', description: 'Dobradiça de quadril com barra apoiada.', preset: 'deadlift', muscles: ['hamstrings', 'glutes', 'back', 'core'], equipment: 'Barra', level: 'intermediate', environment: 'gym', modelUrl: model('good_morning') },
  { id: 'bent-over-row', name: 'Remada curvada', description: 'Puxada horizontal com barra e tronco inclinado.', preset: 'row', muscles: ['back', 'arms', 'core'], equipment: 'Barra', level: 'intermediate', environment: 'gym', modelUrl: model('bent_over_row') },
  { id: 'push-up', name: 'Flexão de braços', description: 'Empurrar o corpo mantendo o tronco alinhado.', preset: 'pushup', muscles: ['chest', 'shoulders', 'arms', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('push_up') },
  { id: 'plank', name: 'Prancha frontal', description: 'Isometria de tronco e ombros.', preset: 'plank', muscles: ['core', 'shoulders', 'glutes'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('plank') },
  { id: 'crunch', name: 'Abdominal curto', description: 'Flexão curta de tronco com controle cervical.', preset: 'plank', muscles: ['core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('crunch') },
  { id: 'glute-bridge', name: 'Ponte de glúteos', description: 'Extensão de quadril no solo.', preset: 'strength', muscles: ['glutes', 'hamstrings', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('glute_bridge') },
  { id: 'superman', name: 'Superman', description: 'Extensão de tronco em decúbito ventral.', preset: 'strength', muscles: ['back', 'glutes', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('superman') },
  { id: 'wall-sit', name: 'Cadeira na parede', description: 'Isometria de pernas com apoio na parede.', preset: 'squat', muscles: ['quadriceps', 'glutes', 'core'], equipment: 'Parede', level: 'beginner', environment: 'home', modelUrl: model('wall_sit') },
  { id: 'calf-raise', name: 'Elevação de panturrilhas', description: 'Elevação controlada na ponta dos pés.', preset: 'strength', muscles: ['calves', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('calf_raise') },
  { id: 'high-knees', name: 'Joelhos altos', description: 'Cardio com corrida estacionária e joelhos elevados.', preset: 'strength', muscles: ['quadriceps', 'calves', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('high_knees') },
  { id: 'jumping-jack', name: 'Polichinelo', description: 'Movimento cardiovascular de corpo inteiro.', preset: 'strength', muscles: ['shoulders', 'calves', 'core'], equipment: 'Peso corporal', level: 'beginner', environment: 'home', modelUrl: model('jumping_jack') },
  { id: 'bicep-curl', name: 'Rosca direta', description: 'Flexão de cotovelos com halteres.', preset: 'strength', muscles: ['arms'], equipment: 'Halteres', level: 'beginner', environment: 'both', modelUrl: model('bicep_curl') },
  { id: 'hammer-curl', name: 'Rosca martelo', description: 'Flexão de cotovelos com pegada neutra.', preset: 'strength', muscles: ['arms'], equipment: 'Halteres', level: 'beginner', environment: 'both', modelUrl: model('hammer_curl') },
  { id: 'lateral-raise', name: 'Elevação lateral', description: 'Elevação dos braços para os ombros.', preset: 'press', muscles: ['shoulders', 'arms'], equipment: 'Halteres', level: 'beginner', environment: 'both', modelUrl: model('lateral_raise') },
  { id: 'front-raise', name: 'Elevação frontal', description: 'Elevação frontal de halteres com tronco estável.', preset: 'press', muscles: ['shoulders', 'arms', 'core'], equipment: 'Halteres', level: 'beginner', environment: 'both', modelUrl: model('front_raise') },
  { id: 'dumbbell-shoulder-press', name: 'Desenvolvimento com halteres', description: 'Empurrar os pesos acima da cabeça.', preset: 'press', muscles: ['shoulders', 'arms', 'core'], equipment: 'Halteres', level: 'intermediate', environment: 'both', modelUrl: model('dumbbell_shoulder_press') },
  { id: 'overhead-press', name: 'Desenvolvimento com barra', description: 'Press acima da cabeça com barra.', preset: 'press', muscles: ['shoulders', 'arms', 'core'], equipment: 'Barra', level: 'intermediate', environment: 'gym', modelUrl: model('overhead_press') },
  { id: 'overhead-tricep-extension', name: 'Tríceps francês', description: 'Extensão acima da cabeça com halter.', preset: 'press', muscles: ['arms', 'shoulders'], equipment: 'Halter', level: 'intermediate', environment: 'both', modelUrl: model('overhead_tricep_extension') },
]

export const exerciseEnvironmentLabel: Record<ExerciseEnvironment, string> = { home: 'Casa', gym: 'Academia', both: 'Casa e academia' }

export function findExerciseMotion(id?: string | null) {
  return EXERCISE_MOTION_LIBRARY.find((exercise) => exercise.id === id) ?? null
}

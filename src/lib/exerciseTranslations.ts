import type { MuscleGroup } from '../types'

const exactTranslations: Record<string, string> = {
  'barbell back squat': 'Agachamento livre com barra',
  'barbell front squat': 'Agachamento frontal com barra',
  'barbell romanian deadlift': 'Levantamento terra romeno com barra',
  'barbell hip thrust': 'Elevação pélvica com barra',
  'dumbbell goblet squat': 'Agachamento goblet com halter',
  'dumbbell bulgarian split squat': 'Agachamento búlgaro com halteres',
  'dumbbell jump squat': 'Agachamento com salto e halteres',
  'cable leg kickback': 'Coice no cabo',
  'leg press machine': 'Leg press',
  'leg extension machine': 'Cadeira extensora',
  'lying leg curl machine': 'Mesa flexora',
  'seated leg curl machine': 'Cadeira flexora',
  'hack squat machine': 'Hack squat',
  'barbell bench press': 'Supino reto com barra',
  'dumbbell bench press': 'Supino reto com halteres',
  'incline barbell bench press': 'Supino inclinado com barra',
  'incline dumbbell bench press': 'Supino inclinado com halteres',
  'cable crossover': 'Crossover no cabo',
  'lat pulldown': 'Puxada na frente',
  'pull up': 'Barra fixa',
  'chin up': 'Barra fixa supinada',
  'seated cable row': 'Remada baixa no cabo',
  'barbell bent over row': 'Remada curvada com barra',
  'dumbbell lateral raise': 'Elevação lateral com halteres',
  'dumbbell front raise': 'Elevação frontal com halteres',
  'dumbbell shoulder press': 'Desenvolvimento com halteres',
  'barbell shoulder press': 'Desenvolvimento com barra',
  'cable triceps pushdown': 'Tríceps na polia',
  'dumbbell biceps curl': 'Rosca direta com halteres',
  'barbell biceps curl': 'Rosca direta com barra',
  'bodyweight squat': 'Agachamento livre',
  'bodyweight lunge': 'Afundo com peso corporal',
  'walking lunge': 'Passada caminhando',
  'push up': 'Flexão de braços',
  'plank': 'Prancha',
  'front plank': 'Prancha frontal',
  'crunch': 'Abdominal curto',
  'russian twist': 'Abdominal russo',
  'mountain climber': 'Escalador',
  'burpee': 'Burpee',
  'standing calf raise': 'Elevação de panturrilha em pé',
  'seated calf raise': 'Elevação de panturrilha sentado',
}

const vitalTitlesById: Record<string, string> = {
  '0051': 'Voador peitoral na máquina', '0052': 'Svend press para peitoral', '0053': 'Bicicleta de resistência — sprint', '0054': 'Agachamento livre com barra', '0055': 'Agachamento búlgaro com barra',
  '0056': 'Agachamento frontal com barra', '0057': 'Elevação pélvica com barra', '0058': 'Marcha com barra', '0059': 'Afundo reverso com barra', '0060': 'Levantamento terra romeno com barra',
  '0061': 'Coice no cabo', '0062': 'Bicicleta ergométrica', '0063': 'Agachamento búlgaro com halteres', '0064': 'Agachamento goblet com halter', '0065': 'Levantamento terra com halteres',
  '0066': 'Agachamento com salto e halteres', '0067': 'Elíptico em ritmo HIIT', '0068': 'Hack squat na máquina', '0069': 'Máquina abdutora', '0070': 'Marcha com kettlebell',
  '0071': 'Elevação com kettlebell', '0072': 'Balanço com kettlebell', '0073': 'Cadeira extensora', '0074': 'Leg press', '0075': 'Mesa flexora',
  '0076': 'Ondas com corda naval', '0077': 'Remo ergométrico', '0078': 'Corrida na esteira', '0079': 'Cadeira flexora', '0080': 'Desenvolvimento sentado',
  '0081': 'Subida no banco com carga', '0082': 'Escada ergométrica', '0083': 'Escada ergométrica', '0084': 'Stiff na máquina', '0085': 'Tríceps na corda',
  '0086': 'Caminhada na esteira', '0087': 'Desenvolvimento Arnold com halteres', '0088': 'Desenvolvimento em pé com barra', '0089': 'Remada alta com barra', '0090': 'Desenvolvimento com halteres',
  '0091': 'Remada alta com halteres', '0092': 'Elevação frontal com halteres', '0093': 'Elevação frontal com anilha', '0094': 'Desenvolvimento com kettlebell', '0095': 'Elevação lateral cruzada no cabo',
  '0096': 'Elevação lateral com halteres', '0097': 'Elevação lateral na máquina', '0098': 'Desenvolvimento militar sentado no Smith', '0099': 'Voador inverso na máquina', '0100': 'Voador inverso no cabo',
}

Object.assign(exactTranslations, {
  'pec deck machine fly': vitalTitlesById['0051'], 'svend press chest': vitalTitlesById['0052'], 'air bike sprint': vitalTitlesById['0053'], 'barbell back squat': vitalTitlesById['0054'], 'barbell bulgarian split squat': vitalTitlesById['0055'],
  'barbell front squat': vitalTitlesById['0056'], 'barbell hip thrust': vitalTitlesById['0057'], 'barbell march': vitalTitlesById['0058'], 'barbell reverse lunges': vitalTitlesById['0059'], 'barbell romanian deadlift': vitalTitlesById['0060'],
  'cable leg kickback': vitalTitlesById['0061'], cycling: vitalTitlesById['0062'], 'dumbbell bulgarian split squat': vitalTitlesById['0063'], 'dumbbell goblet squat': vitalTitlesById['0064'], 'dumbbell hip hinge': vitalTitlesById['0065'],
  'dumbbell jump squat': vitalTitlesById['0066'], 'elliptical hiit machine': vitalTitlesById['0067'], 'hack squat machine': vitalTitlesById['0068'], 'hip abduction machine': vitalTitlesById['0069'], 'kettlebell hold march': vitalTitlesById['0070'],
  'kettlebell lift up': vitalTitlesById['0071'], 'kettlebell swing': vitalTitlesById['0072'], 'leg extension machine': vitalTitlesById['0073'], 'leg press machine': vitalTitlesById['0074'], 'lying leg curl machine': vitalTitlesById['0075'],
  'rope wave': vitalTitlesById['0076'], 'rowing machine': vitalTitlesById['0077'], 'run on treadmill': vitalTitlesById['0078'], 'seated leg curl machine': vitalTitlesById['0079'], 'seated overhead press': vitalTitlesById['0080'],
  'step-ups (weighted)': vitalTitlesById['0081'], 'stepmill machine version 1': vitalTitlesById['0082'], 'stepmill machine': vitalTitlesById['0083'], 'stiff-legged deadlift machine': vitalTitlesById['0084'], 'triceps pushdown (cable - rope)': vitalTitlesById['0085'],
  'walk on treadmill': vitalTitlesById['0086'], 'arnold press dumbbell': vitalTitlesById['0087'], 'barbell overhead press standing': vitalTitlesById['0088'], 'barbell upright row': vitalTitlesById['0089'], 'dumbbell overhead standard': vitalTitlesById['0090'],
  'dumbbell upright row': vitalTitlesById['0091'], 'front raise (dumbbell)': vitalTitlesById['0092'], 'front raise (weighted plate)': vitalTitlesById['0093'], 'kettlebell overhead press': vitalTitlesById['0094'], 'cable cross lateral raise': vitalTitlesById['0095'],
  'lateral raises (dumbbell)': vitalTitlesById['0096'], 'lateral raise machine': vitalTitlesById['0097'], 'military press (seated - smith machine)': vitalTitlesById['0098'], 'rear delt fly (reverse pec deck)': vitalTitlesById['0099'], 'rear delt cable fly': vitalTitlesById['0100'],
})

export function displayExerciseName(value: string, exerciseLibraryId?: string | null, customTitle = false) {
  if (customTitle || !exerciseLibraryId?.startsWith('vital:')) return value
  return vitalTitlesById[exerciseLibraryId.slice('vital:'.length)] ?? value
}

const phraseTranslations: Array<[RegExp, string]> = [
  [/3\/4 sit[- ]?up/gi, 'abdominal 3/4'],
  [/90\/90 hamstring/gi, 'alongamento 90/90 de posterior de coxa'],
  [/ab crunch machine/gi, 'abdominal na máquina'],
  [/ab roller/gi, 'abdominal com roda'],
  [/adductor(?:\/groin)?/gi, 'adutor e virilha'],
  [/air bike/gi, 'bicicleta de resistência'],
  [/quad stretch/gi, 'alongamento de quadríceps'],
  [/hammer curl/gi, 'rosca martelo'],
  [/heel touchers/gi, 'abdominal tocando os calcanhares'],
  [/ankle circles/gi, 'círculos de tornozelo'],
  [/arm circles/gi, 'círculos com os braços'],
  [/arnold dumbbell press/gi, 'desenvolvimento Arnold com halteres'],
  [/back flyes?/gi, 'voador para costas'],
  [/good morning/gi, 'bom dia'],
  [/hip adductions?/gi, 'adução de quadril'],
  [/pull apart/gi, 'abertura com elástico'],
  [/skull crusher/gi, 'tríceps testa'],
  [/glute bridge/gi, 'ponte de glúteos'],
  [/rear delt/gi, 'deltoide posterior'],
  [/shoulder shrug/gi, 'encolhimento de ombros'],
  [/side bend/gi, 'inclinação lateral'],
  [/side split squat/gi, 'agachamento lateral'],
  [/step ups?/gi, 'subida no banco'],
  [/walking lunge/gi, 'passada caminhando'],
  [/battle? ropes?/gi, 'cordas navais'],
  [/bench dips?/gi, 'mergulho no banco'],
  [/box jump/gi, 'salto na caixa'],
  [/box squat/gi, 'agachamento no banco'],
  [/butt[- ]?ups?/gi, 'elevação de quadril'],
  [/butterfly/gi, 'voador'],
  [/cable hammer curls?/gi, 'rosca martelo no cabo'],
  [/cable preacher curl/gi, 'rosca Scott no cabo'],
  [/cable reverse crunch/gi, 'abdominal reverso no cabo'],
  [/cable russian twists?/gi, 'abdominal russo no cabo'],
  [/wrist curl/gi, 'rosca de punho'],
  [/calf press/gi, 'pressão de panturrilha'],
  [/calf raises?/gi, 'elevação de panturrilha'],
  [/cycling, stationary|bicycling, stationary/gi, 'bicicleta ergométrica'],
  [/bicycling/gi, 'bicicleta'],
  [/stretch/gi, 'alongamento'],
  [/throw/gi, 'arremesso'],
  [/drag/gi, 'arrasto'],
  [/crawl/gi, 'deslocamento'],
  [/clean/gi, 'arremesso para o alto'],
  [/windmill/gi, 'moinho de vento'],
  [/rollout/gi, 'abdominal com rolagem'],
  [/pullover/gi, 'pullover'],
  [/flyes?/gi, 'voador'],
  [/shrug/gi, 'encolhimento'],
  [/kickback/gi, 'coice'],
  [/kick/gi, 'chute'],
  [/adduction/gi, 'adução'],
  [/abduction/gi, 'abdução'],
  [/extension/gi, 'extensão'],
  [/romanian deadlift/gi, 'levantamento terra romeno'],
  [/stiff[- ]leg(?:ged)? deadlift/gi, 'levantamento terra com pernas estendidas'],
  [/deadlift/gi, 'levantamento terra'],
  [/hip thrust/gi, 'elevação pélvica'],
  [/leg press/gi, 'leg press'],
  [/leg extension/gi, 'cadeira extensora'],
  [/leg curl/gi, 'flexão de joelhos'],
  [/hack squat/gi, 'hack squat'],
  [/front squat/gi, 'agachamento frontal'],
  [/back squat/gi, 'agachamento livre'],
  [/split squat/gi, 'agachamento unilateral'],
  [/squat/gi, 'agachamento'],
  [/lunge/gi, 'afundo'],
  [/bench press/gi, 'supino'],
  [/chest press/gi, 'supino na máquina'],
  [/chest fly|pec deck/gi, 'voador para peito'],
  [/pulldown/gi, 'puxada'],
  [/pull[- ]?up/gi, 'barra fixa'],
  [/chin[- ]?up/gi, 'barra fixa supinada'],
  [/cable row|seated row/gi, 'remada no cabo'],
  [/bent[- ]over row/gi, 'remada curvada'],
  [/row/gi, 'remada'],
  [/shoulder press/gi, 'desenvolvimento'],
  [/lateral raise/gi, 'elevação lateral'],
  [/front raise/gi, 'elevação frontal'],
  [/reverse fly/gi, 'voador inverso'],
  [/triceps pushdown|tricep pushdown/gi, 'tríceps na polia'],
  [/triceps extension|tricep extension/gi, 'extensão de tríceps'],
  [/biceps curl|bicep curl/gi, 'rosca para bíceps'],
  [/calf raise/gi, 'elevação de panturrilha'],
  [/push[- ]?up/gi, 'flexão de braços'],
  [/crunch/gi, 'abdominal curto'],
  [/sit[- ]?up/gi, 'abdominal'],
  [/plank/gi, 'prancha'],
  [/mountain climber/gi, 'escalador'],
  [/step[- ]?up/gi, 'subida no banco'],
  [/barbell/gi, 'com barra'],
  [/dumbbells?/gi, 'com halteres'],
  [/kettlebell/gi, 'com kettlebell'],
  [/cable/gi, 'no cabo'],
  [/machine/gi, 'na máquina'],
  [/body ?weight|body ?only/gi, 'com peso corporal'],
  [/seated/gi, 'sentado'],
  [/standing/gi, 'em pé'],
  [/lying/gi, 'deitado'],
  [/incline/gi, 'inclinado'],
  [/decline/gi, 'declinado'],
  [/single arm|one arm/gi, 'unilateral'],
  [/alternating/gi, 'alternado'],
  [/assisted/gi, 'assistido'],
  [/advanced/gi, 'avançado'],
  [/beginner/gi, 'iniciante'],
  [/incline bench/gi, 'supino inclinado'],
  [/medium grip/gi, 'pegada média'],
  [/wide grip/gi, 'pegada aberta'],
  [/left/gi, 'esquerdo'],
  [/right/gi, 'direito'],
]

const equipmentTranslations: Array<[RegExp, string]> = [
  [/body ?only|body ?weight/gi, 'Peso corporal'],
  [/barbell/gi, 'Barra'],
  [/dumbbells?/gi, 'Halteres'],
  [/cable/gi, 'Cabo'],
  [/machine/gi, 'Máquina'],
  [/kettlebells?/gi, 'Kettlebell'],
  [/bands?/gi, 'Elásticos'],
  [/medicine ball/gi, 'Bola medicinal'],
  [/ez bar/gi, 'Barra W'],
  [/smith machine/gi, 'Máquina Smith'],
  [/treadmill/gi, 'Esteira'],
  [/stationary bike|cycling/gi, 'Bicicleta ergométrica'],
]

const muscleLabels: Record<MuscleGroup, string> = {
  chest: 'peitoral',
  back: 'costas',
  shoulders: 'ombros',
  arms: 'braços',
  core: 'core',
  glutes: 'glúteos',
  quadriceps: 'quadríceps',
  hamstrings: 'posterior de coxa',
  calves: 'panturrilhas',
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('en-US').replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ')
}

function titleCase(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('pt-BR'))
}

export function translateExerciseName(value: string) {
  const source = value.trim()
  const exact = exactTranslations[normalize(source)]
  if (exact) return exact
  let translated = source.toLocaleLowerCase('en-US')
  for (const [pattern, replacement] of phraseTranslations) translated = translated.replace(pattern, replacement)
  translated = translated.replace(/\s+([,])/g, '$1').replace(/\s{2,}/g, ' ').replace(/^com halteres (.+)$/i, '$1 com halteres')
  return titleCase(translated)
}

export function translateEquipment(value?: string | null) {
  const source = (value || '').trim()
  if (!source) return 'Peso corporal'
  let translated = source
  for (const [pattern, replacement] of equipmentTranslations) translated = translated.replace(pattern, replacement)
  return titleCase(translated.replace(/_/g, ' '))
}

export function translateLevel(value?: string | null): 'beginner' | 'intermediate' | 'advanced' {
  const level = normalize(value || '')
  if (level === 'advanced' || level === 'expert' || level === 'avançado') return 'advanced'
  if (level === 'intermediate' || level === 'intermediário') return 'intermediate'
  return 'beginner'
}

export function buildExerciseDescription(name: string, muscles: MuscleGroup[], equipment?: string | null) {
  const activation = muscles.length ? muscles.map((muscle) => muscleLabels[muscle]).join(', ') : 'o movimento completo'
  const tool = translateEquipment(equipment).toLocaleLowerCase('pt-BR')
  return `Demonstração de ${name.toLocaleLowerCase('pt-BR')} com ${tool}, com foco em ${activation}. Ajuste a carga, a amplitude e o ritmo ao seu nível.`
}

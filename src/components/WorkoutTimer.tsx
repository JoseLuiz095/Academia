import { useEffect, useState, type CSSProperties } from 'react'
import { BuiltInExerciseMotion, defaultMuscles, inferMotionPreset, muscleGroupLabels } from './ExerciseMotion'
import { ExerciseSequence } from './ExerciseSequence'
import { ExerciseVideo } from './ExerciseVideo'
import type { MotionType, Product, ProductContentItem } from '../types'

function formatTime(value: number) {
  const minutes = Math.floor(Math.max(0, value) / 60).toString().padStart(2, '0')
  const seconds = Math.max(0, value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function WorkoutMovement({ item, running, resting }: { item: ProductContentItem; running: boolean; resting: boolean }) {
  const type: MotionType = item.motion_type ?? 'embedded'
  if (item.motion_url && type === 'video') return <ExerciseVideo title={item.title} src={item.motion_url} autoPlay={running && !resting} controls badge="Movimento HD" />
  if (item.motion_url && type === 'sequence') return <ExerciseSequence title={item.motion_label || item.title} startImage={item.motion_url} peakImage={item.motion_poster} focus />
  if (item.motion_url && type === 'gif') return <div className="motion-frame workout-image-motion"><span className="motion-badge">Movimento guiado</span><img src={item.motion_url} alt={item.motion_label || item.title} loading="eager" /></div>
  if (item.image_url) return <div className="motion-frame workout-image-motion"><span className="motion-badge">Demonstração</span><img src={item.image_url} alt={item.motion_label || item.title} loading="eager" /></div>
  return <BuiltInExerciseMotion item={item} />
}

export function WorkoutTimer({ product, onSessionChange }: { product: Product; onSessionChange?: (active: boolean) => void }) {
  const settings = product.content?.workout_settings
  const items = product.content?.items?.filter((item) => item.title.trim()) ?? []
  const [totalMinutes, setTotalMinutes] = useState(settings?.duration_minutes ?? 45)
  const [exerciseSeconds, setExerciseSeconds] = useState(settings?.exercise_seconds ?? 40)
  const [restSeconds, setRestSeconds] = useState(settings?.rest_seconds ?? 20)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)

  const totalSeconds = Math.max(300, totalMinutes * 60)
  const cycleSeconds = Math.max(5, exerciseSeconds + restSeconds)
  const itemCount = Math.max(1, items.length)
  const rounds = Math.max(1, Math.ceil(totalSeconds / cycleSeconds))
  const currentCycle = Math.min(Math.floor(elapsed / cycleSeconds), Math.max(0, rounds - 1))
  const phaseElapsed = elapsed % cycleSeconds
  const isResting = restSeconds > 0 && phaseElapsed >= exerciseSeconds && elapsed < totalSeconds
  const phaseLimit = isResting ? restSeconds : exerciseSeconds
  const phaseSpent = isResting ? phaseElapsed - exerciseSeconds : phaseElapsed
  const phaseRemaining = Math.max(0, phaseLimit - phaseSpent)
  const phaseProgress = Math.min(100, (phaseSpent / Math.max(1, phaseLimit)) * 100)
  const overallProgress = Math.min(100, (elapsed / totalSeconds) * 100)
  const exerciseNumber = (currentCycle % itemCount) + 1
  const activeItem = items[exerciseNumber - 1] ?? { title: 'Movimento principal', details: 'Siga a orientação do profissional.', motion_type: 'embedded' as MotionType }
  const nextItem = items[exerciseNumber % itemCount]
  const activePreset = activeItem.motion_preset && activeItem.motion_preset !== 'auto' ? activeItem.motion_preset : inferMotionPreset(activeItem.title)
  const activeMuscles = (activeItem.muscle_focus?.length ? activeItem.muscle_focus : defaultMuscles[activePreset]).map((muscle) => muscleGroupLabels[muscle]).join(' · ')
  const finished = elapsed >= totalSeconds
  const phaseLabel = finished ? 'Concluído' : isResting ? 'Descanso' : 'Execução'

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setElapsed((current) => Math.min(totalSeconds, current + 1)), 1000)
    return () => window.clearInterval(timer)
  }, [running, totalSeconds])

  useEffect(() => {
    if (elapsed >= totalSeconds && running) setRunning(false)
  }, [elapsed, running, totalSeconds])

  function startSession() { if (finished) setElapsed(0); setSessionStarted(true); setRunning(true); onSessionChange?.(true) }
  function moveExercise(direction: -1 | 1) { setElapsed(Math.min(totalSeconds, Math.max(0, (currentCycle + direction) * cycleSeconds))) }

  if (sessionStarted) return <section className="workout-session" aria-label="Treino em andamento">
    <div className="workout-session-topbar"><div><span className="panel-kicker">Treino em andamento</span><strong>{product.name}</strong></div><button type="button" className="text-button" onClick={() => { setRunning(false); setSessionStarted(false); onSessionChange?.(false) }}>Sair do modo foco</button></div>
    <div className="workout-session-grid">
      <div className="workout-session-media"><WorkoutMovement item={activeItem} running={running} resting={isResting} /></div>
      <div className="workout-session-coach">
        <div className="workout-session-phase"><span className={isResting ? 'rest' : finished ? 'done' : ''}>{phaseLabel}</span><small>Exercício {exerciseNumber} de {itemCount}</small></div>
        <h2>{activeItem.title}</h2>
        <p>{isResting ? 'Recupere o fôlego. O próximo movimento aparece ao final da pausa.' : activeItem.details || 'Mantenha a execução controlada e respeite seus limites.'}</p>
        <div className="workout-session-muscles"><span>Ativação</span><strong>{activeMuscles}</strong></div>
        <div className="workout-phase-clock" style={{ '--phase-progress': `${phaseProgress * 3.6}deg` } as CSSProperties}><div><strong>{finished ? '✓' : formatTime(phaseRemaining)}</strong><small>{finished ? 'Treino concluído' : phaseLabel}</small></div></div>
        <div className="workout-session-controls"><button type="button" className="secondary-button" onClick={() => moveExercise(-1)} disabled={currentCycle === 0}>← Anterior</button><button type="button" className="primary-button" onClick={() => { if (finished) { setElapsed(0); setRunning(true) } else setRunning((value) => !value) }}>{finished ? 'Recomeçar' : running ? 'Pausar' : 'Continuar'} <span>{running ? 'Ⅱ' : '▶'}</span></button><button type="button" className="secondary-button" onClick={() => moveExercise(1)} disabled={finished}>Próximo →</button></div>
      </div>
    </div>
    <div className="workout-session-footer"><div className="workout-session-progress"><span style={{ width: `${overallProgress}%` }} /></div><span>Rodada {Math.min(currentCycle + 1, rounds)} de {rounds} · {totalMinutes} min planejados</span>{nextItem && !finished && <strong>Próximo: {nextItem.title}</strong>}</div>
  </section>

  return <section className="workout-timer workout-launch" aria-label="Preparação do treino">
    <div className="workout-launch-heading"><div><span className="panel-kicker">Treino guiado</span><h2>Seu treino está pronto</h2><p>Comece quando quiser. A duração e os intervalos foram planejados pelo profissional.</p></div><span className="workout-ready-badge">{itemCount} exercícios</span></div>
    <div className="workout-launch-summary"><div className="workout-launch-time"><small>Tempo estimado</small><strong>{totalMinutes}<span> min</span></strong><p>{rounds} ciclos com pausas planejadas</p></div><div className="workout-launch-stats"><span><small>Execução</small><strong>{exerciseSeconds}s</strong></span><span><small>Descanso</small><strong>{restSeconds}s</strong></span><span><small>Ritmo</small><strong>Guiado</strong></span></div></div>
    <div className="workout-launch-actions"><button type="button" className="primary-button" onClick={startSession}>Iniciar treino guiado <span>▶</span></button><span>Você poderá pausar, avançar ou adaptar o ritmo.</span></div>
    <details className="workout-adjust"><summary>Ajustar tempo do meu treino</summary><div className="form-row"><label>Total (min)<input type="number" min="5" max="180" value={totalMinutes} onChange={(event) => { setTotalMinutes(Math.min(180, Math.max(5, Number(event.target.value) || 5))); setElapsed(0) }} /></label><label>Execução (s)<input type="number" min="5" max="300" value={exerciseSeconds} onChange={(event) => { setExerciseSeconds(Math.min(300, Math.max(5, Number(event.target.value) || 5))); setElapsed(0) }} /></label><label>Descanso (s)<input type="number" min="0" max="300" value={restSeconds} onChange={(event) => { setRestSeconds(Math.min(300, Math.max(0, Number(event.target.value) || 0))); setElapsed(0) }} /></label></div><p className="field-help">A estimativa é recalculada neste dispositivo. Para uma mudança clínica ou de carga, consulte o profissional.</p></details>
  </section>
}

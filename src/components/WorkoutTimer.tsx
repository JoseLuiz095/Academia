import { useEffect, useMemo, useState } from 'react'
import type { Product } from '../types'

function formatTime(value: number) {
  const minutes = Math.floor(value / 60).toString().padStart(2, '0')
  const seconds = Math.max(0, value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function WorkoutTimer({ product }: { product: Product }) {
  const settings = product.content?.workout_settings
  const [totalMinutes, setTotalMinutes] = useState(settings?.duration_minutes ?? 45)
  const [exerciseSeconds, setExerciseSeconds] = useState(settings?.exercise_seconds ?? 40)
  const [restSeconds, setRestSeconds] = useState(settings?.rest_seconds ?? 20)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const totalSeconds = Math.max(300, totalMinutes * 60)
  const cycleSeconds = Math.max(5, exerciseSeconds + restSeconds)
  const itemCount = Math.max(1, product.content?.items?.length ?? 1)
  const currentCycle = Math.min(Math.floor(elapsed / cycleSeconds), Math.max(0, Math.ceil(totalSeconds / cycleSeconds) - 1))
  const phaseElapsed = elapsed % cycleSeconds
  const isResting = restSeconds > 0 && phaseElapsed >= exerciseSeconds
  const phaseLimit = isResting ? restSeconds : exerciseSeconds
  const phaseRemaining = Math.max(0, phaseLimit - (isResting ? phaseElapsed - exerciseSeconds : phaseElapsed))
  const progress = Math.min(100, (elapsed / totalSeconds) * 100)
  const rounds = Math.max(1, Math.ceil(totalSeconds / cycleSeconds))
  const exerciseNumber = (currentCycle % itemCount) + 1

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current >= totalSeconds) { setRunning(false); return totalSeconds }
        return current + 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, totalSeconds])

  const phaseLabel = useMemo(() => isResting ? 'Descanso' : 'Execução', [isResting])
  function reset() { setRunning(false); setElapsed(0) }

  return <section className="workout-timer" aria-label="Cronômetro do treino"><div className="workout-timer-heading"><div><span className="panel-kicker">Seu treino</span><h2>Pronto para começar?</h2><p>O padrão foi definido pelo profissional. Ajuste o ritmo se precisar.</p></div><span className={`workout-phase ${isResting ? 'rest' : 'active'}`}>{phaseLabel}</span></div><div className="workout-timer-main"><div className="workout-clock" aria-live="polite"><strong>{formatTime(phaseRemaining)}</strong><span>{running ? `${phaseLabel.toLocaleLowerCase('pt-BR')} · exercício ${exerciseNumber}` : elapsed >= totalSeconds ? 'Treino concluído' : 'Aguardando início'}</span></div><div className="workout-progress"><span style={{ width: `${progress}%` }} /></div><div className="workout-timer-stats"><span><small>Tempo total</small><strong>{totalMinutes} min</strong></span><span><small>Rodada</small><strong>{Math.min(currentCycle + 1, rounds)} / {rounds}</strong></span><span><small>Exercício</small><strong>{exerciseNumber} / {itemCount}</strong></span></div></div><div className="workout-timer-controls"><button type="button" className="primary-button" onClick={() => setRunning((value) => !value)}>{running ? 'Pausar treino' : elapsed >= totalSeconds ? 'Recomeçar treino' : 'Iniciar treino'} <span>{running ? 'Ⅱ' : '▶'}</span></button><button type="button" className="secondary-button" onClick={reset}>Reiniciar</button></div><details className="workout-adjust"><summary>Ajustar tempo do meu treino</summary><div className="form-row"><label>Total (min)<input type="number" min="5" max="180" value={totalMinutes} onChange={(event) => setTotalMinutes(Math.min(180, Math.max(5, Number(event.target.value) || 5)))} /></label><label>Execução (s)<input type="number" min="5" max="300" value={exerciseSeconds} onChange={(event) => setExerciseSeconds(Math.min(300, Math.max(5, Number(event.target.value) || 5)))} /></label><label>Descanso (s)<input type="number" min="0" max="300" value={restSeconds} onChange={(event) => setRestSeconds(Math.min(300, Math.max(0, Number(event.target.value) || 0)))} /></label></div><p className="field-help">A estimativa atual é de {rounds} rodadas de {formatTime(cycleSeconds)}. Os ajustes ficam apenas neste dispositivo.</p></details></section>
}

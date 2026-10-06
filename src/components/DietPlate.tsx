import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { DietPart } from '../types'

export const defaultDietParts: DietPart[] = [
  { name: 'Proteína', amount: '1 porção', description: 'Escolha a opção indicada pelo profissional para esta refeição.', icon: '🍗', color: '#e59b73' },
  { name: 'Carboidrato', amount: '1 porção', description: 'Ajuste a porção conforme a orientação do seu plano.', icon: '🍚', color: '#e8c477' },
  { name: 'Vegetais', amount: 'à vontade', description: 'Priorize variedade, textura e cor no prato.', icon: '🥦', color: '#86b88b' },
  { name: 'Fruta', amount: '1 porção', description: 'Uma opção prática para complementar a refeição.', icon: '🍓', color: '#d98585' },
]

const partPosition = [
  { x: '-54px', y: '-38px', openX: '-102px', openY: '-72px' },
  { x: '54px', y: '-38px', openX: '102px', openY: '-72px' },
  { x: '-54px', y: '39px', openX: '-102px', openY: '75px' },
  { x: '54px', y: '39px', openX: '102px', openY: '75px' },
  { x: '0px', y: '-70px', openX: '0px', openY: '-112px' },
  { x: '0px', y: '70px', openX: '0px', openY: '112px' },
]

function asParts(parts: DietPart[]) {
  return (parts.length ? parts : defaultDietParts).slice(0, 6)
}

export function DietPlate({ parts, compact = false }: { parts?: DietPart[] | null; compact?: boolean }) {
  const visibleParts = asParts(parts ?? [])
  const [activePart, setActivePart] = useState<number | null>(null)
  const [exploded, setExploded] = useState(false)
  const selected = activePart === null ? null : visibleParts[activePart]
  const selectPart = (index: number) => {
    const next = activePart === index ? null : index
    setActivePart(next)
    setExploded(next !== null)
  }

  return <div className={`diet-plate ${compact ? 'compact' : ''}`}>
    <div className={`diet-plate-stage ${exploded ? 'is-exploded' : ''}`} aria-label="Prato interativo com os componentes da refeição">
      <div className="diet-plate-aura" aria-hidden="true" />
      <div className="diet-plate-shadow" aria-hidden="true" />
      <div className="diet-plate-base" aria-hidden="true"><span>{selected?.icon || '🥗'}</span><strong>{selected ? selected.name : 'sua refeição'}</strong></div>
      {visibleParts.map((part, index) => {
        const position = partPosition[index] ?? partPosition[0]
        const style = { '--part-x': position.x, '--part-y': position.y, '--part-open-x': position.openX, '--part-open-y': position.openY, '--part-color': part.color || '#9bbd9d' } as CSSProperties
        const isActive = activePart === index
        return <button type="button" className={`diet-plate-part ${isActive ? 'is-open' : activePart !== null ? 'is-muted' : ''}`} style={style} key={`${part.name}-${index}`} aria-pressed={isActive} aria-label={`${part.name || 'Componente'}${part.amount ? `, ${part.amount}` : ''}`} onClick={() => selectPart(index)}><span aria-hidden="true">{part.icon || '•'}</span></button>
      })}
      <button type="button" className="diet-explode-button" onClick={() => { setExploded((value) => !value); if (exploded) setActivePart(null) }}>{exploded ? 'Montar prato' : 'Explodir prato'} <span>↗</span></button>
    </div>
    <div className="diet-plate-copy" aria-live="polite"><span className="panel-kicker">Composição interativa</span><strong>{selected ? selected.name : 'Veja o que compõe esta refeição'}</strong><p>{selected ? selected.description || `${selected.amount || 'Componente da refeição'} · ajuste apenas conforme a orientação do profissional.` : 'Toque em um ingrediente ou use “Explodir prato” para conferir as porções e orientações.'}</p>{selected?.amount && <small>{selected.amount}</small>}</div>
    <div className="diet-plate-legend" aria-label="Componentes da refeição">{visibleParts.map((part, index) => <button type="button" className={activePart === index ? 'active' : ''} key={`${part.name}-legend-${index}`} onClick={() => selectPart(index)}><i style={{ background: part.color || '#9bbd9d' }} /><span>{part.name || 'Componente'}</span></button>)}</div>
  </div>
}

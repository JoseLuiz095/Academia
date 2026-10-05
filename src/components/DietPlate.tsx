import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { DietPart } from '../types'

export const defaultDietParts: DietPart[] = [
  { name: 'Proteína', amount: '1 porção', icon: '🍗', color: '#e59b73' },
  { name: 'Carboidrato', amount: '1 porção', icon: '🍚', color: '#e8c477' },
  { name: 'Vegetais', amount: 'à vontade', icon: '🥦', color: '#86b88b' },
  { name: 'Fruta', amount: '1 porção', icon: '🍓', color: '#d98585' },
]

const partPosition = [
  { x: '-18px', y: '-14px', rotate: '-5deg' },
  { x: '18px', y: '-13px', rotate: '5deg' },
  { x: '-18px', y: '17px', rotate: '4deg' },
  { x: '18px', y: '17px', rotate: '-4deg' },
  { x: '0px', y: '0px', rotate: '0deg' },
]

function asParts(parts: DietPart[]) {
  return (parts.length ? parts : defaultDietParts).slice(0, 6)
}

export function DietPlate({ parts, compact = false }: { parts?: DietPart[] | null; compact?: boolean }) {
  const visibleParts = asParts(parts ?? [])
  const [activePart, setActivePart] = useState<number | null>(null)
  const selected = activePart === null ? null : visibleParts[activePart]
  return <div className={`diet-plate ${compact ? 'compact' : ''}`}>
    <div className="diet-plate-stage" aria-label="Prato interativo com os componentes da refeição">
      <div className="diet-plate-shadow" aria-hidden="true" />
      <div className="diet-plate-base" aria-hidden="true"><span>composição</span></div>
      {visibleParts.map((part, index) => {
        const position = partPosition[index] ?? { x: '0px', y: '0px', rotate: '0deg' }
        const style = { '--part-x': position.x, '--part-y': position.y, '--part-rotate': position.rotate, '--part-color': part.color || '#9bbd9d' } as CSSProperties
        const isActive = activePart === index
        return <button type="button" className={`diet-plate-part ${isActive ? 'is-open' : activePart !== null ? 'is-muted' : ''}`} style={style} key={`${part.name}-${index}`} aria-pressed={isActive} onClick={() => setActivePart(isActive ? null : index)}>
          <span className="diet-plate-part-icon" aria-hidden="true">{part.icon || '•'}</span>
          <span><strong>{part.name || 'Componente'}</strong>{part.amount && <small>{part.amount}</small>}</span>
        </button>
      })}
      <span className="diet-plate-hint">Toque para separar</span>
    </div>
    <div className="diet-plate-copy"><span className="panel-kicker">Prato em camadas</span><strong>{selected ? selected.name : 'Visualize a composição'}</strong><p>{selected ? `${selected.amount || 'Componente da refeição'} · toque novamente para recolher.` : 'Cada item pode ser aberto para entender a porção e o papel na refeição.'}</p></div>
    <div className="diet-plate-legend" aria-label="Componentes da refeição">{visibleParts.map((part, index) => <button type="button" className={activePart === index ? 'active' : ''} key={`${part.name}-legend-${index}`} onClick={() => setActivePart(activePart === index ? null : index)}><i style={{ background: part.color || '#9bbd9d' }} /><span>{part.name || 'Componente'}</span></button>)}</div>
  </div>
}

type Props = {
  title: string
  startImage: string
  peakImage?: string | null
  compact?: boolean
  focus?: boolean
}

export function ExerciseSequence({ title, startImage, peakImage, compact = false, focus = false }: Props) {
  const hasSecondFrame = Boolean(peakImage && peakImage !== startImage)

  return <div className={`motion-frame exercise-sequence-preview ${compact ? 'compact' : ''} ${focus ? 'focus' : ''}`}>
    <span className="motion-badge">2D guiado</span>
    <div className="sequence-visual" role="img" aria-label={`Demonstração guiada de ${title}`}>
      <span className="sequence-grid" aria-hidden="true" />
      <img className={`sequence-image ${hasSecondFrame ? 'has-second-frame' : ''}`} src={startImage} alt={title} loading={focus ? 'eager' : 'lazy'} />
      {hasSecondFrame && <img className="sequence-image sequence-image-end" src={peakImage ?? undefined} alt="" aria-hidden="true" loading="lazy" />}
      <span className="sequence-sweep" aria-hidden="true" />
    </div>
    <div className="sequence-footer" aria-hidden="true"><span>Início</span><i /><span>Retorno</span></div>
  </div>
}

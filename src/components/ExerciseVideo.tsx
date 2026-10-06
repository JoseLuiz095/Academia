import { useEffect, useRef, useState } from 'react'

type Props = {
  title: string
  src: string
  compact?: boolean
  controls?: boolean
  autoPlay?: boolean
  badge?: string
}

export function ExerciseVideo({ title, src, compact = false, controls = false, autoPlay = false, badge = 'HD 3D' }: Props) {
  const [failed, setFailed] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const className = `motion-frame exercise-video-preview ${compact ? 'compact' : ''}`
  useEffect(() => {
    if (!autoPlay || !frameRef.current) return
    if (!('IntersectionObserver' in window)) { setIsVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: '120px' })
    observer.observe(frameRef.current)
    return () => observer.disconnect()
  }, [autoPlay])
  if (!src || failed) {
    return <div ref={frameRef} className={`${className} exercise-video-fallback`} role="img" aria-label={`Prévia indisponível de ${title}`}><span className="motion-badge">{badge}</span><span className="exercise-video-fallback-icon">◌</span><strong>Prévia indisponível</strong><small>O exercício continua disponível na ficha.</small></div>
  }
  return <div ref={frameRef} className={className}><span className="motion-badge">{badge}</span><video src={src} autoPlay={autoPlay && isVisible} muted loop playsInline preload={autoPlay && isVisible ? 'metadata' : controls ? 'metadata' : 'none'} controls={controls} aria-label={`Demonstração ${badge} de ${title}`} onError={() => setFailed(true)} /></div>
}

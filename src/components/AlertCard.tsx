type AlertVariant = 'error' | 'success' | 'warning' | 'info'

type Props = {
  message: string
  title?: string
  variant?: AlertVariant
  onDismiss?: () => void
}

const variantLabels: Record<AlertVariant, string> = { error: 'Atenção', success: 'Concluído', warning: 'Confira', info: 'Informação' }
const variantIcons: Record<AlertVariant, string> = { error: '!', success: '✓', warning: '◷', info: 'i' }

export function AlertCard({ message, title, variant = 'error', onDismiss }: Props) {
  if (!message) return null
  return <aside className={`alert-card alert-card-${variant}`} role={variant === 'error' ? 'alert' : 'status'} aria-live={variant === 'error' ? 'assertive' : 'polite'}><span className="alert-card-icon" aria-hidden="true">{variantIcons[variant]}</span><div><strong>{title || variantLabels[variant]}</strong><p>{message}</p></div>{onDismiss && <button type="button" className="alert-card-close" onClick={onDismiss} aria-label="Fechar alerta">×</button>}</aside>
}

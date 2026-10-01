import { useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string
    theme?: 'light' | 'dark' | 'auto'
    size?: 'normal' | 'compact' | 'flexible'
    action?: string
    callback?: (token: string) => void
    'error-callback'?: () => void
    'expired-callback'?: () => void
    'timeout-callback'?: () => void
  }) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_ID = 'impulso-turnstile-script'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function ensureScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) { resolve(); return }
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar a proteção anti-robô.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar a proteção anti-robô.'))
    document.head.appendChild(script)
  })
}

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  resetSignal = 0,
}: {
  siteKey: string
  action: string
  onToken: (token: string) => void
  resetSignal?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef('')
  const tokenHandler = useRef(onToken)
  const [error, setError] = useState('')

  useEffect(() => { tokenHandler.current = onToken }, [onToken])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false
    void ensureScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        size: 'flexible',
        action,
        callback: (token) => { setError(''); tokenHandler.current(token) },
        'error-callback': () => { tokenHandler.current(''); setError('Não foi possível validar a proteção anti-robô.') },
        'expired-callback': () => tokenHandler.current(''),
        'timeout-callback': () => { tokenHandler.current(''); setError('A validação expirou. Faça a verificação novamente.') },
      })
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Falha ao carregar a proteção anti-robô.')
    })
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = ''
    }
  }, [action, siteKey])

  useEffect(() => {
    if (resetSignal && widgetIdRef.current && window.turnstile) {
      tokenHandler.current('')
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [resetSignal])

  return <div className="turnstile-shell"><div ref={containerRef} className="turnstile-container" />{error && <small className="turnstile-error">{error}</small>}</div>
}

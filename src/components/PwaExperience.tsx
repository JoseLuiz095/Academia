import { useEffect, useMemo, useState } from 'react'
import { isReminderEnabled, isStandaloneMode, notifyBrowser, requestNotificationPermission, setReminderEnabled, type PwaAudience } from '../lib/pwa'

type PwaExperienceProps = {
  audience: PwaAudience
  workspaceId: string
  workoutLabel?: string
  compact?: boolean
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaExperience({ audience, workspaceId, workoutLabel = 'seu próximo treino', compact = false }: PwaExperienceProps) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandaloneMode)
  const [enabled, setEnabled] = useState(() => isReminderEnabled(audience, workspaceId))
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => 'Notification' in window ? Notification.permission : 'unsupported')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    function capture(event: Event) { event.preventDefault(); setInstallEvent(event as InstallPromptEvent) }
    function installedHandler() { setInstalled(true); setInstallEvent(null) }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installedHandler)
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installedHandler) }
  }, [])

  useEffect(() => { setEnabled(isReminderEnabled(audience, workspaceId)) }, [audience, workspaceId])

  useEffect(() => {
    if (!enabled || permission !== 'granted') return
    const interval = window.setInterval(() => {
      if (audience === 'cliente') void notifyBrowser('Impulso · lembrete de cuidado', { body: 'Beba água e reserve alguns minutos para manter seu ritmo.', tag: `agua-${workspaceId}`, url: window.location.href })
      else void notifyBrowser('Impulso · novos pedidos', { body: 'Há uma pendência para conferir no seu painel.', tag: `pedidos-${workspaceId}`, url: '/admin/pedidos' })
    }, audience === 'cliente' ? 2 * 60 * 60 * 1000 : 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [audience, enabled, permission, workspaceId])

  const description = audience === 'cliente' ? 'Receba lembretes discretos de água e treino neste dispositivo. Você pode desligar quando quiser.' : 'Receba um aviso no navegador quando houver uma pendência para conferir no painel.'
  const permissionLabel = permission === 'granted' ? 'Ativas neste dispositivo' : permission === 'denied' ? 'Bloqueadas pelo navegador' : permission === 'unsupported' ? 'Não suportadas neste navegador' : 'Ainda não ativadas'
  const nextReminder = useMemo(() => audience === 'cliente' ? 'Água a cada 2 horas · treino conforme sua rotina' : 'Verificação enquanto o painel estiver aberto', [audience])

  async function activate() {
    const next = await requestNotificationPermission()
    setPermission(next)
    if (next !== 'granted') { setFeedback(next === 'denied' ? 'Permita notificações nas configurações do navegador para ativar.' : 'Este navegador não oferece notificações.'); return }
    setReminderEnabled(audience, workspaceId, true)
    setEnabled(true)
    setFeedback(audience === 'cliente' ? 'Lembretes ativados. O próximo treino fica salvo neste dispositivo.' : 'Alertas de pedidos ativados neste navegador.')
    void notifyBrowser('Impulso · notificações ativadas', { body: audience === 'cliente' ? `Você receberá lembretes para ${workoutLabel}.` : 'Você será avisado quando houver uma pendência.', tag: `ativado-${workspaceId}`, url: window.location.href })
  }

  function deactivate() { setReminderEnabled(audience, workspaceId, false); setEnabled(false); setFeedback('Lembretes desativados neste dispositivo.') }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setFeedback('Impulso instalado. Abra pelo ícone do seu celular para uma experiência mais rápida.')
    setInstallEvent(null)
  }

  return <section className={`pwa-experience ${compact ? 'compact' : ''}`} aria-label="Experiência no celular">
    <div className="pwa-experience-icon">{audience === 'cliente' ? '◌' : '◈'}</div>
    <div className="pwa-experience-copy"><span className="panel-kicker">Experiência no celular</span><h2>{audience === 'cliente' ? 'Leve seu espaço com você' : 'Alertas operacionais no navegador'}</h2><p>{description}</p><small>{permissionLabel} · {nextReminder}</small></div>
    <div className="pwa-experience-actions">{enabled ? <button type="button" className="secondary-button" onClick={deactivate}>Desativar lembretes</button> : <button type="button" className="primary-button" onClick={() => void activate()} disabled={permission === 'unsupported'}>Ativar notificações <span>↗</span></button>}{installEvent && !installed && <button type="button" className="secondary-button" onClick={() => void install()}>Instalar app</button>}{installed && <span className="pwa-installed-badge">App instalado ✓</span>}</div>
    {feedback && <p className="pwa-feedback" role="status">{feedback}</p>}
  </section>
}

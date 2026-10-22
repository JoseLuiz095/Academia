import { useEffect, useMemo, useState } from 'react'
import { getNotificationAttempt, getNotificationPermission, isReminderEnabled, isStandaloneMode, notifyBrowser, requestNotificationPermission, setReminderEnabled, startReminderScheduler, type NotificationAttempt, type NotificationPermissionState, type PwaAudience } from '../lib/pwa'

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
  const [permission, setPermission] = useState<NotificationPermissionState>(getNotificationPermission)
  const [lastAttempt, setLastAttempt] = useState<NotificationAttempt | null>(() => getNotificationAttempt(audience, workspaceId))
  const [requesting, setRequesting] = useState(false)
  const [showBlockedHelp, setShowBlockedHelp] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    function capture(event: Event) { event.preventDefault(); setInstallEvent(event as InstallPromptEvent) }
    function installedHandler() { setInstalled(true); setInstallEvent(null) }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installedHandler)
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installedHandler) }
  }, [])

  useEffect(() => {
    setEnabled(isReminderEnabled(audience, workspaceId))
    setPermission(getNotificationPermission())
    setLastAttempt(getNotificationAttempt(audience, workspaceId))
    setShowBlockedHelp(false)
  }, [audience, workspaceId])

  useEffect(() => {
    function syncPermission() {
      setPermission(getNotificationPermission())
      setLastAttempt(getNotificationAttempt(audience, workspaceId))
    }
    window.addEventListener('focus', syncPermission)
    document.addEventListener('visibilitychange', syncPermission)
    return () => { window.removeEventListener('focus', syncPermission); document.removeEventListener('visibilitychange', syncPermission) }
  }, [audience, workspaceId])

  useEffect(() => {
    if (audience !== 'cliente' || !enabled || permission !== 'granted') return
    return startReminderScheduler(audience, workspaceId, () => {
      void notifyBrowser('Impulso · lembrete de cuidado', { body: 'Beba água e reserve alguns minutos para manter seu ritmo.', tag: `agua-${workspaceId}`, url: window.location.href })
    }, 2 * 60 * 60 * 1000)
  }, [audience, enabled, permission, workspaceId])

  const description = audience === 'cliente' ? 'Receba lembretes discretos de água e treino neste dispositivo. Você pode desligar quando quiser.' : 'Receba um aviso quando a consulta dos pedidos identificar novas pendências. Você pode desligar os alertas quando quiser.'
  const permissionLabel = permission === 'granted' ? 'Disponíveis neste dispositivo' : permission === 'denied' ? 'Bloqueadas pelo navegador' : permission === 'unsupported' ? 'Não suportadas neste navegador' : 'Ainda não ativadas'
  const nextReminder = useMemo(() => audience === 'cliente' ? 'Água a cada 2 horas · treino conforme sua rotina' : 'Somente com dados carregados no painel aberto', [audience])
  const lastAttemptLabel = lastAttempt ? `Última tentativa: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(lastAttempt.attemptedAt)}` : ''

  async function activate() {
    if (permission === 'denied') { setShowBlockedHelp(true); setFeedback('As notificações estão bloqueadas. Libere o acesso nas configurações do navegador e atualize o status.'); return }
    if (permission === 'unsupported') return
    setRequesting(true)
    try {
      const next = await requestNotificationPermission(audience, workspaceId)
      setPermission(next)
      setLastAttempt(getNotificationAttempt(audience, workspaceId))
      if (next !== 'granted') {
        setFeedback(next === 'denied' ? 'As notificações foram bloqueadas. Use “Como desbloquear” para ver o próximo passo.' : 'O pedido não foi concluído. Você pode tentar novamente quando estiver pronto.')
        return
      }
      setReminderEnabled(audience, workspaceId, true)
      setEnabled(true)
      setFeedback(audience === 'cliente' ? 'Lembretes ativados. O próximo treino fica salvo neste dispositivo.' : 'Alertas de pedidos ativados neste navegador.')
      void notifyBrowser('Impulso · notificações ativadas', { body: audience === 'cliente' ? `Você receberá lembretes para ${workoutLabel}.` : 'Você será avisado quando houver uma pendência.', tag: `ativado-${workspaceId}`, url: window.location.href })
    } finally {
      setRequesting(false)
    }
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
    <div className="pwa-experience-copy"><span className="panel-kicker">Experiência no celular</span><h2>{audience === 'cliente' ? 'Leve seu espaço com você' : 'Alertas operacionais no navegador'}</h2><p>{description}</p><small>{permissionLabel} · {nextReminder}{lastAttemptLabel && ` · ${lastAttemptLabel}`}</small></div>
    <div className="pwa-experience-actions">{permission === 'denied' ? <><button type="button" className="primary-button" onClick={() => setShowBlockedHelp((current) => !current)}>{showBlockedHelp ? 'Ocultar instruções' : 'Como desbloquear'} <span>↗</span></button>{enabled && <button type="button" className="secondary-button" onClick={deactivate}>Desativar lembretes</button>}</> : enabled ? <button type="button" className="secondary-button" onClick={deactivate}>Desativar lembretes</button> : <button type="button" className="primary-button" onClick={() => void activate()} disabled={permission === 'unsupported' || requesting}>{requesting ? 'Aguardando permissão…' : 'Ativar notificações'} {!requesting && <span>↗</span>}</button>}{installEvent && !installed && <button type="button" className="secondary-button" onClick={() => void install()}>Instalar app</button>}{installed && <span className="pwa-installed-badge">App instalado ✓</span>}</div>
    {permission === 'denied' && showBlockedHelp && <div className="pwa-feedback" role="alert"><strong>Notificações bloqueadas</strong><br />Abra as configurações do navegador para este site, permita notificações e volte aqui. Depois, toque em “Atualizar status”. <button type="button" className="secondary-button" onClick={() => { setPermission(getNotificationPermission()); setShowBlockedHelp(false); setFeedback('Status das notificações atualizado.') }}>Atualizar status</button></div>}
    {feedback && <p className="pwa-feedback" role="status">{feedback}</p>}
  </section>
}

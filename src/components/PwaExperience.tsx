import { useEffect, useMemo, useState } from 'react'
import { hasReminderPreference, isReminderEnabled, isStandaloneMode, notifyBrowser, requestNotificationPermission, setReminderEnabled, type PwaAudience } from '../lib/pwa'
import { supabase } from '../lib/supabase'

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
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    function capture(event: Event) { event.preventDefault(); setInstallEvent(event as InstallPromptEvent) }
    function installedHandler() { setInstalled(true); setInstallEvent(null) }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installedHandler)
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installedHandler) }
  }, [])

  useEffect(() => { setEnabled(isReminderEnabled(audience, workspaceId)) }, [audience, workspaceId])

  useEffect(() => {
    let active = true
    async function verifyPermission() {
      const next = await requestNotificationPermission()
      if (!active) return
      setPermission(next)
      if (next === 'granted' && !hasReminderPreference(audience, workspaceId)) {
        setReminderEnabled(audience, workspaceId, true)
        setEnabled(true)
      }
    }
    void verifyPermission()
    return () => { active = false }
  }, [audience, workspaceId])

  useEffect(() => {
    if (audience !== 'admin' || permission !== 'granted' || !supabase) return
    let active = true
    const seenKey = `impulso:admin:pending-notified:${workspaceId}`

    async function checkPendingOrders() {
      const [ordersResult, bookingsResult] = await Promise.all([
        supabase!.from('orders').select('id,reference,status,total').eq('workspace_id', workspaceId).eq('status', 'pending').order('created_at', { ascending: true }).limit(30),
        supabase!.from('evaluation_bookings').select('id,order_id,status').eq('workspace_id', workspaceId).eq('status', 'awaiting_approval').limit(30),
      ])
      if (!active || ordersResult.error) return
      const pending = (ordersResult.data ?? []) as { id: string; reference: string; status: string; total: number }[]
      const awaitingBookings = bookingsResult.error ? [] : (bookingsResult.data ?? []) as { id: string; order_id: string; status: string }[]
      setPendingCount(pending.length + awaitingBookings.length)
      const pendingIds = new Set([...pending.map((order) => order.id), ...awaitingBookings.map((booking) => `booking:${booking.id}`)])
      let seen: string[] = []
      try { seen = JSON.parse(localStorage.getItem(seenKey) ?? '[]') as string[] } catch { seen = [] }
      const nextSeen = seen.filter((id) => pendingIds.has(id))
      const unseen = [
        ...pending.filter((order) => !nextSeen.includes(order.id)).map((order) => ({ key: order.id, label: order.reference })),
        ...awaitingBookings.filter((booking) => !nextSeen.includes(`booking:${booking.id}`)).map((booking) => ({ key: `booking:${booking.id}`, label: 'uma avaliação aguardando aprovação' })),
      ]
      if (!unseen.length) { localStorage.setItem(seenKey, JSON.stringify(nextSeen)); return }
      if (!enabled) return
      const message = unseen.length === 1 ? `${unseen[0].label} aguarda sua conferência.` : `${unseen.length} pendências aguardam sua conferência.`
      const shown = await notifyBrowser('Impulso · nova compra recebida', { body: message, tag: `pending-orders-${workspaceId}`, url: '/admin/pedidos' })
      if (shown) localStorage.setItem(seenKey, JSON.stringify([...nextSeen, ...unseen.map((item) => item.key)]))
    }

    void checkPendingOrders()
    const interval = window.setInterval(() => void checkPendingOrders(), 60 * 1000)
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void checkPendingOrders() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => { active = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibilityChange) }
  }, [audience, enabled, permission, workspaceId])

  useEffect(() => {
    if (!enabled || permission !== 'granted' || audience !== 'cliente') return
    const interval = window.setInterval(() => {
      void notifyBrowser('Impulso · lembrete de cuidado', { body: 'Beba água e reserve alguns minutos para manter seu ritmo.', tag: `agua-${workspaceId}`, url: window.location.href })
    }, 2 * 60 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [audience, enabled, permission, workspaceId])

  const description = audience === 'cliente' ? 'Receba lembretes discretos de água e treino neste dispositivo. Você pode desligar quando quiser.' : 'Verificamos pedidos e avaliações pendentes ao abrir o painel e enquanto ele estiver ativo.'
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

  const activationLabel = permission === 'default' ? 'Permitir notificações' : 'Ativar notificações'

  return <section className={`pwa-experience ${compact ? 'compact' : ''}`} aria-label="Experiência no celular">
    <div className="pwa-experience-icon">{audience === 'cliente' ? '◌' : '◈'}</div>
    <div className="pwa-experience-copy"><span className="panel-kicker">Experiência no celular</span><h2>{audience === 'cliente' ? 'Leve seu espaço com você' : 'Alertas operacionais no navegador'}</h2><p>{description}</p><small>{permissionLabel} · {nextReminder}</small></div>
    <div className="pwa-experience-actions">{enabled ? <button type="button" className="secondary-button" onClick={deactivate}>Desativar lembretes</button> : <button type="button" className="primary-button" onClick={() => void activate()} disabled={permission === 'unsupported'}>{activationLabel} <span>↗</span></button>}{installEvent && !installed && <button type="button" className="secondary-button" onClick={() => void install()}>Instalar app</button>}{installed && <span className="pwa-installed-badge">App instalado ✓</span>}</div>
    {audience === 'admin' && pendingCount > 0 && <a className="pwa-pending-alert plain-link" href="/admin/pedidos" role="status">{pendingCount} {pendingCount === 1 ? 'pedido aguarda' : 'pedidos aguardam'} conferência →</a>}
    {feedback && <p className="pwa-feedback" role="status">{feedback}</p>}
  </section>
}

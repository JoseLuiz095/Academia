import { useState } from 'react'
import type { ClientNotification } from '../types'

const kindLabel: Record<ClientNotification['kind'], string> = { general: 'Aviso', workout: 'Treino', diet: 'Dieta', schedule: 'Agenda', important: 'Importante' }
const kindIcon: Record<ClientNotification['kind'], string> = { general: '✦', workout: '↗', diet: '◌', schedule: '◷', important: '!' }

function notificationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Agora' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

export function ClientNotificationCenter({ notifications, onRead, onRefresh, refreshing = false }: { notifications: ClientNotification[]; onRead: (notification: ClientNotification) => void | Promise<void>; onRefresh?: () => void | Promise<void>; refreshing?: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const [readingId, setReadingId] = useState<string | null>(null)
  const unread = notifications.filter((notification) => !notification.read_at).length
  const visibleNotifications = showAll ? notifications : notifications.slice(0, 8)

  async function markAsRead(notification: ClientNotification) {
    setReadingId(notification.id)
    try { await onRead(notification) } finally { setReadingId(null) }
  }

  return <section className="student-notification-center" aria-labelledby="student-notifications-title">
    <div className="panel-heading" style={{ alignItems: 'flex-start', gap: 12 }}><div><span className="panel-kicker">Acompanhamento do profissional</span><h2 id="student-notifications-title">Avisos para você</h2><p className="field-help" style={{ margin: '5px 0 0' }}>Treinos, agenda e orientações importantes em um só lugar.</p></div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}><span className="student-notification-count" aria-live="polite">{unread ? `${unread} novo${unread === 1 ? '' : 's'}` : 'Tudo lido'}</span>{onRefresh && <button type="button" className="text-button" onClick={() => void onRefresh()} disabled={refreshing} aria-label="Atualizar avisos">{refreshing ? 'Atualizando…' : 'Atualizar'}</button>}</div></div>
    {notifications.length ? <><div className="student-notification-list" role="list">{visibleNotifications.map((notification) => <article className={`student-notification ${notification.read_at ? 'is-read' : 'is-new'}`} key={notification.id} role="listitem"><div className="student-notification-mark" aria-hidden="true">{kindIcon[notification.kind]}</div><div className="student-notification-copy"><div><span className="student-notification-kind">{kindLabel[notification.kind]}</span>{!notification.read_at && <span aria-label="Não lido" title="Não lido" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--store-primary, #f97316)' }} />}<time dateTime={notification.created_at}>{notificationDate(notification.created_at)}</time></div><strong>{notification.title}</strong><p>{notification.body}</p></div>{!notification.read_at && <button type="button" className="text-button" onClick={() => void markAsRead(notification)} disabled={readingId === notification.id} aria-label={`Marcar aviso ${notification.title} como lido`}>{readingId === notification.id ? 'Salvando…' : 'Marcar como lido'}</button>}</article>)}</div>{notifications.length > 8 && <button type="button" className="secondary-button" onClick={() => setShowAll((current) => !current)} style={{ marginTop: 12, width: '100%' }}>{showAll ? 'Mostrar menos' : `Mostrar todos os ${notifications.length} avisos`}</button>}</> : <div className="student-notification-empty" role="status"><strong>Nenhum aviso por enquanto</strong><p>Quando o profissional enviar uma orientação, ela aparecerá aqui.</p>{onRefresh && <button type="button" className="secondary-button" onClick={() => void onRefresh()} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Verificar novamente'}</button>}</div>}
    <p className="field-help">Os avisos ficam vinculados a este acesso e não expõem seus dados para outros alunos.</p>
  </section>
}

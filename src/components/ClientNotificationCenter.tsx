import type { ClientNotification } from '../types'

const kindLabel: Record<ClientNotification['kind'], string> = { general: 'Aviso', workout: 'Treino', diet: 'Dieta', schedule: 'Agenda', important: 'Importante' }

export function ClientNotificationCenter({ notifications, onRead }: { notifications: ClientNotification[]; onRead: (notification: ClientNotification) => void }) {
  const unread = notifications.filter((notification) => !notification.read_at).length
  return <section className="student-notification-center" aria-labelledby="student-notifications-title">
    <div className="panel-heading"><div><span className="panel-kicker">Acompanhamento do profissional</span><h2 id="student-notifications-title">Avisos para você</h2></div><span className="student-notification-count">{unread ? `${unread} novo${unread === 1 ? '' : 's'}` : 'Tudo lido'}</span></div>
    {notifications.length ? <div className="student-notification-list">{notifications.slice(0, 8).map((notification) => <article className={`student-notification ${notification.read_at ? 'is-read' : 'is-new'}`} key={notification.id}><div className="student-notification-mark">{notification.kind === 'workout' ? '↗' : notification.kind === 'diet' ? '◌' : notification.kind === 'schedule' ? '◷' : notification.kind === 'important' ? '!' : '✦'}</div><div className="student-notification-copy"><div><span className="student-notification-kind">{kindLabel[notification.kind]}</span><time dateTime={notification.created_at}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(notification.created_at))}</time></div><strong>{notification.title}</strong><p>{notification.body}</p></div>{!notification.read_at && <button type="button" className="text-button" onClick={() => onRead(notification)}>Marcar como lido</button>}</article>)}</div> : <p className="student-notification-empty">Quando o profissional enviar uma orientação, ela aparecerá aqui.</p>}
    <p className="field-help">Os avisos ficam vinculados a este acesso e não expõem seus dados para outros alunos.</p>
  </section>
}

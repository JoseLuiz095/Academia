const reminderPrefix = 'impulso:pwa:'
const attemptPrefix = `${reminderPrefix}notification-attempt:`
const preferenceChangedEvent = 'impulso:reminder-preference-changed'

export type PwaAudience = 'cliente' | 'admin'
export type NotificationPermissionState = NotificationPermission | 'unsupported'

export type NotificationAttempt = {
  attemptedAt: number
  result: NotificationPermissionState
}

type ReminderScheduler = {
  intervalId: number
  subscribers: number
}

const reminderSchedulers = new Map<string, ReminderScheduler>()
let permissionRequest: Promise<NotificationPermissionState> | null = null

function storageGet(key: string) {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Alguns browsers bloqueiam o armazenamento em modo privado ou incorporado.
  }
}

function storageRemove(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // A preferência local é opcional; notificações não devem quebrar por isso.
  }
}

function scopedKey(prefix: string, audience: PwaAudience, workspaceId: string) {
  return `${prefix}${audience}:${encodeURIComponent(workspaceId)}`
}

export function isStandaloneMode() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function reminderKey(audience: PwaAudience, workspaceId: string) {
  return scopedKey(reminderPrefix, audience, workspaceId)
}

export function notificationAttemptKey(audience: PwaAudience, workspaceId: string) {
  return scopedKey(attemptPrefix, audience, workspaceId)
}

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return window.Notification.permission
}

export function getNotificationAttempt(audience: PwaAudience, workspaceId: string): NotificationAttempt | null {
  const raw = storageGet(notificationAttemptKey(audience, workspaceId))
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<NotificationAttempt>
    if (typeof value.attemptedAt !== 'number' || typeof value.result !== 'string') return null
    if (!['default', 'granted', 'denied', 'unsupported'].includes(value.result)) return null
    return { attemptedAt: value.attemptedAt, result: value.result as NotificationPermissionState }
  } catch {
    return null
  }
}

function recordNotificationAttempt(audience: PwaAudience | undefined, workspaceId: string | undefined, result: NotificationPermissionState) {
  if (!audience || !workspaceId) return
  storageSet(notificationAttemptKey(audience, workspaceId), JSON.stringify({ attemptedAt: Date.now(), result } satisfies NotificationAttempt))
}

export async function requestNotificationPermission(audience?: PwaAudience, workspaceId?: string): Promise<NotificationPermissionState> {
  const current = getNotificationPermission()
  if (current !== 'default') return current
  if (permissionRequest) return permissionRequest

  // A chamada deve partir de uma ação explícita do usuário. Não solicitamos
  // permissão automaticamente ao montar a página.
  recordNotificationAttempt(audience, workspaceId, 'default')
  permissionRequest = Promise.resolve(window.Notification.requestPermission())
    .then((result) => {
      recordNotificationAttempt(audience, workspaceId, result)
      return result
    })
    .catch(() => {
      recordNotificationAttempt(audience, workspaceId, 'default')
      return 'default' as const
    })

  try {
    return await permissionRequest
  } finally {
    permissionRequest = null
  }
}

export async function notifyBrowser(title: string, options: NotificationOptions & { url?: string } = {}) {
  if (getNotificationPermission() !== 'granted' || typeof navigator === 'undefined') return false
  const { url, ...notificationOptions } = options
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null
    if (registration?.showNotification) {
      await registration.showNotification(title, { ...notificationOptions, data: { url: url ?? window.location.href } })
      return true
    }
    if (typeof window.Notification !== 'function') return false
    new window.Notification(title, notificationOptions)
    return true
  } catch {
    return false
  }
}

export function isReminderEnabled(audience: PwaAudience, workspaceId: string) {
  return storageGet(reminderKey(audience, workspaceId)) === 'enabled'
}

export function setReminderEnabled(audience: PwaAudience, workspaceId: string, enabled: boolean) {
  if (enabled) storageSet(reminderKey(audience, workspaceId), 'enabled')
  else storageRemove(reminderKey(audience, workspaceId))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(preferenceChangedEvent))
}

export function subscribeReminderPreference(audience: PwaAudience, workspaceId: string, onChange: (enabled: boolean) => void) {
  if (typeof window === 'undefined') return () => undefined
  const update = () => onChange(isReminderEnabled(audience, workspaceId))
  window.addEventListener(preferenceChangedEvent, update)
  window.addEventListener('storage', update)
  return () => {
    window.removeEventListener(preferenceChangedEvent, update)
    window.removeEventListener('storage', update)
  }
}

export function shouldNotifyAdminPending(previous: number, current: number, enabled: boolean, permission: NotificationPermissionState) {
  return enabled && permission === 'granted' && current > 0 && current > previous
}

/** Mantém um único intervalo por audiência/workspace mesmo com remounts ou duplicações acidentais. */
export function startReminderScheduler(audience: PwaAudience, workspaceId: string, callback: () => void, delayMs: number) {
  // Alertas administrativos dependem de pedidos reais no Dashboard. Um relógio
  // sozinho não comprova que existe pendência e não deve gerar notificações.
  if (typeof window === 'undefined' || audience !== 'cliente') return () => undefined
  const key = reminderKey(audience, workspaceId)
  const current = reminderSchedulers.get(key)
  if (current) {
    current.subscribers += 1
    return () => stopReminderScheduler(key)
  }

  const intervalId = window.setInterval(callback, delayMs)
  reminderSchedulers.set(key, { intervalId, subscribers: 1 })
  return () => stopReminderScheduler(key)
}

function stopReminderScheduler(key: string) {
  const current = reminderSchedulers.get(key)
  if (!current) return
  current.subscribers -= 1
  if (current.subscribers > 0) return
  window.clearInterval(current.intervalId)
  reminderSchedulers.delete(key)
}

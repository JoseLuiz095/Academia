const reminderPrefix = 'impulso:pwa:'

export type PwaAudience = 'cliente' | 'admin'

export function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function reminderKey(audience: PwaAudience, workspaceId: string) {
  return `${reminderPrefix}${audience}:${workspaceId}`
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported' as const
  if (Notification.permission === 'granted') return 'granted' as const
  if (Notification.permission === 'denied') return 'denied' as const
  return Notification.requestPermission()
}

export async function notifyBrowser(title: string, options: NotificationOptions & { url?: string } = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  const { url, ...notificationOptions } = options
  try {
    const registration = await navigator.serviceWorker?.ready
    if (registration?.showNotification) {
      await registration.showNotification(title, { ...notificationOptions, data: { url: url ?? window.location.href } })
      return true
    }
    new Notification(title, notificationOptions)
    return true
  } catch {
    return false
  }
}

export function isReminderEnabled(audience: PwaAudience, workspaceId: string) {
  return localStorage.getItem(reminderKey(audience, workspaceId)) === 'enabled'
}

export function setReminderEnabled(audience: PwaAudience, workspaceId: string, enabled: boolean) {
  if (enabled) localStorage.setItem(reminderKey(audience, workspaceId), 'enabled')
  else localStorage.removeItem(reminderKey(audience, workspaceId))
}

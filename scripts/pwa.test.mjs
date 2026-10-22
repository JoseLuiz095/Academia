import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isReminderEnabled, setReminderEnabled, shouldNotifyAdminPending, startReminderScheduler, subscribeReminderPreference } from '../src/lib/pwa.ts'

const storage = new Map()
const intervals = new Map()
const browser = new EventTarget()
let intervalId = 0
browser.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
browser.setInterval = (callback) => { const id = ++intervalId; intervals.set(id, callback); return id }
browser.clearInterval = (id) => intervals.delete(id)
globalThis.window = browser

test('admin clock never fabricates an order alert; client reminders retain one scoped timer', () => {
  let adminCalls = 0
  let clientCalls = 0
  const stopAdmin = startReminderScheduler('admin', 'business-a', () => adminCalls++, 15 * 60_000)
  assert.equal(intervals.size, 0)
  const stopClient = startReminderScheduler('cliente', 'business-a', () => clientCalls++, 2 * 60 * 60_000)
  const stopDuplicate = startReminderScheduler('cliente', 'business-a', () => clientCalls++, 2 * 60 * 60_000)
  assert.equal(intervals.size, 1)
  for (const callback of intervals.values()) callback()
  assert.equal(adminCalls, 0)
  assert.equal(clientCalls, 1)
  stopDuplicate()
  assert.equal(intervals.size, 1)
  stopClient()
  stopAdmin()
  assert.equal(intervals.size, 0)
})

test('admin alert requires a real increase, consent and browser permission', () => {
  assert.equal(shouldNotifyAdminPending(0, 0, true, 'granted'), false)
  assert.equal(shouldNotifyAdminPending(2, 2, true, 'granted'), false)
  assert.equal(shouldNotifyAdminPending(2, 1, true, 'granted'), false)
  assert.equal(shouldNotifyAdminPending(0, 1, false, 'granted'), false)
  assert.equal(shouldNotifyAdminPending(0, 1, true, 'denied'), false)
  assert.equal(shouldNotifyAdminPending(0, 1, true, 'default'), false)
  assert.equal(shouldNotifyAdminPending(0, 1, true, 'unsupported'), false)
  assert.equal(shouldNotifyAdminPending(0, 1, true, 'granted'), true)
})

test('disabling admin consent updates subscribers immediately and remains tenant scoped', () => {
  setReminderEnabled('admin', 'business-a', false)
  setReminderEnabled('admin', 'business-b', false)
  const changes = []
  const stop = subscribeReminderPreference('admin', 'business-a', (enabled) => changes.push(enabled))
  setReminderEnabled('admin', 'business-a', true)
  assert.equal(isReminderEnabled('admin', 'business-a'), true)
  assert.equal(isReminderEnabled('admin', 'business-b'), false)
  setReminderEnabled('admin', 'business-a', false)
  assert.deepEqual(changes, [true, false])
  assert.equal(shouldNotifyAdminPending(0, 2, changes.at(-1), 'granted'), false)
  stop()
  setReminderEnabled('admin', 'business-a', true)
  assert.equal(changes.length, 2)
})

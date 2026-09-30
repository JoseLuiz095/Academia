import { supabase } from './supabase'
import type { OrderReceipt } from '../types'

type OrderItemInput = { product_id: string; quantity: number }
const memoryRequests = new Map<string, { fingerprint: string; requestId: string }>()

function requestFor(workspaceId: string, items: OrderItemInput[]) {
  const key = `academia:order-attempt:${workspaceId}`
  const fingerprint = JSON.stringify([...items].sort((a, b) => a.product_id.localeCompare(b.product_id)))
  let saved = memoryRequests.get(key)
  try {
    const stored = sessionStorage.getItem(key)
    if (stored) saved = JSON.parse(stored) as typeof saved
  } catch { /* A tentativa continua estável nesta aba mesmo sem sessionStorage. */ }
  if (saved?.fingerprint === fingerprint && /^[0-9a-f-]{36}$/i.test(saved.requestId)) {
    return { key, fingerprint, requestId: saved.requestId }
  }
  const requestId = crypto.randomUUID()
  memoryRequests.set(key, { fingerprint, requestId })
  try { sessionStorage.setItem(key, JSON.stringify({ fingerprint, requestId })) } catch { /* Sem armazenamento persistente. */ }
  return { key, fingerprint, requestId }
}

export async function createPendingOrder(workspaceId: string, items: OrderItemInput[], expectedTotal: number, turnstileToken = ''): Promise<OrderReceipt> {
  if (!supabase) throw new Error('A vitrine está temporariamente indisponível.')
  if (!items.length || items.length > 20) throw new Error('Escolha de 1 a 20 produtos para o pedido.')
  const attempt = requestFor(workspaceId, items)
  const payload = {
    target_workspace_id: workspaceId,
    client_request_id: attempt.requestId,
    cart_items: items,
    expected_total: expectedTotal,
  }
  const result = turnstileToken
    ? await supabase.functions.invoke('create-public-order', { body: { ...payload, turnstile_token: turnstileToken } })
    : await supabase.rpc('create_pending_order', payload)
  const { data, error } = result
  if (error) {
    const known = ['Os valores mudaram', 'Produto indisponível', 'Vitrine indisponível', 'Esta tentativa já foi usada']
    const message = known.find((text) => error.message.includes(text))
    throw new Error(message ? error.message : 'Não foi possível registrar o pedido. Tente novamente.')
  }
  const receipt = data as OrderReceipt | null
  if (!receipt || typeof receipt.reference !== 'string' || typeof receipt.total !== 'number' || !Array.isArray(receipt.items)) {
    throw new Error('Não foi possível confirmar o registro do pedido. Tente novamente.')
  }
  return receipt
}

export function finishOrderAttempt(workspaceId: string) {
  const key = `academia:order-attempt:${workspaceId}`
  memoryRequests.delete(key)
  try { sessionStorage.removeItem(key) } catch { /* Sem armazenamento persistente. */ }
}

export function rememberOrderReceipt(workspaceId: string, receipt: OrderReceipt) {
  try { sessionStorage.setItem(`academia:last-order:${workspaceId}`, JSON.stringify(receipt)) }
  catch { /* O recibo continua visível até a página ser fechada. */ }
}

export function loadOrderReceipt(workspaceId: string): OrderReceipt | null {
  try {
    const saved = sessionStorage.getItem(`academia:last-order:${workspaceId}`)
    if (!saved) return null
    const receipt = JSON.parse(saved) as OrderReceipt
    return typeof receipt.reference === 'string' && typeof receipt.total === 'number' && Array.isArray(receipt.items) ? receipt : null
  } catch { return null }
}

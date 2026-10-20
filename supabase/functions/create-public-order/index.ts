import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AsaasPayment = { id: string; status?: string; dueDate?: string }
type AsaasPix = { encodedImage?: string; payload?: string; expirationDate?: string }

async function asaasRequest<T>(baseUrl: string, apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      'User-Agent': Deno.env.get('ASAAS_USER_AGENT') || 'Impulso/1.0',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => null) as T & { errors?: { description?: string }[] }
  if (!response.ok) throw new Error(body?.errors?.[0]?.description || `Asaas HTTP ${response.status}`)
  return body
}

async function createAsaasPayment(client: ReturnType<typeof createClient>, workspaceId: string, requestId: string, name: string, phone: string) {
  const apiKey = Deno.env.get('ASAAS_API_KEY')
  const pilotWorkspaceId = Deno.env.get('ASAAS_PILOT_WORKSPACE_ID')
  if (!apiKey || !pilotWorkspaceId || pilotWorkspaceId !== workspaceId) return null
  const baseUrl = Deno.env.get('ASAAS_BASE_URL') || (Deno.env.get('ASAAS_ENV') === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3')
  const orderResult = await client.from('orders').select('id,reference,total,payment_provider,payment_status,provider_payment_id,provider_customer_id,pix_copy_paste,pix_qr_code,payment_expires_at').eq('workspace_id', workspaceId).eq('request_id', requestId).single()
  if (orderResult.error || !orderResult.data) throw new Error('Pedido criado, mas não foi possível preparar a cobrança.')
  const order = orderResult.data as { id: string; reference: string; total: number; payment_provider?: string; provider_payment_id?: string | null; provider_customer_id?: string | null; pix_copy_paste?: string | null; pix_qr_code?: string | null; payment_expires_at?: string | null }
  if (order.payment_provider === 'asaas' && order.provider_payment_id && order.pix_copy_paste) return { provider: 'asaas' as const, status: 'awaiting_payment' as const, pix_copy_paste: order.pix_copy_paste, qr_code: order.pix_qr_code, expires_at: order.payment_expires_at }

  const existing = await asaasRequest<{ data?: AsaasPayment[] }>(baseUrl, apiKey, `/payments?externalReference=${encodeURIComponent(order.reference)}&limit=1`)
  let customerId = order.provider_customer_id || null
  let payment = existing.data?.[0] ?? null
  if (!payment) {
    const customer = await asaasRequest<{ id: string }>(baseUrl, apiKey, '/customers', { method: 'POST', body: JSON.stringify({ name, mobilePhone: phone, notificationDisabled: true, externalReference: order.reference }) })
    customerId = customer.id
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    payment = await asaasRequest<AsaasPayment>(baseUrl, apiKey, '/payments', { method: 'POST', body: JSON.stringify({ customer: customer.id, billingType: 'PIX', value: Number(order.total), dueDate, description: `Pedido ${order.reference}`, externalReference: order.reference }) })
  }
  const pix = await asaasRequest<AsaasPix>(baseUrl, apiKey, `/payments/${encodeURIComponent(payment.id)}/pixQrCode`)
  if (!pix.payload) throw new Error('A Asaas não retornou o Pix copia e cola.')
  const expiresAt = pix.expirationDate || null
  const update = await client.from('orders').update({ payment_provider: 'asaas', payment_status: 'awaiting_payment', provider_payment_id: payment.id, provider_customer_id: customerId, payment_external_reference: order.reference, pix_copy_paste: pix.payload, pix_qr_code: pix.encodedImage || null, payment_expires_at: expiresAt, payment_error: null }).eq('id', order.id)
  if (update.error) throw new Error('Cobrança criada, mas não foi possível salvar os dados do pagamento.')
  return { provider: 'asaas' as const, status: 'awaiting_payment' as const, pix_copy_paste: pix.payload, qr_code: pix.encodedImage || null, expires_at: expiresAt }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)

  let input: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({ error: 'Pedido inválido.' }, 400)
    input = parsed as Record<string, unknown>
  } catch { return reply({ error: 'Pedido inválido.' }, 400) }

  const token = typeof input.turnstile_token === 'string' ? input.turnstile_token.trim() : ''
  const workspaceId = typeof input.target_workspace_id === 'string' ? input.target_workspace_id : ''
  const requestId = typeof input.client_request_id === 'string' ? input.client_request_id : ''
  const customerName = typeof input.customer_name === 'string' ? input.customer_name.trim() : ''
  const customerPhone = typeof input.customer_phone === 'string' ? input.customer_phone.replace(/\D/g, '') : ''
  const customerNote = typeof input.customer_note === 'string' ? input.customer_note.trim() : ''
  const customerConsent = input.customer_consent === true
  const appointment = input.appointment && typeof input.appointment === 'object' && !Array.isArray(input.appointment) ? input.appointment : null
  const items = input.cart_items
  const expectedTotal = input.expected_total
  if (!token || !uuid.test(workspaceId) || !uuid.test(requestId) || !Array.isArray(items) || typeof expectedTotal !== 'number' || customerName.length < 2 || customerName.length > 80 || !/^55\d{10,11}$/.test(customerPhone) || customerNote.length > 500 || !customerConsent) {
    return reply({ error: 'Conclua a verificação e confira o pedido.' }, 400)
  }

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret || !supabaseUrl || !serviceKey) return reply({ error: 'Proteção do checkout ainda não foi configurada.' }, 503)

  const form = new URLSearchParams({ secret, response: token })
  const remoteIp = request.headers.get('CF-Connecting-IP')
  if (remoteIp) form.set('remoteip', remoteIp)
  let verification: { success?: boolean; action?: string; hostname?: string }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    verification = await response.json()
  } catch { return reply({ error: 'Não foi possível validar a proteção anti-robô.' }, 502) }
  if (!verification.success || (verification.action && verification.action !== 'checkout')) return reply({ error: 'A verificação de segurança expirou. Tente novamente.' }, 403)

  const client = createClient(supabaseUrl, serviceKey)
  const { data, error } = await client.rpc('create_pending_order', {
    target_workspace_id: workspaceId,
    client_request_id: requestId,
    cart_items: items,
    expected_total: expectedTotal,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_note: customerNote || null,
    customer_consent: customerConsent,
    appointment,
  })
  if (error) return reply({ error: error.message }, 400)
  try {
    const payment = await createAsaasPayment(client, workspaceId, requestId, customerName, customerPhone)
    return reply(payment ? { ...(data as Record<string, unknown>), payment } : data)
  } catch (asaasError) {
    console.error('[asaas] checkout fallback', asaasError instanceof Error ? asaasError.message : 'unknown error')
    await client.from('orders').update({ payment_provider: 'manual_pix', payment_status: 'manual_review', payment_error: 'Cobrança automática indisponível; confirmação manual necessária.' }).eq('workspace_id', workspaceId).eq('request_id', requestId)
    return reply({ ...(data as Record<string, unknown>), payment: { provider: 'manual_pix', status: 'manual_review' } })
  }
})

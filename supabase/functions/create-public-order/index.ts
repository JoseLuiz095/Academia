import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  return reply(data)
})

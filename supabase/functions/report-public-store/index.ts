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
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Pedido inválido.' }, 400)
    input = body as Record<string, unknown>
  } catch { return reply({ error: 'Pedido inválido.' }, 400) }

  const token = typeof input.turnstile_token === 'string' ? input.turnstile_token.trim() : ''
  const workspaceId = typeof input.workspace_id === 'string' ? input.workspace_id : ''
  const productId = typeof input.product_id === 'string' && uuid.test(input.product_id) ? input.product_id : null
  const reporterName = typeof input.reporter_name === 'string' ? input.reporter_name.trim() : ''
  const reporterEmail = typeof input.reporter_email === 'string' ? input.reporter_email.trim().toLowerCase() : ''
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  const details = typeof input.details === 'string' ? input.details.trim() : ''
  if (!token || !uuid.test(workspaceId) || reporterName.length < 2 || reporterName.length > 100 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reporterEmail) || reason.length < 3 || reason.length > 140 || details.length > 2000) return reply({ error: 'Confira os dados da denúncia e a verificação de segurança.' }, 400)

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret || !supabaseUrl || !serviceKey) return reply({ error: 'O recebimento de denúncias ainda não foi configurado.' }, 503)
  const form = new URLSearchParams({ secret, response: token })
  const remoteIp = request.headers.get('CF-Connecting-IP')
  if (remoteIp) form.set('remoteip', remoteIp)
  let verification: { success?: boolean; action?: string }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    verification = await response.json()
  } catch { return reply({ error: 'Não foi possível validar a proteção anti-robô.' }, 502) }
  if (!verification.success || (verification.action && verification.action !== 'public-report')) return reply({ error: 'A verificação expirou. Tente novamente.' }, 403)

  const client = createClient(supabaseUrl, serviceKey)
  const workspace = await client.from('workspaces').select('id').eq('id', workspaceId).eq('published', true).maybeSingle()
  if (workspace.error || !workspace.data) return reply({ error: 'Esta página não está disponível para denúncia.' }, 404)
  if (productId) {
    const product = await client.from('products').select('id').eq('id', productId).eq('workspace_id', workspaceId).eq('published', true).maybeSingle()
    if (product.error || !product.data) return reply({ error: 'Produto não encontrado.' }, 404)
  }
  const saved = await client.from('public_store_reports').insert({ workspace_id: workspaceId, product_id: productId, reporter_name: reporterName, reporter_email: reporterEmail, reason, details: details || null }).select('id').single()
  if (saved.error) return reply({ error: 'Não foi possível registrar a denúncia agora.' }, 500)
  return reply({ id: saved.data.id, message: 'Denúncia registrada para análise.' })
})

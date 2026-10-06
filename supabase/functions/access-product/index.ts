import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)

  let input: Record<string, unknown>
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Pedido inválido.' }, 400)
    input = body as Record<string, unknown>
  } catch { return reply({ error: 'Pedido inválido.' }, 400) }

  const token = typeof input.token === 'string' ? input.token.trim().toLowerCase() : ''
  const deviceId = typeof input.device_id === 'string' ? input.device_id.trim() : ''
  if (!/^[a-f0-9]{48}$/.test(token) || deviceId.length < 16 || deviceId.length > 120) return reply({ error: 'Link de acesso inválido.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return reply({ error: 'A área protegida ainda não foi configurada.' }, 503)

  const client = createClient(supabaseUrl, serviceKey)
  const tokenHash = await sha256(token)
  const deviceHash = await sha256(deviceId)
  const tokenResult = await client.from('product_access_tokens').select('id,order_id,product_id,device_hash,expires_at,revoked_at,first_used_at').eq('token_hash', tokenHash).maybeSingle()
  if (tokenResult.error || !tokenResult.data) return reply({ error: 'Link de acesso inválido ou expirado.' }, 404)
  const access = tokenResult.data
  if (access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) return reply({ error: 'Este link de acesso expirou. Solicite uma nova liberação ao profissional.' }, 410)

  const [orderResult, itemResult, tokenRowsResult] = await Promise.all([
    client.from('orders').select('workspace_id,status,reference').eq('id', access.order_id).single(),
    client.from('order_items').select('product_id,product:products(id,name,description,image_url,category,level,access_mode,access_days,content,kind)').eq('order_id', access.order_id),
    client.from('product_access_tokens').select('id,device_hash,expires_at,revoked_at').eq('order_id', access.order_id).is('revoked_at', null),
  ])
  if (orderResult.error || !orderResult.data || orderResult.data.status !== 'confirmed') return reply({ error: 'O pagamento ainda não está liberado para este conteúdo.' }, 403)
  if (itemResult.error || tokenRowsResult.error) return reply({ error: 'Não foi possível carregar os conteúdos deste pedido.' }, 503)

  const products = (itemResult.data ?? []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    return product
  }).filter((product): product is Record<string, unknown> => Boolean(product) && product.kind === 'digital' && ['portal', 'both'].includes(String(product.access_mode)))
  if (!products.length) return reply({ error: 'Este pedido não possui conteúdo protegido liberado.' }, 403)

  const tokenRows = tokenRowsResult.data ?? []
  if (tokenRows.some((row) => row.device_hash && row.device_hash !== deviceHash)) return reply({ error: 'Este conteúdo já foi vinculado a outro dispositivo.' }, 403)
  const now = new Date().toISOString()
  const unclaimedIds = tokenRows.filter((row) => !row.device_hash).map((row) => row.id)
  if (unclaimedIds.length) {
    const claimed = await client.from('product_access_tokens').update({ device_hash: deviceHash, first_used_at: now, last_used_at: now }).in('id', unclaimedIds).is('device_hash', null)
    if (claimed.error) return reply({ error: 'Não foi possível vincular este dispositivo. Tente novamente.' }, 409)
  } else {
    await client.from('product_access_tokens').update({ last_used_at: now }).eq('id', access.id)
  }

  const workspace = await client.from('workspaces').select('name,slug').eq('id', orderResult.data.workspace_id).single()
  if (workspace.error || !workspace.data) return reply({ error: 'Espaço indisponível.' }, 404)
  const expiresAt = tokenRows.reduce((earliest, row) => !earliest || new Date(row.expires_at).getTime() < new Date(earliest).getTime() ? row.expires_at : earliest, access.expires_at)
  return reply({ products, product: products[0], order_reference: orderResult.data.reference, workspace: workspace.data, expires_at: expiresAt })
})

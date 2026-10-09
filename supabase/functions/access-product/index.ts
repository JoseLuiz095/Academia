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

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
  const action = typeof input.action === 'string' ? input.action : 'open'
  if (!/^[a-f0-9]{48}$/.test(token) || deviceId.length < 16 || deviceId.length > 120) return reply({ error: 'Link de acesso inválido.' }, 400)
  if (!['open', 'notifications', 'mark_read'].includes(action)) return reply({ error: 'Ação inválida.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return reply({ error: 'A área protegida ainda não foi configurada.' }, 503)

  const client = createClient(supabaseUrl, serviceKey)
  const tokenHash = await sha256(token)
  const deviceHash = await sha256(deviceId)
  const tokenResult = await client.from('product_access_tokens').select('id,order_id,product_id,device_hash,expires_at,revoked_at,first_used_at,access_scope,token_version,label').eq('token_hash', tokenHash).maybeSingle()
  if (tokenResult.error || !tokenResult.data) return reply({ error: 'Link de acesso inválido ou expirado.' }, 404)
  const access = tokenResult.data
  if (access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) return reply({ error: 'Este link de acesso expirou. Solicite uma nova liberação ao profissional.' }, 410)

  const [orderResult, itemResult, tokenRowsResult] = await Promise.all([
    client.from('orders').select('workspace_id,status,reference').eq('id', access.order_id).single(),
    client.from('order_items').select('product_id,product:products(id,name,description,image_url,category,level,access_mode,access_days,content,kind)').eq('order_id', access.order_id),
    client.from('product_access_tokens').select('id,product_id,device_hash,expires_at,revoked_at').eq('order_id', access.order_id).is('revoked_at', null),
  ])
  if (orderResult.error || !orderResult.data || orderResult.data.status !== 'confirmed') return reply({ error: 'O pagamento ainda não está liberado para este conteúdo.' }, 403)
  if (itemResult.error || tokenRowsResult.error) return reply({ error: 'Não foi possível carregar os conteúdos deste pedido.' }, 503)

  const productScope = access.access_scope !== 'order'
  const tokenRows = (tokenRowsResult.data ?? []).filter((row) => !productScope || row.id === access.id)
  if (tokenRows.some((row) => row.device_hash && row.device_hash !== deviceHash)) return reply({ error: 'Este conteúdo já foi vinculado a outro dispositivo.' }, 403)
  const now = new Date().toISOString()
  const unclaimedIds = tokenRows.filter((row) => !row.device_hash).map((row) => row.id)
  if (unclaimedIds.length) {
    const claimed = await client.from('product_access_tokens').update({ device_hash: deviceHash, first_used_at: now, last_used_at: now }).in('id', unclaimedIds).is('device_hash', null)
    if (claimed.error) return reply({ error: 'Não foi possível vincular este dispositivo. Tente novamente.' }, 409)
  } else {
    const touched = await client.from('product_access_tokens').update({ last_used_at: now }).eq('id', access.id)
    if (touched.error) return reply({ error: 'Não foi possível atualizar o acesso. Tente novamente.' }, 409)
  }

  const workspace = await client.from('workspaces').select('id,name,slug').eq('id', orderResult.data.workspace_id).single()
  if (workspace.error || !workspace.data) return reply({ error: 'Espaço indisponível.' }, 404)

  const rawProducts = (itemResult.data ?? []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    return product
  }).filter((product): product is Record<string, unknown> => Boolean(product) && product.kind === 'digital' && ['portal', 'both'].includes(String(product.access_mode)) && (!productScope || product.id === access.product_id))
  if (!rawProducts.length) return reply({ error: 'Este pedido não possui conteúdo protegido liberado.' }, 403)

  const notificationResult = await client.from('client_notifications').select('id,audience,kind,title,body,product_id,target_token_id,created_at').eq('workspace_id', workspace.data.id).order('created_at', { ascending: false }).limit(100)
  if (notificationResult.error) return reply({ error: 'Não foi possível carregar os avisos deste espaço.' }, 503)
  const visibleNotifications = (notificationResult.data ?? []).filter((item) => item.audience === 'all' || (item.audience === 'product' && item.product_id === access.product_id) || (item.audience === 'token' && item.target_token_id === access.id))
  const receiptIds = visibleNotifications.map((item) => item.id)
  const receipts = receiptIds.length ? await client.from('client_notification_receipts').select('notification_id,read_at').eq('access_token_id', access.id).in('notification_id', receiptIds) : { data: [], error: null }
  if (receipts.error) return reply({ error: 'Não foi possível carregar o estado dos avisos.' }, 503)
  const readById = new Map((receipts.data ?? []).map((item) => [item.notification_id, item.read_at]))
  const notifications = visibleNotifications.map((item) => ({ ...item, read_at: readById.get(item.id) ?? null }))

  if (action === 'mark_read') {
    const notificationId = input.notification_id
    if (!isUuid(notificationId) || !notifications.some((item) => item.id === notificationId)) return reply({ error: 'Aviso não encontrado.' }, 404)
    const marked = await client.from('client_notification_receipts').upsert({ notification_id: notificationId, access_token_id: access.id, read_at: now }, { onConflict: 'notification_id,access_token_id' })
    if (marked.error) return reply({ error: 'Não foi possível marcar o aviso como lido.' }, 409)
    return reply({ marked: true, notification_id: notificationId, read_at: now })
  }

  if (action === 'notifications') return reply({ notifications, access_token_id: access.id, token_version: access.token_version ?? 1 })

  const expiresAt = tokenRows.reduce((earliest, row) => !earliest || new Date(row.expires_at).getTime() < new Date(earliest).getTime() ? row.expires_at : earliest, access.expires_at)
  const products = rawProducts
  return reply({ products, product: products[0], order_reference: orderResult.data.reference, workspace: workspace.data, expires_at: expiresAt, access_token_id: access.id, access_scope: access.access_scope ?? 'product', token_version: access.token_version ?? 1, token_label: access.label ?? null, notifications })
})

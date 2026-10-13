import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const headers = { 'Content-Type': 'application/json' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

type AsaasEvent = { id?: string; event?: string; payment?: { id?: string } }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405)
  const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
  const receivedToken = request.headers.get('asaas-access-token')
  if (!expectedToken || !receivedToken || receivedToken !== expectedToken) return reply({ error: 'Não autorizado.' }, 401)

  let payload: AsaasEvent
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({ error: 'Evento inválido.' }, 400)
    payload = parsed as AsaasEvent
  } catch { return reply({ error: 'Evento inválido.' }, 400) }

  const eventId = typeof payload.id === 'string' ? payload.id.trim() : ''
  const eventType = typeof payload.event === 'string' ? payload.event.trim() : ''
  const paymentId = typeof payload.payment?.id === 'string' ? payload.payment.id.trim() : ''
  if (!eventId || !eventType) return reply({ error: 'Evento sem identificação.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return reply({ error: 'Webhook não configurado.' }, 503)
  const client = createClient(supabaseUrl, serviceKey)

  const inserted = await client.from('asaas_webhook_events').insert({ asaas_event_id: eventId, event_type: eventType, provider_payment_id: paymentId || null, payload, processing_status: 'received' })
  if (inserted.error) {
    if (inserted.error.code === '23505') return reply({ ok: true, duplicate: true })
    return reply({ error: 'Não foi possível registrar o evento.' }, 500)
  }

  try {
    if (!paymentId) {
      await client.from('asaas_webhook_events').update({ processing_status: 'ignored', processed_at: new Date().toISOString() }).eq('asaas_event_id', eventId)
      return reply({ ok: true, ignored: true })
    }
    const update: Record<string, unknown> = { payment_last_event_at: new Date().toISOString() }
    if (eventType === 'PAYMENT_CREATED') update.payment_status = 'awaiting_payment'
    else if (eventType === 'PAYMENT_CONFIRMED') update.payment_status = 'awaiting_payment'
    else if (eventType === 'PAYMENT_RECEIVED') {
      update.payment_status = 'confirmed'
      update.payment_received_at = new Date().toISOString()
      update.status = 'confirmed'
      update.confirmed_at = new Date().toISOString()
    } else if (eventType === 'PAYMENT_OVERDUE') update.payment_status = 'overdue'
    else if (eventType === 'PAYMENT_DELETED') { update.payment_status = 'cancelled'; update.status = 'cancelled' }
    else if (eventType === 'PAYMENT_REFUNDED') { update.payment_status = 'refunded'; update.status = 'cancelled' }
    else {
      await client.from('asaas_webhook_events').update({ processing_status: 'ignored', processed_at: new Date().toISOString() }).eq('asaas_event_id', eventId)
      return reply({ ok: true, ignored: true })
    }

    let orderUpdate = client.from('orders').update(update).eq('provider_payment_id', paymentId)
    // A Asaas pode reenviar eventos e entregá-los fora de ordem. Nunca permita
    // que um evento antigo rebaixe um pedido já confirmado ou estornado.
    if (eventType === 'PAYMENT_CREATED' || eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_OVERDUE') {
      orderUpdate = orderUpdate.not('payment_status', 'in', '(confirmed,refunded)')
    }
    const orderResult = await orderUpdate.select('id,status')
    if (orderResult.error) throw orderResult.error
    if (eventType === 'PAYMENT_RECEIVED' && orderResult.data?.length) {
      await client.from('evaluation_bookings').update({ status: 'awaiting_approval', payment_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('order_id', orderResult.data[0].id).eq('status', 'payment_pending')
    }
    await client.from('asaas_webhook_events').update({ processing_status: 'processed', processed_at: new Date().toISOString() }).eq('asaas_event_id', eventId)
    return reply({ ok: true })
  } catch (error) {
    console.error('[asaas-webhook]', error instanceof Error ? error.message : 'unknown error')
    await client.from('asaas_webhook_events').update({ processing_status: 'error', error_message: 'Falha ao atualizar o pedido.', processed_at: new Date().toISOString() }).eq('asaas_event_id', eventId)
    return reply({ error: 'Evento recebido, mas precisa de reconciliação.' }, 500)
  }
})

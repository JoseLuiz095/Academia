import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const headers = { 'Content-Type': 'application/json' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

type AsaasEvent = { id?: string; event?: string; payment?: { id?: string } }

type PaymentStatus = 'manual_review' | 'error' | 'awaiting_payment' | 'overdue' | 'cancelled' | 'confirmed' | 'refunded'

type PaymentTransition = {
  paymentStatus: PaymentStatus
  orderStatus?: 'confirmed' | 'cancelled'
}

const paymentTransitions: Record<string, PaymentTransition> = {
  PAYMENT_CREATED: { paymentStatus: 'awaiting_payment' },
  PAYMENT_CONFIRMED: { paymentStatus: 'awaiting_payment' },
  PAYMENT_RECEIVED: { paymentStatus: 'confirmed', orderStatus: 'confirmed' },
  PAYMENT_OVERDUE: { paymentStatus: 'overdue' },
  PAYMENT_DELETED: { paymentStatus: 'cancelled', orderStatus: 'cancelled' },
  PAYMENT_REFUNDED: { paymentStatus: 'refunded', orderStatus: 'cancelled' },
}

const paymentStatusRank: Record<PaymentStatus, number> = {
  manual_review: 0,
  error: 0,
  awaiting_payment: 10,
  overdue: 20,
  cancelled: 25,
  confirmed: 30,
  refunded: 40,
}

const knownPaymentStatuses = Object.keys(paymentStatusRank) as PaymentStatus[]

const canApplyTransition = (currentStatus: string | null | undefined, nextStatus: PaymentStatus) => {
  if (!currentStatus || !(currentStatus in paymentStatusRank)) return true
  return paymentStatusRank[nextStatus] >= paymentStatusRank[currentStatus as PaymentStatus]
}

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
  let eventType = typeof payload.event === 'string' ? payload.event.trim() : ''
  let paymentId = typeof payload.payment?.id === 'string' ? payload.payment.id.trim() : ''
  if (!eventId || !eventType) return reply({ error: 'Evento sem identificação.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return reply({ error: 'Webhook não configurado.' }, 503)
  const client = createClient(supabaseUrl, serviceKey)

  const inserted = await client.from('asaas_webhook_events').insert({ asaas_event_id: eventId, event_type: eventType, provider_payment_id: paymentId || null, payload, processing_status: 'received' })
  if (inserted.error) {
    if (inserted.error.code !== '23505') return reply({ error: 'Não foi possível registrar o evento.' }, 500)

    // Um evento já processado é respondido como duplicado. Eventos que falharam
    // ficam elegíveis para nova tentativa sem criar uma segunda linha no journal.
    const existing = await client.from('asaas_webhook_events')
      .select('event_type,provider_payment_id,processing_status')
      .eq('asaas_event_id', eventId)
      .maybeSingle()
    if (existing.error || !existing.data) return reply({ error: 'Não foi possível reconciliar o evento recebido.' }, 500)
    if (existing.data.processing_status === 'processed' || existing.data.processing_status === 'ignored') {
      return reply({ ok: true, duplicate: true, processing_status: existing.data.processing_status })
    }
    eventType = existing.data.event_type
    paymentId = existing.data.provider_payment_id ?? ''
    if (existing.data.processing_status === 'error') {
      const reopened = await client.from('asaas_webhook_events')
        .update({ processing_status: 'received', error_message: null, processed_at: null })
        .eq('asaas_event_id', eventId)
        .eq('processing_status', 'error')
      if (reopened.error) return reply({ error: 'Não foi possível reabrir o evento para reconciliação.' }, 500)
    }
  }

  const markEvent = async (processingStatus: 'processed' | 'ignored' | 'error', errorMessage: string | null = null) => {
    const result = await client.from('asaas_webhook_events').update({
      processing_status: processingStatus,
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    }).eq('asaas_event_id', eventId)
    if (result.error) throw result.error
  }

  try {
    if (!paymentId) {
      await markEvent('ignored')
      return reply({ ok: true, ignored: true })
    }

    const transition = paymentTransitions[eventType]
    if (!transition) {
      await markEvent('ignored')
      return reply({ ok: true, ignored: true })
    }

    const orderLookup = await client.from('orders')
      .select('id,status,payment_status,payment_received_at')
      .eq('provider_payment_id', paymentId)
      .maybeSingle()
    if (orderLookup.error) throw orderLookup.error
    if (!orderLookup.data) {
      const reconciliationMessage = 'Pagamento Asaas não localizado; reconciliação necessária.'
      await markEvent('error', reconciliationMessage)
      // O evento foi recebido e registrado, mas não deve parecer processado.
      // O 2xx evita retries infinitos para um identificador que não existe.
      return reply({ ok: false, reconciliation_required: true, error: reconciliationMessage })
    }

    const currentStatus = typeof orderLookup.data.payment_status === 'string' ? orderLookup.data.payment_status : null
    if (!canApplyTransition(currentStatus, transition.paymentStatus)) {
      await markEvent('ignored', 'Evento fora de ordem; estado mais recente preservado.')
      return reply({ ok: true, ignored: true, stale: true })
    }

    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      payment_status: transition.paymentStatus,
      payment_last_event_at: now,
      payment_error: null,
    }
    if (transition.orderStatus === 'confirmed') {
      update.payment_received_at = orderLookup.data.payment_received_at ?? now
      update.status = 'confirmed'
      update.confirmed_at = orderLookup.data.payment_received_at ?? now
    }
    if (transition.orderStatus === 'cancelled') update.status = 'cancelled'

    const orderStatusAligned = !transition.orderStatus || orderLookup.data.status === transition.orderStatus
    const sameStateWithTimestamp = currentStatus === transition.paymentStatus
      && orderStatusAligned
      && (transition.paymentStatus !== 'confirmed' || Boolean(orderLookup.data.payment_received_at))
    if (!sameStateWithTimestamp) {
      // A atualização condicional mantém a transição monotônica mesmo se dois
      // webhooks chegarem simultaneamente em ordem diferente.
      const allowedCurrentStatuses = knownPaymentStatuses.filter((status) => paymentStatusRank[status] <= paymentStatusRank[transition.paymentStatus])
      const orderResult = await client.from('orders')
        .update(update)
        .eq('provider_payment_id', paymentId)
        .in('payment_status', allowedCurrentStatuses)
        .select('id,status,payment_status')
      if (orderResult.error) throw orderResult.error
      if (!orderResult.data?.length) {
        await markEvent('ignored', 'Evento fora de ordem; estado mais recente preservado.')
        return reply({ ok: true, ignored: true, stale: true })
      }
    }

    if (eventType === 'PAYMENT_RECEIVED') {
      const bookingUpdate = await client.from('evaluation_bookings')
        .update({ status: 'awaiting_approval', payment_confirmed_at: now, updated_at: now })
        .eq('order_id', orderLookup.data.id)
        .eq('status', 'payment_pending')
      if (bookingUpdate.error) throw bookingUpdate.error
    }

    await markEvent('processed')
    return reply({ ok: true })
  } catch (error) {
    console.error('[asaas-webhook]', error instanceof Error ? error.message : 'unknown error')
    try {
      await markEvent('error', 'Falha ao atualizar o pedido; reconciliação necessária.')
    } catch (journalError) {
      console.error('[asaas-webhook] journal update failed', journalError instanceof Error ? journalError.message : 'unknown error')
    }
    return reply({ error: 'Evento recebido, mas precisa de reconciliação.' }, 500)
  }
})

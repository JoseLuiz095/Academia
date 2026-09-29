import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { validateStaticPixBase } from '../../lib/pix'

type Payment = {
  id: string
  workspace_id: string
  requested_by: string
  plan_code: 'starter' | 'creator' | 'pro'
  amount_cents: number
  status: 'pending' | 'proof_sent' | 'paid' | 'rejected'
  pix_code: string | null
  pix_key: string | null
  pix_receiver: string | null
  pix_city: string | null
  reference: string | null
  proof_sent_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  reviewer_note: string | null
  created_at: string
}

type BillingSettings = {
  pix_key: string | null
  pix_receiver: string | null
  pix_city: string | null
  pix_static_code: string | null
  whatsapp: string | null
}

const planNames = { starter: 'Essencial', creator: 'Criador', pro: 'Crescimento' }
const statusNames = { pending: 'Aguardando pagamento', proof_sent: 'Comprovante informado', paid: 'Pago', rejected: 'Recusado' }
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const emptySettings: BillingSettings = { pix_key: '', pix_receiver: '', pix_city: '', pix_static_code: '', whatsapp: '' }

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

export function MasterPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<BillingSettings>(emptySettings)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setLoading(true)
    const [paymentsResult, workspacesResult, settingsResult] = await Promise.all([
      supabase.from('subscription_payments').select('id,workspace_id,requested_by,plan_code,amount_cents,status,pix_code,pix_key,pix_receiver,pix_city,reference,proof_sent_at,reviewed_at,reviewed_by,reviewer_note,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('workspaces').select('id,name'),
      supabase.from('platform_billing_settings').select('pix_key,pix_receiver,pix_city,pix_static_code,whatsapp').eq('id', true).maybeSingle(),
    ])
    const queryError = paymentsResult.error ?? workspacesResult.error ?? settingsResult.error
    if (queryError) setError(queryError.message)
    else {
      setPayments((paymentsResult.data ?? []) as Payment[])
      setNames(Object.fromEntries((workspacesResult.data ?? []).map((item) => [item.id, item.name])))
      setSettings((settingsResult.data as BillingSettings | null) ?? emptySettings)
      setError(settingsResult.data ? '' : 'Configuração Pix da plataforma não encontrada (id=true).')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || savingSettings) return
    let staticCode = settings.pix_static_code?.trim() || null
    try { if (staticCode) staticCode = validateStaticPixBase(staticCode) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Pix estático inválido.'); return }
    if (!staticCode && !(settings.pix_key?.trim() && settings.pix_receiver?.trim() && settings.pix_city?.trim())) {
      setError('Informe um Pix estático válido ou chave, favorecido e cidade.')
      return
    }
    setSavingSettings(true); setError(''); setMessage('')
    const { data, error: updateError } = await supabase.from('platform_billing_settings').update({
      pix_key: settings.pix_key?.trim() || null,
      pix_receiver: settings.pix_receiver?.trim() || null,
      pix_city: settings.pix_city?.trim() || null,
      pix_static_code: staticCode,
      whatsapp: settings.whatsapp?.replace(/\D/g, '') || null,
    }).eq('id', true).select('id').single()
    if (updateError || !data) setError(updateError?.message ?? 'Configuração não atualizada.')
    else { setMessage('Dados Pix da plataforma salvos.'); await load() }
    setSavingSettings(false)
  }

  async function review(payment: Payment, decision: 'approve' | 'reject') {
    if (!supabase || busyId) return
    const reviewerNote = notes[payment.id]?.trim() || null
    if (decision === 'approve' && payment.status !== 'proof_sent') {
      setError('Aguarde o criador informar o envio do comprovante.')
      return
    }
    if (decision === 'reject' && (!reviewerNote || reviewerNote.length < 5)) {
      setError('Informe um motivo com pelo menos 5 caracteres para recusar.')
      return
    }
    if (!window.confirm(decision === 'approve'
      ? `Você conferiu no banco o crédito de ${money.format(payment.amount_cents / 100)} de ${names[payment.workspace_id] ?? payment.workspace_id}, com a referência ${payment.reference ?? payment.id}? Somente a confirmação avança o vencimento.`
      : `Recusar a cobrança ${payment.reference ?? payment.id}?`)) return
    setBusyId(payment.id); setError(''); setMessage('')
    const { error: reviewError } = await supabase.rpc('review_subscription_payment', {
      target_payment_id: payment.id, decision, reviewer_note: reviewerNote,
    })
    if (reviewError) setError(reviewError.message)
    else { setMessage(decision === 'approve' ? 'Pagamento confirmado e assinatura atualizada.' : 'Pagamento recusado.'); await load() }
    setBusyId(null)
  }

  const pending = payments.filter((payment) => payment.status === 'pending' || payment.status === 'proof_sent')
  const history = payments.filter((payment) => payment.status === 'paid' || payment.status === 'rejected')
  return <>
    <div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Pagamentos e Pix</h1><p className="intro-description">Confira o crédito no banco antes de confirmar. Só a revisão pelo Master ativa a assinatura.</p></div><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>Atualizar ↻</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}

    <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Conferência manual</span><h2>{pending.length} cobrança(s) pendente(s)</h2></div></div>
      {loading ? <p className="empty-copy">Carregando pagamentos…</p> : pending.length ? <div className="request-list">{pending.map((payment) => <article className="request-card" key={payment.id}><div className="request-card-main"><span className="status-pill">{statusNames[payment.status]}</span><h3>{names[payment.workspace_id] ?? payment.workspace_id}</h3><p>{planNames[payment.plan_code]} · {money.format(payment.amount_cents / 100)} · referência {payment.reference ?? payment.id}</p><small>Criada em {formatDate(payment.created_at)} · comprovante informado em {formatDate(payment.proof_sent_at)}</small><small>Recebedor: {payment.pix_receiver || 'Não informado'} · chave: {payment.pix_key || 'Código Pix na cobrança'}</small>{payment.status === 'pending' && <p>Aguardando o criador informar o envio do comprovante. A confirmação de crédito fica disponível depois disso.</p>}<label>Observação da análise<textarea value={notes[payment.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [payment.id]: event.target.value }))} placeholder="Obrigatória para recusar" /></label></div><div className="request-card-actions"><button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => void review(payment, 'reject')}>Recusar</button><button type="button" className="primary-button" disabled={Boolean(busyId) || payment.status !== 'proof_sent'} onClick={() => void review(payment, 'approve')}>{busyId === payment.id ? 'Processando…' : 'Confirmar crédito Pix'}</button></div></article>)}</div> : <p className="empty-copy">Nenhuma cobrança aguardando análise.</p>}
    </section>

    <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Pix da plataforma</span><h2>Dados para mensalidades</h2></div></div><p>Estes dados são usados para novas cobranças da plataforma. O Pix das vendas de cada espaço é configurado separadamente.</p><form onSubmit={(event) => void saveSettings(event)}><div className="form-row"><label>Chave Pix<input value={settings.pix_key ?? ''} onChange={(event) => setSettings((current) => ({ ...current, pix_key: event.target.value }))} /></label><label>Favorecido<input value={settings.pix_receiver ?? ''} onChange={(event) => setSettings((current) => ({ ...current, pix_receiver: event.target.value }))} /></label><label>Cidade<input value={settings.pix_city ?? ''} onChange={(event) => setSettings((current) => ({ ...current, pix_city: event.target.value }))} /></label><label>WhatsApp financeiro<input inputMode="tel" value={settings.whatsapp ?? ''} onChange={(event) => setSettings((current) => ({ ...current, whatsapp: event.target.value }))} placeholder="55 + DDD + número" /></label></div><label>Pix copia e cola estático base (opcional)<textarea rows={3} value={settings.pix_static_code ?? ''} onChange={(event) => setSettings((current) => ({ ...current, pix_static_code: event.target.value }))} /></label><div className="form-actions"><button type="submit" className="primary-button" disabled={savingSettings || loading}>{savingSettings ? 'Salvando…' : 'Salvar dados Pix'}</button></div></form></section>

    <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Histórico</span><h2>Pagamentos analisados</h2></div></div>{history.length ? <div className="simple-list">{history.map((payment) => <div key={payment.id}><div><strong>{names[payment.workspace_id] ?? payment.workspace_id}</strong><small>{planNames[payment.plan_code]} · {money.format(payment.amount_cents / 100)} · {payment.reference ?? payment.id.slice(0, 8)}</small><small>{payment.reviewer_note || 'Sem observação'} · {formatDate(payment.reviewed_at)}</small></div><span>{statusNames[payment.status]}</span></div>)}</div> : <p className="empty-copy">Nenhum pagamento analisado.</p>}</section>
  </>
}

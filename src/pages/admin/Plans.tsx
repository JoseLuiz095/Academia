import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { buildPixCopyPaste, buildPixFromStaticBase, readStaticPixReceiver } from '../../lib/pix'
import { supabase } from '../../lib/supabase'

type PlanCode = 'demo' | 'starter' | 'creator' | 'pro'
type PlatformPlan = { code: PlanCode; name: string; monthly_price_cents: number; product_limit: number; ai_daily_limit: number; enabled: boolean }
type Payment = {
  id: string
  workspace_id: string
  plan_code: PlanCode
  previous_plan_code: PlanCode | null
  payment_intent: 'renewal' | 'plan_change'
  amount_cents: number
  status: 'pending' | 'proof_sent' | 'paid' | 'rejected'
  pix_code: string | null
  pix_key: string | null
  pix_receiver: string | null
  pix_city: string | null
  reference: string | null
  proof_sent_at: string | null
  reviewed_at: string | null
  reviewer_note: string | null
  created_at: string
}

const planDescriptions: Record<PlanCode, string> = {
  demo: 'Período de demonstração de 14 dias, sem cobrança automática.',
  starter: 'Para começar a organizar sua presença.',
  creator: 'O equilíbrio para vender e publicar com consistência.',
  pro: 'Para quem já tem uma rotina comercial ativa.',
}
const statusNames: Record<Payment['status'], string> = { pending: 'Aguardando pagamento', proof_sent: 'Aguardando conferência', paid: 'Confirmado', rejected: 'Não confirmado' }
const intentNames = { renewal: 'Renovação', plan_change: 'Alteração de plano' }
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

function dateLabel(value: string | null | undefined) {
  if (!value) return 'A definir'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'A definir' : dateFormat.format(date)
}

export function AdminPlans() {
  const { workspace, refresh } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [availablePlans, setAvailablePlans] = useState<PlatformPlan[]>([])
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !workspace) { setLoading(false); return }
    setLoading(true)
    const [paymentResult, billingResult, plansResult] = await Promise.all([
      supabase.from('subscription_payments').select('id,workspace_id,plan_code,previous_plan_code,payment_intent,amount_cents,status,pix_code,pix_key,pix_receiver,pix_city,reference,proof_sent_at,reviewed_at,reviewer_note,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('platform_billing_settings').select('whatsapp').eq('id', true).maybeSingle(),
      supabase.from('platform_plans').select('code,name,monthly_price_cents,product_limit,ai_daily_limit,enabled'),
    ])
    if (paymentResult.error) setError(paymentResult.error.message)
    else { setPayments((paymentResult.data ?? []) as Payment[]); setError(billingResult.error?.message ?? plansResult.error?.message ?? '') }
    if (!plansResult.error) setAvailablePlans((plansResult.data ?? []) as PlatformPlan[])
    setWhatsapp(billingResult.data?.whatsapp ?? '')
    setLoading(false)
  }, [workspace?.id])

  useEffect(() => { void load() }, [load])

  const currentCode = workspace?.plan_code ?? 'starter'
  const currentPlan = availablePlans.find((plan) => plan.code === currentCode)
  const selectablePlans = availablePlans.filter((plan) => plan.enabled && plan.code !== 'demo').sort((a, b) => ['starter', 'creator', 'pro'].indexOf(a.code) - ['starter', 'creator', 'pro'].indexOf(b.code))
  const due = workspace?.subscription_ends_at ? new Date(workspace.subscription_ends_at).getTime() : null
  const daysRemaining = due !== null && Number.isFinite(due) ? Math.ceil((due - Date.now()) / 86400000) : null
  const statusLabel = workspace?.subscription_status === 'cancelled' ? 'Cancelada' : daysRemaining !== null && daysRemaining <= 0 ? 'Vencida' : workspace?.subscription_status === 'trial' ? 'Período de teste' : workspace?.subscription_status === 'past_due' ? 'Vencida' : 'Ativa'
  const openPayment = payments.find((payment) => payment.status === 'pending' || payment.status === 'proof_sent')
  const lastPaid = payments.find((payment) => payment.status === 'paid')
  const lastRejected = payments.find((payment) => payment.status === 'rejected')
  let pixCode = ''
  let pixReceiver = openPayment?.pix_receiver ?? ''
  if (openPayment) {
    try {
      if (openPayment.pix_code) {
        pixCode = buildPixFromStaticBase(openPayment.pix_code, openPayment.amount_cents / 100)
        pixReceiver = readStaticPixReceiver(openPayment.pix_code)
      }
      else if (openPayment.pix_key && openPayment.pix_receiver && openPayment.pix_city) {
        pixCode = buildPixCopyPaste({ key: openPayment.pix_key, receiver: openPayment.pix_receiver, city: openPayment.pix_city, amount: openPayment.amount_cents / 100 })
      }
    } catch { pixCode = '' }
  }
  const phone = whatsapp.replace(/\D/g, '')

  async function requestPayment(planCode: PlanCode) {
    if (!supabase || !workspace || busy || openPayment) return
    setBusy(true); setError(''); setMessage('')
    const { error: requestError } = await supabase.rpc('request_subscription_payment', { target_workspace_id: workspace.id, target_plan_code: planCode })
    if (requestError) setError(requestError.message)
    else { setMessage('Cobrança solicitada. Confira os dados Pix abaixo.'); await load() }
    setBusy(false)
  }

  async function copyPix() {
    if (!pixCode) return
    try { await navigator.clipboard.writeText(pixCode); setMessage('Código Pix copiado.') }
    catch { setError('Não foi possível copiar. Selecione o código e copie manualmente.') }
  }

  async function markProofSent() {
    if (!supabase || !openPayment || busy || openPayment.status !== 'pending') return
    setBusy(true); setError(''); setMessage('')
    const { error: proofError } = await supabase.rpc('mark_subscription_proof_sent', { target_payment_id: openPayment.id })
    if (proofError) setError(proofError.message)
    else { setMessage('Comprovante informado. Aguarde a conferência do Admin Master.'); await load() }
    setBusy(false)
  }

  async function sendProofWhatsApp() {
    if (!openPayment || !phone || busy || openPayment.status !== 'pending') return
    const popup = window.open(`https://wa.me/${phone}?text=${proofText}`, '_blank', 'noopener,noreferrer')
    if (!popup) { setError('O navegador bloqueou a abertura do WhatsApp. Permita pop-ups e tente novamente.'); return }
    await markProofSent()
  }

  async function update() {
    await Promise.all([load(), refresh().catch(() => setError('Não foi possível atualizar o vencimento. Tente novamente.'))])
  }

  const proofText = openPayment && workspace ? encodeURIComponent(`Olá! Enviei o comprovante do Pix da assinatura Impulso.\n\nEspaço: ${workspace.name}\nPlano: ${availablePlans.find((plan) => plan.code === openPayment.plan_code)?.name ?? openPayment.plan_code}\nValor: ${money.format(openPayment.amount_cents / 100)}\nReferência: ${openPayment.reference ?? openPayment.id}\n\nVou anexar o comprovante nesta conversa.`) : ''

  return <>
    <div className="page-intro"><div><p className="eyebrow">Conta e crescimento</p><h1>Plano e assinatura</h1><p className="intro-description">Solicite a mensalidade, pague pelo Pix e envie o comprovante. O vencimento só muda após a confirmação do financeiro.</p></div><button type="button" className="secondary-button" onClick={() => void update()} disabled={loading || busy}>Atualizar ↻</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    <section className={`subscription-overview ${statusLabel === 'Vencida' ? 'is-expired' : ''}`}><div><span className="subscription-label">Plano atual</span><h2>{currentPlan?.name ?? currentCode}</h2><p>{planDescriptions[currentCode]}</p></div><div className="subscription-status"><span className="status-pill">{statusLabel}</span><strong>{dateLabel(workspace?.subscription_ends_at)}</strong><small>{daysRemaining !== null && daysRemaining > 0 ? `Faltam ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} para o vencimento` : daysRemaining !== null ? 'Vencimento não renovado' : 'Vencimento ainda não definido'}</small></div></section>

    {openPayment && <section className="panel" aria-label="Cobrança Pix em aberto"><div className="panel-heading"><div><span className="panel-kicker">{intentNames[openPayment.payment_intent] ?? 'Renovação'} · Pix manual · {statusNames[openPayment.status]}</span><h2>{availablePlans.find((plan) => plan.code === openPayment.plan_code)?.name ?? openPayment.plan_code} · {money.format(openPayment.amount_cents / 100)}</h2></div></div><p>Referência {openPayment.reference ?? openPayment.id} · solicitada em {dateLabel(openPayment.created_at)}. Confira valor e recebedor no seu banco antes de pagar.</p><div className="checkout-payee"><span>Recebedor</span><strong>{pixReceiver || 'Consulte o financeiro'}</strong><span>Valor</span><strong>{money.format(openPayment.amount_cents / 100)}</strong></div>{pixCode ? <><label>Pix copia e cola com valor<textarea readOnly rows={4} value={pixCode} /></label><button type="button" className="secondary-button" onClick={() => void copyPix()}>Copiar Pix</button></> : openPayment.pix_key ? <><label>Chave Pix<input readOnly value={openPayment.pix_key} /></label><p className="field-help">Esta chave não inclui o valor. Informe {money.format(openPayment.amount_cents / 100)} no aplicativo do banco.</p></> : <p className="form-error">Dados Pix indisponíveis nesta cobrança. Fale com o financeiro antes de pagar.</p>}{openPayment.status === 'pending' ? <><p className="field-help">Depois de pagar, clique para abrir o WhatsApp, anexe o comprovante e envie a mensagem. Ao abrir o canal, a cobrança ficará aguardando conferência; a aprovação ainda depende do Admin Master conferir o crédito.</p><div className="form-actions form-actions-start">{phone ? <button type="button" className="primary-button" disabled={busy} onClick={() => void sendProofWhatsApp()}>{busy ? 'Registrando…' : 'Enviar comprovante pelo WhatsApp ↗'}</button> : <p className="field-help">WhatsApp financeiro não configurado. Peça ao Admin Master o canal para enviar o comprovante antes de pagar.</p>}</div></> : <p className="form-success" role="status">Comprovante informado em {dateLabel(openPayment.proof_sent_at)}. A cobrança está aguardando a conferência do Admin Master; a assinatura será atualizada somente após a confirmação do crédito.</p>}</section>}

    {lastRejected && (!lastPaid || lastRejected.created_at > lastPaid.created_at) && <section className="panel"><span className="panel-kicker">Última cobrança não confirmada</span><p>{lastRejected.reviewer_note || 'O financeiro não confirmou o pagamento.'} Você pode solicitar uma nova cobrança.</p></section>}
    {lastPaid && <section className="panel"><span className="panel-kicker">Último pagamento confirmado</span><p>{availablePlans.find((plan) => plan.code === lastPaid.plan_code)?.name ?? lastPaid.plan_code} · {money.format(lastPaid.amount_cents / 100)} · confirmado em {dateLabel(lastPaid.reviewed_at)} · referência {lastPaid.reference ?? lastPaid.id}</p></section>}
    <section className="plan-note"><span>✓</span><div><strong>Conferência manual</strong><p>Solicitar, pagar ou informar o comprovante não altera o plano nem o vencimento. O Admin Master confirma após conferir o crédito.</p></div></section>
    <section className="plans-section"><div className="section-heading-inline"><div><p className="eyebrow">Escolha seu ritmo</p><h2>Planos pensados para cada fase</h2></div><small>Valor definitivo na cobrança Pix</small></div>{loading ? <p className="empty-copy">Carregando planos…</p> : selectablePlans.length ? <div className="admin-plan-grid">{currentCode === 'demo' && <article className="admin-plan-card current"><div className="admin-plan-card-head"><div><small>Seu plano atual</small><h3>Demonstração</h3></div><span className="current-mark">14 dias</span></div><strong className="plan-price">Grátis</strong><p>{planDescriptions.demo}</p><ul><li>✓ Até 10 produtos ou serviços</li><li>✓ Até 3 ideias com IA por dia</li><li>✓ Escolha um plano pago quando o teste terminar</li></ul><button type="button" className="secondary-button" disabled>Sem cobrança durante o teste</button></article>}{selectablePlans.map((plan) => <article className={`admin-plan-card ${plan.code === 'creator' ? 'featured' : ''} ${plan.code === currentCode ? 'current' : ''}`} key={plan.code}>{plan.code === 'creator' && <span className="plan-recommended">Mais escolhido</span>}<div className="admin-plan-card-head"><div><small>{plan.code === currentCode ? 'Seu plano' : 'Plano'}</small><h3>{plan.name}</h3></div>{plan.code === currentCode && <span className="current-mark">Atual</span>}</div><strong className="plan-price">{money.format(plan.monthly_price_cents / 100)}/mês</strong><p>{planDescriptions[plan.code]}</p><ul><li>✓ Até {plan.product_limit} produtos ou serviços</li><li>✓ Até {plan.ai_daily_limit} ideias com IA por dia</li><li>✓ Pedidos, Pix e atendimento no WhatsApp</li></ul><button type="button" className={plan.code === currentCode ? 'secondary-button' : 'primary-button'} disabled={loading || busy || Boolean(openPayment)} onClick={() => void requestPayment(plan.code)}>{busy ? 'Solicitando…' : openPayment ? 'Cobrança em aberto' : plan.code === currentCode ? 'Renovar com Pix' : `Solicitar ${plan.name}`}</button></article>)}</div> : <p className="empty-copy">Nenhum plano disponível para solicitação.</p>}</section>
    <section className="panel plan-next-steps"><div><span className="panel-kicker">Próximos passos</span><h2>Prepare sua vitrine</h2><p>Enquanto aguarda a conferência, você pode organizar seus produtos e ajustar a apresentação do espaço.</p></div><div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/admin/produtos">Organizar catálogo →</Link><Link className="secondary-button plain-link" to="/admin/configuracoes">Ajustar vitrine →</Link></div></section>
  </>
}

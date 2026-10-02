import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { WorkspaceRequest } from '../../types'

type PlatformPlan = { code: WorkspaceRequest['plan_code']; name: string; monthly_price_cents: number; product_limit: number; ai_daily_limit: number; enabled: boolean }
type RequestWithContact = WorkspaceRequest & { owner_email?: string | null }
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function MasterRequests() {
  const [requests, setRequests] = useState<RequestWithContact[]>([])
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setLoading(true); setError('')
    const [requestsResult, plansResult] = await Promise.all([
      supabase.from('workspace_requests').select('id,owner_id,owner_email,name,slug,niche,plan_code,status,payment_status,payment_amount_cents,payment_reference,payment_pix_receiver,payment_whatsapp,payment_proof_declared_at,reviewer_note,created_at,reviewed_at').eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('platform_plans').select('code,name,monthly_price_cents,product_limit,ai_daily_limit,enabled'),
    ])
    if (requestsResult.error) setError('Não foi possível carregar as solicitações.')
    else setRequests((requestsResult.data ?? []) as RequestWithContact[])
    if (plansResult.error) setPlansError('Não foi possível consultar os planos. A aprovação está indisponível até atualizar os dados.')
    else { setPlans((plansResult.data ?? []) as PlatformPlan[]); setPlansError('') }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function review(request: WorkspaceRequest, decision: 'approve' | 'reject') {
    if (!supabase || busyId) return
    const selectedPlan = plans.find((plan) => plan.code === request.plan_code)
    if (decision === 'approve' && (plansError || !selectedPlan?.enabled)) { setError('O plano solicitado está indisponível. Atualize os dados antes de aprovar.'); return }
    if (decision === 'approve' && request.plan_code !== 'demo' && request.payment_status !== 'proof_sent') { setError('Este plano pago só pode ser aprovado depois que o criador declarar o envio do comprovante.'); return }
    setBusyId(request.id); setError(''); setMessage('')
    const note = decision === 'reject' ? 'Solicitação recusada pelo Admin Master. Revise os dados e envie novamente.' : null
    const { error: reviewError } = await supabase.rpc('review_workspace_request', { target_request_id: request.id, decision, reviewer_note: note })
    if (reviewError) setError(reviewError.message)
    else { await load(); setMessage(decision === 'approve' ? (request.plan_code === 'demo' ? `${request.name} aprovado com 14 dias de teste.` : `${request.name} aprovado. O plano pago ficará ativo após a conferência registrada.`) : `${request.name} marcado para revisão. O criador pode ajustar os dados e enviar novamente.`) }
    setBusyId(null)
  }

  return <><div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Solicitações de acesso</h1><p className="intro-description">Demo segue para análise sem cobrança. Planos pagos só aparecem aqui depois do Pix, do comprovante enviado pelo WhatsApp e da confirmação do criador.</p></div><button className="secondary-button" disabled={loading || Boolean(busyId)} onClick={() => void load()}>Atualizar ↻</button></div>{error && <p className="form-error" role="alert">{error}</p>}{plansError && <p className="form-error" role="alert">{plansError}</p>}{message && <p className="form-success" role="status">{message}</p>}<section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Fila de aprovação</span><h2>{requests.length ? `${requests.length} aguardando análise` : 'Tudo em dia'}</h2></div></div>{loading ? <p className="empty-copy">Carregando solicitações…</p> : requests.length ? <div className="request-list">{requests.map((request) => { const plan = plans.find((item) => item.code === request.plan_code); const paid = request.plan_code !== 'demo'; const canApprove = !paid || request.payment_status === 'proof_sent'; return <article className="request-card" key={request.id}><div className="request-card-main"><span className="status-pill">{paid ? (canApprove ? 'Comprovante informado' : 'Aguardando pagamento') : 'Demo pendente'}</span><h3>{request.name}</h3><p>/p/{request.slug} · {request.niche === 'fitness' ? 'Fitness e treinamento' : request.niche === 'wellness' ? 'Bem-estar' : 'Outro criador'}</p><strong>{plan ? `${plan.name} · ${currency.format(plan.monthly_price_cents / 100)}/mês` : 'Plano indisponível'}</strong>{paid && <small>Pix: {currency.format((request.payment_amount_cents ?? 0) / 100)} · referência {request.payment_reference ?? request.id}</small>}{paid && <small>Comprovante: {canApprove ? 'declarado pelo criador' : 'ainda não declarado'} · WhatsApp {request.payment_whatsapp || 'não configurado'}</small>}{request.owner_email && <small>Contato da conta: {request.owner_email}</small>}{plan && <small>Até {plan.product_limit} produtos ou serviços · {plan.ai_daily_limit} ideias com IA por dia</small>}{plan && !plan.enabled && <small>Plano desativado para novas solicitações.</small>}<small>Enviado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(request.created_at))}</small></div><div className="request-card-actions"><button className="secondary-button" disabled={Boolean(busyId)} onClick={() => void review(request, 'reject')}>Recusar</button><button className="primary-button" disabled={Boolean(busyId) || Boolean(plansError) || !plan?.enabled || !canApprove} onClick={() => void review(request, 'approve')}>{busyId === request.id ? 'Processando…' : 'Aprovar espaço'} <span>✓</span></button></div></article> })}</div> : <div className="empty-panel"><span>✓</span><h2>Nenhuma solicitação pendente</h2><p>Novos cadastros aparecerão aqui antes de ganhar acesso ao painel.</p></div>}</section></>
}

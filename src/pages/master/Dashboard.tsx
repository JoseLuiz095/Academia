import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Workspace } from '../../types'

type MasterWorkspace = Pick<Workspace, 'id' | 'name' | 'published' | 'plan_code' | 'subscription_status' | 'subscription_ends_at'>
type PaymentStatus = { id: string; status: string }

export function MasterDashboard() {
  const [workspaces, setWorkspaces] = useState<MasterWorkspace[]>([])
  const [payments, setPayments] = useState<PaymentStatus[]>([])
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    let active = true
    void Promise.all([
      supabase.from('workspaces').select('id,name,published,plan_code,subscription_status,subscription_ends_at').order('created_at', { ascending: false }),
      supabase.from('subscription_payments').select('id,status').in('status', ['pending', 'proof_sent']),
      supabase.from('workspace_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([workspaceResult, paymentResult, requestsResult]) => {
      if (!active) return
      setWorkspaces((workspaceResult.data ?? []) as MasterWorkspace[])
      setPayments((paymentResult.data ?? []) as PaymentStatus[])
      setPendingRequests(requestsResult.count ?? 0)
      setError(workspaceResult.error?.message ?? paymentResult.error?.message ?? requestsResult.error?.message ?? '')
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const expiring = workspaces.filter((item) => {
    if (!item.subscription_ends_at || item.subscription_status === 'cancelled') return false
    const days = Math.ceil((new Date(item.subscription_ends_at).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 7
  }).length
  const overdue = workspaces.filter((item) => item.subscription_ends_at && new Date(item.subscription_ends_at).getTime() < Date.now() && item.subscription_status !== 'cancelled').length
  const awaitingReview = payments.filter((payment) => payment.status === 'proof_sent').length

  return <>
    <div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Visão da plataforma</h1><p className="intro-description">Acompanhe assinaturas, cobranças Pix e vitrines publicadas.</p></div><div className="form-actions"><Link className="secondary-button plain-link" to="/admin-master/pagamentos">Ver pagamentos →</Link><Link className="primary-button plain-link" to="/admin-master/workspaces">Ver criadores →</Link></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loading && pendingRequests > 0 && <section className="panel editor-panel"><span className="panel-kicker">Ação pendente</span><h2>{pendingRequests} {pendingRequests === 1 ? 'solicitação aguarda' : 'solicitações aguardam'} aprovação</h2><p>Confira o plano e o contato de cada criador antes de liberar o teste.</p><Link className="secondary-button plain-link" to="/admin-master/solicitacoes">Analisar solicitações →</Link></section>}
    <section className="metric-grid"><div className="metric-card"><div className="metric-icon orange">▣</div><span className="metric-label">Espaços cadastrados</span><strong className="metric-value">{loading ? '—' : workspaces.length}</strong></div><div className="metric-card"><div className="metric-icon green">↗</div><span className="metric-label">Vitrines públicas</span><strong className="metric-value">{loading ? '—' : workspaces.filter((item) => item.published).length}</strong></div><div className="metric-card"><div className="metric-icon purple">◌</div><span className="metric-label">Vencem em 7 dias</span><strong className="metric-value">{loading ? '—' : expiring}</strong></div><div className="metric-card"><div className="metric-icon blue">◇</div><span className="metric-label">Comprovantes para conferir</span><strong className="metric-value">{loading ? '—' : awaitingReview}</strong></div></section>
    {overdue > 0 && <section className="panel"><span className="panel-kicker">Atenção</span><h2>{overdue} {overdue === 1 ? 'assinatura vencida' : 'assinaturas vencidas'}</h2><p>O vencimento de uma cobrança Pix só avança após a confirmação do crédito pelo Admin Master.</p><Link className="secondary-button plain-link" to="/admin-master/workspaces">Ver espaços →</Link></section>}
    <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Crescimento</span><h2>Espaços recentes</h2></div><Link className="text-button plain-link" to="/admin-master/workspaces">Ver todos →</Link></div>{loading ? <p className="empty-copy">Carregando espaços…</p> : workspaces.length ? <div className="simple-list">{workspaces.slice(0, 5).map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.published ? 'Publicado' : 'Em preparação'} · {item.plan_code === 'pro' ? 'Crescimento' : item.plan_code === 'creator' ? 'Criador' : 'Essencial'}</span></div>)}</div> : <p className="empty-copy">Nenhum espaço cadastrado ainda.</p>}</section>
  </>
}

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { WorkspaceRequest } from '../../types'

const planLabels = { starter: 'Essencial · R$ 29/mês', creator: 'Criador · R$ 59/mês', pro: 'Crescimento · R$ 99/mês' }

export function MasterRequests() {
  const [requests, setRequests] = useState<WorkspaceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    if (!supabase) return
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase.from('workspace_requests').select('id,owner_id,name,slug,niche,plan_code,status,reviewer_note,created_at,reviewed_at').eq('status', 'pending').order('created_at', { ascending: true })
    setRequests((data ?? []) as WorkspaceRequest[])
    if (queryError) setError('Não foi possível carregar as solicitações.')
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function review(request: WorkspaceRequest, decision: 'approve' | 'reject') {
    if (!supabase) return
    setBusyId(request.id); setError(''); setMessage('')
    const note = decision === 'reject' ? 'Solicitação recusada pelo Admin Master. Revise os dados e envie novamente.' : null
    const { error: reviewError } = await supabase.rpc('review_workspace_request', { target_request_id: request.id, decision, reviewer_note: note })
    if (reviewError) setError(reviewError.message)
    else { setMessage(decision === 'approve' ? `${request.name} aprovado e liberado para o plano ${planLabels[request.plan_code]}.` : `${request.name} marcado para revisão.`); await load() }
    setBusyId(null)
  }

  return <><div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Solicitações de acesso</h1><p className="intro-description">Revise o cadastro e o plano antes de liberar cada espaço.</p></div><button className="secondary-button" onClick={() => void load()}>Atualizar ↻</button></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Fila de aprovação</span><h2>{requests.length ? `${requests.length} aguardando análise` : 'Tudo em dia'}</h2></div></div>{loading ? <p className="empty-copy">Carregando solicitações…</p> : requests.length ? <div className="request-list">{requests.map((request) => <article className="request-card" key={request.id}><div className="request-card-main"><span className="status-pill">Pendente</span><h3>{request.name}</h3><p>/p/{request.slug} · {request.niche === 'fitness' ? 'Fitness e treinamento' : request.niche === 'wellness' ? 'Bem-estar' : 'Outro criador'}</p><strong>{planLabels[request.plan_code]}</strong><small>Enviado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(request.created_at))}</small></div><div className="request-card-actions"><button className="secondary-button" disabled={busyId === request.id} onClick={() => void review(request, 'reject')}>Recusar</button><button className="primary-button" disabled={busyId === request.id} onClick={() => void review(request, 'approve')}>{busyId === request.id ? 'Processando…' : 'Aprovar espaço'} <span>✓</span></button></div></article>)}</div> : <div className="empty-panel"><span>✓</span><h2>Nenhuma solicitação pendente</h2><p>Novos cadastros aparecerão aqui antes de ganhar acesso ao painel.</p></div>}</section></>
}

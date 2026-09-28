import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeSlug } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { WorkspaceRequest } from '../../types'

const planLabels = { starter: 'Essencial · R$ 29/mês', creator: 'Criador · R$ 59/mês', pro: 'Crescimento · R$ 99/mês' }

export function AdminOnboarding() {
  const { user, workspace, refresh } = useAuth()
  const [request, setRequest] = useState<WorkspaceRequest | null>(null)
  const [requestLoading, setRequestLoading] = useState(true)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [niche, setNiche] = useState('fitness')
  const [plan, setPlan] = useState<'starter' | 'creator' | 'pro'>('creator')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase || !user || workspace) { setRequestLoading(false); return }
    let active = true
    void supabase.from('workspace_requests').select('id,owner_id,name,slug,niche,plan_code,status,reviewer_note,created_at,reviewed_at').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => { if (active) { setRequest((data ?? null) as WorkspaceRequest | null); setRequestLoading(false) } })
    return () => { active = false }
  }, [user?.id, workspace?.id])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user) return
    const safeSlug = normalizeSlug(slug || name)
    if (safeSlug.length < 3) { setError('Use um endereço com pelo menos 3 caracteres.'); return }
    setBusy(true); setError('')
    const { data, error: requestError } = await supabase.rpc('create_owner_workspace', { workspace_name: name.trim(), workspace_slug: safeSlug, workspace_niche: niche, workspace_plan: plan })
    if (requestError) { setError(requestError.code === '23505' ? 'Este endereço já está em uso.' : requestError.message); setBusy(false); return }
    setRequest({ id: String(data), owner_id: user.id, name: name.trim(), slug: safeSlug, niche: niche as WorkspaceRequest['niche'], plan_code: plan, status: 'pending', reviewer_note: null, created_at: new Date().toISOString() })
    setBusy(false)
  }

  if (requestLoading) return <div className="loading-page">Consultando sua solicitação…</div>
  if (workspace) return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>Seu espaço está criado</h1><p className="intro-description">Siga esta ordem para compartilhar sua página com segurança.</p></div></div><div className="step-list"><Link to="/admin/configuracoes"><b>01</b><span><strong>Configure seu perfil público</strong><small>Descrição, WhatsApp, cidade e Pix.</small></span><em>→</em></Link><Link to="/admin/produtos"><b>02</b><span><strong>Cadastre seus produtos e serviços</strong><small>Manuais, avaliações, roupas ou acessórios.</small></span><em>→</em></Link><Link to="/admin/conteudo"><b>03</b><span><strong>Prepare seu conteúdo</strong><small>Defina público, tom e temas da sua comunicação.</small></span><em>→</em></Link><Link to="/admin/configuracoes"><b>04</b><span><strong>Publique a vitrine</strong><small>Compartilhe o link quando estiver pronta.</small></span><em>→</em></Link></div></>

  if (request?.status === 'pending') return <><div className="page-intro"><div><p className="eyebrow">Cadastro recebido</p><h1>Aguardando aprovação</h1><p className="intro-description">O Admin Master precisa revisar seu espaço antes de liberar o painel.</p></div></div><section className="approval-card"><div className="approval-icon">◷</div><div><span className="status-pill">Em análise</span><h2>{request.name}</h2><p>Plano solicitado: <strong>{planLabels[request.plan_code]}</strong></p><p>Assim que o espaço for aprovado, você poderá configurar a vitrine, cadastrar produtos e usar o conteúdo com IA.</p></div></section><div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/">Voltar para a página inicial</Link><button className="secondary-button" onClick={() => void refresh().catch(() => {})}>Atualizar status ↻</button></div></>

  return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>{request?.status === 'rejected' ? 'Ajuste sua solicitação' : 'Crie seu espaço'}</h1><p className="intro-description">{request?.status === 'rejected' ? 'O Admin Master pediu uma revisão antes de liberar o cadastro.' : 'Escolha o plano inicial e envie seu espaço para aprovação.'}</p></div></div>{request?.reviewer_note && <p className="form-error" role="alert">Observação do Admin Master: {request.reviewer_note}</p>}<section className="panel form-panel"><form onSubmit={(event) => void create(event)} className="form-grid"><label>Nome público<input required minLength={3} maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(normalizeSlug(event.target.value)) }} placeholder="Ex.: Personal Carlos" /></label><label>Endereço da página<div className="input-prefix"><span>impulso/p/</span><input required minLength={3} value={slug} onChange={(event) => setSlug(normalizeSlug(event.target.value))} placeholder="personal-carlos" /></div></label><label>Área de atuação<select value={niche} onChange={(event) => setNiche(event.target.value)}><option value="fitness">Fitness e treinamento</option><option value="wellness">Bem-estar</option><option value="creator">Outro criador</option></select></label><label>Plano inicial<select value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)}><option value="starter">{planLabels.starter}</option><option value="creator">{planLabels.creator}</option><option value="pro">{planLabels.pro}</option></select></label><p className="field-help">A escolha será analisada pelo Admin Master. A assinatura começa somente após a aprovação; não há cobrança automática nesta etapa.</p>{error && <p className="form-error" role="alert">{error}</p>}<button disabled={busy} className="primary-button">{busy ? 'Enviando…' : 'Enviar para aprovação'} <span>→</span></button></form></section></>
}

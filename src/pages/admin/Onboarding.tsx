import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeSlug } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { WorkspaceRequest } from '../../types'

type PlatformPlan = { code: WorkspaceRequest['plan_code']; name: string; monthly_price_cents: number; product_limit: number; ai_daily_limit: number }
const planOrder = ['demo', 'starter', 'creator', 'pro']
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const planLabel = (plan: PlatformPlan) => `${plan.name} · ${currency.format(plan.monthly_price_cents / 100)}/mês`

export function AdminOnboarding() {
  const { user, workspace, refresh } = useAuth()
  const [searchParams] = useSearchParams()
  const [request, setRequest] = useState<WorkspaceRequest | null>(null)
  const [requestLoading, setRequestLoading] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [niche, setNiche] = useState('fitness')
  const [plan, setPlan] = useState<WorkspaceRequest['plan_code'] | ''>(() => {
    const requested = searchParams.get('plan') || localStorage.getItem('impulso:pending-plan')
    return requested === 'demo' || requested === 'starter' || requested === 'creator' || requested === 'pro' ? requested : ''
  })
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadRequest = useCallback(async () => {
    if (!supabase || !user || workspace) { setRequestLoading(false); return }
    setRequestLoading(true)
    const { data, error: queryError } = await supabase.from('workspace_requests').select('id,owner_id,name,slug,niche,plan_code,status,reviewer_note,created_at,reviewed_at').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (queryError) setRequestError('Não foi possível consultar sua solicitação. Tente novamente.')
    else { setRequest((data ?? null) as WorkspaceRequest | null); setRequestError('') }
    setRequestLoading(false)
  }, [user?.id, workspace?.id])

  useEffect(() => { void loadRequest() }, [loadRequest])
  useEffect(() => {
    if (!supabase) { setPlansError('Não foi possível consultar os planos.'); setPlansLoading(false); return }
    let active = true
    void supabase.from('platform_plans').select('code,name,monthly_price_cents,product_limit,ai_daily_limit').eq('enabled', true).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setPlansError('Não foi possível consultar os planos. Atualize a página e tente novamente.')
      else {
        const available = ((data ?? []) as PlatformPlan[]).sort((a, b) => planOrder.indexOf(a.code) - planOrder.indexOf(b.code))
        setPlans(available)
        setPlan((current) => available.some((item) => item.code === current) ? current : available[0]?.code ?? '')
        setPlansError('')
      }
      setPlansLoading(false)
    })
    return () => { active = false }
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !plan || !plans.some((item) => item.code === plan)) { setError('Escolha um plano disponível.'); return }
    const safeSlug = normalizeSlug(slug || name)
    if (safeSlug.length < 3) { setError('Use um endereço com pelo menos 3 caracteres.'); return }
    setBusy(true); setError('')
    const { data, error: requestError } = await supabase.rpc('create_owner_workspace', { workspace_name: name.trim(), workspace_slug: safeSlug, workspace_niche: niche, workspace_plan: plan })
    if (requestError) { setError(requestError.code === '23505' ? 'Este endereço já está em uso.' : requestError.message); setBusy(false); return }
    setRequest({ id: String(data), owner_id: user.id, name: name.trim(), slug: safeSlug, niche: niche as WorkspaceRequest['niche'], plan_code: plan, status: 'pending', reviewer_note: null, created_at: new Date().toISOString() })
    localStorage.removeItem('impulso:pending-plan')
    setBusy(false)
  }

  if (requestLoading) return <div className="loading-page">Consultando sua solicitação…</div>
  if (workspace) return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>Seu espaço está criado</h1><p className="intro-description">Siga esta ordem para compartilhar sua página com segurança.</p></div></div><div className="step-list"><Link to="/admin/configuracoes"><b>01</b><span><strong>Configure seu perfil público</strong><small>Descrição, WhatsApp, cidade e Pix.</small></span><em>→</em></Link><Link to="/admin/produtos"><b>02</b><span><strong>Cadastre seus produtos e serviços</strong><small>Manuais, avaliações, roupas ou acessórios.</small></span><em>→</em></Link><Link to="/admin/conteudo"><b>03</b><span><strong>Prepare seu conteúdo</strong><small>Defina público, tom e temas da sua comunicação.</small></span><em>→</em></Link><Link to="/admin/configuracoes"><b>04</b><span><strong>Publique a vitrine</strong><small>Compartilhe o link quando estiver pronta.</small></span><em>→</em></Link></div></>

  if (requestError) return <><p className="form-error" role="alert">{requestError}</p><button className="secondary-button" onClick={() => void loadRequest()}>Tentar novamente ↻</button></>
  if (request?.status === 'approved') return <><div className="page-intro"><div><h1>Espaço aprovado</h1><p className="intro-description">O acesso foi liberado com 14 dias de teste. Atualize para abrir seu painel.</p></div></div><button className="primary-button" onClick={() => void refresh()}>Atualizar acesso ↻</button></>

  const requestedPlan = plans.find((item) => item.code === request?.plan_code)
  const selectedPlan = plans.find((item) => item.code === plan)

  if (request?.status === 'pending') return <><div className="page-intro"><div><p className="eyebrow">Cadastro recebido</p><h1>Aguardando aprovação</h1><p className="intro-description">O Admin Master revisa seu cadastro e o plano solicitado antes de liberar o painel.</p></div></div><section className="approval-card"><div className="approval-icon">◷</div><div><span className="status-pill">Em análise</span><h2>{request.name}</h2><p>Plano solicitado: <strong>{requestedPlan ? planLabel(requestedPlan) : plansLoading ? 'Consultando plano…' : request.plan_code}</strong></p>{requestedPlan && <p>Até {requestedPlan.product_limit} produtos ou serviços · {requestedPlan.ai_daily_limit} ideias com IA por dia</p>}<p>Após a aprovação, você poderá usar o espaço por 14 dias de teste. A mensalidade é solicitada depois no painel e o pagamento Pix será conferido manualmente pelo Admin Master.</p></div></section>{error && <p className="form-error" role="alert">{error}</p>}{plansError && <p className="form-error" role="alert">{plansError}</p>}<div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/">Voltar para a página inicial</Link><button className="secondary-button" onClick={() => { void Promise.all([loadRequest(), refresh().catch(() => {})]) }}>Atualizar status ↻</button></div></>

  return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>{request?.status === 'rejected' ? 'Ajuste sua solicitação' : 'Crie seu espaço'}</h1><p className="intro-description">{request?.status === 'rejected' ? 'O Admin Master pediu uma revisão antes de liberar o cadastro.' : 'Escolha um plano disponível e envie seu espaço para análise.'}</p></div></div>{request?.reviewer_note && <p className="form-error" role="alert">Observação do Admin Master: {request.reviewer_note}</p>}<section className="panel form-panel"><form onSubmit={(event) => void create(event)} className="form-grid"><label>Nome público<input required minLength={3} maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(normalizeSlug(event.target.value)) }} placeholder="Ex.: Personal Carlos" /></label><label>Endereço da página<div className="input-prefix"><span>impulso/p/</span><input required minLength={3} value={slug} onChange={(event) => setSlug(normalizeSlug(event.target.value))} placeholder="personal-carlos" /></div></label><label>Área de atuação<select value={niche} onChange={(event) => setNiche(event.target.value)}><option value="fitness">Fitness e treinamento</option><option value="wellness">Bem-estar</option><option value="creator">Outro criador</option></select></label><label>Plano inicial<select required disabled={plansLoading || Boolean(plansError) || plans.length === 0} value={plan} onChange={(event) => setPlan(event.target.value as WorkspaceRequest['plan_code'])}>{!plan && <option value="">Selecione um plano</option>}{plans.map((item) => <option key={item.code} value={item.code}>{planLabel(item)}</option>)}</select></label>{plansLoading ? <p className="field-help">Consultando planos…</p> : plansError ? <p className="form-error" role="alert">{plansError}</p> : plans.length === 0 ? <p className="form-error" role="alert">Nenhum plano disponível para novas solicitações no momento.</p> : selectedPlan && <p className="field-help">O plano selecionado permite até {selectedPlan.product_limit} produtos ou serviços e {selectedPlan.ai_daily_limit} ideias com IA por dia.</p>}<p className="field-help">O Admin Master analisa a solicitação. Após a aprovação, começam 14 dias de teste; a mensalidade é solicitada depois pelo painel, sem cobrança automática.</p>{error && <p className="form-error" role="alert">{error}</p>}<button disabled={busy || plansLoading || Boolean(plansError) || !plan} className="primary-button">{busy ? 'Enviando…' : 'Enviar para aprovação'} <span>→</span></button></form></section></>
}

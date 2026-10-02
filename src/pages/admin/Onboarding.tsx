import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { buildPixCopyPaste, buildPixFromStaticBase } from '../../lib/pix'
import { normalizeSlug } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { WorkspaceRequest } from '../../types'

type PlatformPlan = { code: WorkspaceRequest['plan_code']; name: string; monthly_price_cents: number; product_limit: number; ai_daily_limit: number }
const planOrder = ['demo', 'starter', 'creator', 'pro']
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (cents: number | null | undefined) => currency.format((cents ?? 0) / 100)
const planLabel = (plan: PlatformPlan) => `${plan.name} · ${money(plan.monthly_price_cents)}/mês`

function buildOnboardingPix(request: WorkspaceRequest) {
  const amount = (request.payment_amount_cents ?? 0) / 100
  try {
    if (request.payment_pix_static_code) return buildPixFromStaticBase(request.payment_pix_static_code, amount)
    if (request.payment_pix_key && request.payment_pix_receiver && request.payment_pix_city) {
      return buildPixCopyPaste({ key: request.payment_pix_key, receiver: request.payment_pix_receiver, city: request.payment_pix_city, amount })
    }
  } catch { return '' }
  return ''
}

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
  const [message, setMessage] = useState('')
  const [proofOpened, setProofOpened] = useState(false)
  const [proofConfirmed, setProofConfirmed] = useState(false)

  const loadRequest = useCallback(async () => {
    if (!supabase || !user || workspace) { setRequestLoading(false); return }
    setRequestLoading(true)
    const { data, error: queryError } = await supabase.from('workspace_requests')
      .select('id,owner_id,name,slug,niche,plan_code,status,payment_status,payment_amount_cents,payment_reference,payment_pix_static_code,payment_pix_key,payment_pix_receiver,payment_pix_city,payment_whatsapp,payment_proof_declared_at,reviewer_note,created_at,reviewed_at')
      .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
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
    setBusy(true); setError(''); setMessage('')
    const result = plan === 'demo'
      ? await supabase.rpc('create_owner_workspace', { workspace_name: name.trim(), workspace_slug: safeSlug, workspace_niche: niche, workspace_plan: plan })
      : await supabase.rpc('prepare_paid_workspace_request', { p_workspace_name: name.trim(), p_workspace_slug: safeSlug, p_workspace_niche: niche, p_workspace_plan: plan })
    if (result.error) { setError(result.error.code === '23505' ? 'Este endereço já está em uso.' : result.error.message); setBusy(false); return }
    localStorage.removeItem('impulso:pending-plan')
    await loadRequest()
    setMessage(plan === 'demo' ? 'Cadastro enviado para análise.' : 'Cadastro preparado. Confira o Pix e conclua o envio do comprovante pelo WhatsApp.')
    setBusy(false)
  }

  async function copyPix() {
    if (!request) return
    const pix = buildOnboardingPix(request)
    if (!pix) { setError('Os dados Pix ainda não estão completos. Fale com o Admin Master.'); return }
    try { await navigator.clipboard.writeText(pix); setMessage('Pix copia e cola copiado.') }
    catch { setError('Não foi possível copiar. Selecione o código e copie manualmente.') }
  }

  function openProofWhatsApp() {
    if (!request?.payment_whatsapp) { setError('O WhatsApp financeiro ainda não foi configurado.'); return }
    const planName = plans.find((item) => item.code === request.plan_code)?.name ?? request.plan_code
    const text = encodeURIComponent(`Olá! Quero solicitar o espaço ${request.name} no Impulso.\n\nPlano: ${planName}\nValor: ${money(request.payment_amount_cents)}\nReferência: ${request.payment_reference ?? request.id}\n\nJá realizei o Pix e vou anexar o comprovante nesta conversa.`)
    const popup = window.open(`https://wa.me/${request.payment_whatsapp}?text=${text}`, '_blank', 'noopener,noreferrer')
    if (!popup) { setError('O navegador bloqueou o WhatsApp. Permita pop-ups e tente novamente.'); return }
    setProofOpened(true); setMessage('WhatsApp aberto. Anexe o comprovante, envie a mensagem e volte para confirmar abaixo.')
  }

  async function confirmProof() {
    if (!supabase || !request || !proofOpened || !proofConfirmed || busy) return
    setBusy(true); setError(''); setMessage('')
    const { error: proofError } = await supabase.rpc('confirm_paid_workspace_request_proof', { p_request_id: request.id })
    if (proofError) setError(proofError.message)
    else { setMessage('Solicitação enviada. O Admin Master conferirá o crédito e responderá pelo canal informado.'); setProofOpened(false); setProofConfirmed(false); await loadRequest() }
    setBusy(false)
  }

  if (requestLoading) return <div className="loading-page">Consultando sua solicitação…</div>
  if (workspace) return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>Seu espaço está criado</h1><p className="intro-description">Siga esta ordem para compartilhar sua página com segurança.</p></div></div><div className="step-list"><Link to="/admin/configuracoes"><b>01</b><span><strong>Configure seu perfil público</strong><small>Descrição, WhatsApp, cidade e Pix.</small></span><em>→</em></Link><Link to="/admin/produtos"><b>02</b><span><strong>Cadastre seus produtos e serviços</strong><small>Manuais, avaliações, roupas ou acessórios.</small></span><em>→</em></Link><Link to="/admin/conteudo"><b>03</b><span><strong>Prepare seu conteúdo</strong><small>Defina público, tom e temas da sua comunicação.</small></span><em>→</em></Link><Link to="/admin/configuracoes"><b>04</b><span><strong>Publique a vitrine</strong><small>Compartilhe o link quando estiver pronta.</small></span><em>→</em></Link></div></>

  if (requestError) return <><p className="form-error" role="alert">{requestError}</p><button className="secondary-button" onClick={() => void loadRequest()}>Tentar novamente ↻</button></>
  if (request?.status === 'approved') return <><div className="page-intro"><div><h1>Espaço aprovado</h1><p className="intro-description">O acesso foi liberado. Atualize para abrir seu painel.</p></div></div><button className="primary-button" onClick={() => void refresh()}>Atualizar acesso ↻</button></>

  const requestedPlan = plans.find((item) => item.code === request?.plan_code)
  const selectedPlan = plans.find((item) => item.code === plan)
  const pixCode = request ? buildOnboardingPix(request) : ''

  if (request?.status === 'payment_pending') return <><div className="page-intro"><div><p className="eyebrow">Pagamento da assinatura</p><h1>Confirme seu plano antes da análise</h1><p className="intro-description">O cadastro ainda não foi enviado ao Admin Master. Pague o Pix, envie o comprovante pelo WhatsApp e confirme o envio abaixo.</p></div></div><section className="panel onboarding-payment-panel"><div className="panel-heading"><div><span className="panel-kicker">{requestedPlan?.name ?? request.plan_code} · pagamento manual</span><h2>{money(request.payment_amount_cents)}</h2></div><span className="status-pill">Aguardando Pix</span></div><p>Referência <strong>{request.payment_reference ?? request.id}</strong>. Confira o valor e o recebedor no aplicativo do banco.</p><div className="checkout-payee"><span>Recebedor</span><strong>{request.payment_pix_receiver || 'Consulte o financeiro'}</strong><span>WhatsApp</span><strong>{request.payment_whatsapp || 'Não configurado'}</strong></div>{pixCode ? <><label>Pix copia e cola com valor<textarea readOnly rows={4} value={pixCode} /></label><button type="button" className="secondary-button" onClick={() => void copyPix()}>Copiar Pix</button></> : request.payment_pix_key ? <><label>Chave Pix<input readOnly value={request.payment_pix_key} /></label><p className="field-help">Esta chave não inclui o valor. Pague {money(request.payment_amount_cents)} no aplicativo do banco.</p></> : <p className="form-error">Dados Pix indisponíveis. Fale com o Admin Master antes de pagar.</p>}<div className="payment-proof-steps"><p><b>1</b>Pague o valor exato no banco.</p><p><b>2</b>Abra o WhatsApp, anexe o comprovante e envie.</p><p><b>3</b>Volte, confirme o envio e gere a solicitação.</p></div><div className="form-actions form-actions-start"><button type="button" className="primary-button" onClick={openProofWhatsApp} disabled={busy || !request.payment_whatsapp}>Abrir WhatsApp e enviar comprovante ↗</button></div><label className="check-row"><input type="checkbox" checked={proofConfirmed} disabled={!proofOpened || busy} onChange={(event) => setProofConfirmed(event.target.checked)} /><span>Confirmo que anexei e enviei o comprovante nesta conversa do WhatsApp.</span></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button type="button" className="primary-button" disabled={!proofOpened || !proofConfirmed || busy} onClick={() => void confirmProof()}>{busy ? 'Enviando solicitação…' : 'Confirmar envio e solicitar análise'} <span>→</span></button><p className="field-help">Abrir o WhatsApp não cria a solicitação. Ela só será registrada depois desta confirmação e continuará aguardando a conferência manual do Admin Master.</p></section></>

  if (request?.status === 'pending') return <><div className="page-intro"><div><p className="eyebrow">Cadastro recebido</p><h1>Aguardando aprovação</h1><p className="intro-description">O Admin Master revisará os dados e o pagamento informado antes de liberar seu espaço.</p></div></div><section className="approval-card"><div className="approval-icon">◷</div><div><span className="status-pill">Em análise</span><h2>{request.name}</h2><p>Plano solicitado: <strong>{requestedPlan ? planLabel(requestedPlan) : plansLoading ? 'Consultando plano…' : request.plan_code}</strong></p>{requestedPlan && <p>Até {requestedPlan.product_limit} produtos ou serviços · {requestedPlan.ai_daily_limit} ideias com IA por dia</p>}{request.plan_code === 'demo' ? <p>Após a aprovação, seu espaço começa com 14 dias de teste, sem cobrança automática.</p> : <p>Comprovante declarado em {request.payment_proof_declared_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.payment_proof_declared_at)) : 'data registrada'}. O plano só será ativado após a conferência do crédito.</p>}</div></section>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/">Voltar para a página inicial</Link><button className="secondary-button" onClick={() => { void Promise.all([loadRequest(), refresh().catch(() => setError('Não foi possível atualizar o acesso. Tente novamente.'))]) }}>Atualizar status ↻</button></div></>

  return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>{request?.status === 'rejected' ? 'Ajuste sua solicitação' : 'Crie seu espaço'}</h1><p className="intro-description">{request?.status === 'rejected' ? 'O Admin Master pediu uma revisão antes de liberar o cadastro.' : 'Escolha Demo para testar ou um plano pago para enviar o Pix antes da análise.'}</p></div></div>{request?.reviewer_note && <p className="form-error" role="alert">Observação do Admin Master: {request.reviewer_note}</p>}<section className="panel form-panel"><form onSubmit={(event) => void create(event)} className="form-grid"><label>Nome público<input required minLength={3} maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(normalizeSlug(event.target.value)) }} placeholder="Ex.: Personal Carlos" /></label><label>Endereço da página<div className="input-prefix"><span>impulso/p/</span><input required minLength={3} value={slug} onChange={(event) => setSlug(normalizeSlug(event.target.value))} placeholder="personal-carlos" /></div></label><label>Área de atuação<select value={niche} onChange={(event) => setNiche(event.target.value)}><option value="fitness">Fitness e treinamento</option><option value="wellness">Bem-estar</option><option value="creator">Outro criador</option></select></label><label>Plano inicial<select required disabled={plansLoading || Boolean(plansError) || plans.length === 0} value={plan} onChange={(event) => setPlan(event.target.value as WorkspaceRequest['plan_code'])}>{!plan && <option value="">Selecione um plano</option>}{plans.map((item) => <option key={item.code} value={item.code}>{item.code === 'demo' ? `${item.name} · 14 dias grátis` : planLabel(item)}</option>)}</select></label>{plansLoading ? <p className="field-help">Consultando planos…</p> : plansError ? <p className="form-error" role="alert">{plansError}</p> : plans.length === 0 ? <p className="form-error" role="alert">Nenhum plano disponível para novas solicitações no momento.</p> : selectedPlan && <p className="field-help">{selectedPlan.code === 'demo' ? 'Sem cobrança automática. O Admin Master libera 14 dias para você configurar o espaço.' : `Após criar o cadastro, você verá o Pix copia e cola de ${money(selectedPlan.monthly_price_cents)} e o WhatsApp financeiro.`}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button disabled={busy || plansLoading || Boolean(plansError) || !plan} className="primary-button">{busy ? 'Preparando…' : plan === 'demo' ? 'Enviar Demo para análise' : 'Continuar para o pagamento'} <span>→</span></button></form></section></>
}

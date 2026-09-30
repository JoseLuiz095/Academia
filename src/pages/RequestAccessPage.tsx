import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type PlanCode = 'starter' | 'creator' | 'pro'
type PlatformPlan = { code: PlanCode; name: string; monthly_price_cents: number; product_limit: number; ai_daily_limit: number }

const planOrder: PlanCode[] = ['starter', 'creator', 'pro']
const fallbackPlans: PlatformPlan[] = [
  { code: 'starter', name: 'Essencial', monthly_price_cents: 2900, product_limit: 5, ai_daily_limit: 5 },
  { code: 'creator', name: 'Criador', monthly_price_cents: 5900, product_limit: 30, ai_daily_limit: 12 },
  { code: 'pro', name: 'Crescimento', monthly_price_cents: 9900, product_limit: 100, ai_daily_limit: 20 },
]
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const planDescriptions: Record<PlanCode, string> = {
  starter: 'Para começar a organizar sua marca.',
  creator: 'Para publicar, vender e manter constância.',
  pro: 'Para uma rotina comercial mais completa.',
}

export function RequestAccessPage() {
  const [searchParams] = useSearchParams()
  const requestedCode = searchParams.get('plano') as PlanCode | null
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [selectedCode, setSelectedCode] = useState<PlanCode>(requestedCode && planOrder.includes(requestedCode) ? requestedCode : 'creator')
  const [loading, setLoading] = useState(true)
  const [fallback, setFallback] = useState(false)

  useEffect(() => { document.title = 'Solicite seu espaço | Impulso' }, [])
  useEffect(() => {
    if (!supabase) { setPlans(fallbackPlans); setFallback(true); setLoading(false); return }
    let active = true
    void supabase.from('platform_plans').select('code,name,monthly_price_cents,product_limit,ai_daily_limit').eq('enabled', true).then(({ data, error }) => {
      if (!active) return
      const available = !error && data?.length ? (data as PlatformPlan[]).sort((a, b) => planOrder.indexOf(a.code) - planOrder.indexOf(b.code)) : fallbackPlans
      setPlans(available)
      setFallback(Boolean(error) || !data?.length)
      setSelectedCode((current) => available.some((plan) => plan.code === current) ? current : available[0]?.code ?? 'creator')
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const selectedPlan = useMemo(() => plans.find((plan) => plan.code === selectedCode) ?? fallbackPlans.find((plan) => plan.code === selectedCode), [plans, selectedCode])
  const signupUrl = `/admin/login?register=1&plan=${selectedPlan?.code ?? 'creator'}`

  return <main className="request-access-page">
    <header className="request-access-header"><Link className="request-back plain-link" to="/">← <span>Voltar</span></Link><Link className="request-brand plain-link" to="/"><span className="brand-mark">I</span><span><strong>impulso</strong><small>conteúdo que move</small></span></Link><Link className="request-login plain-link" to="/admin/login">Já tenho conta <span>→</span></Link></header>
    <div className="request-access-layout">
      <section className="request-access-copy">
        <p className="eyebrow">Comece com clareza</p>
        <h1>Crie seu espaço e deixe o Impulso trabalhar no seu ritmo.</h1>
        <p className="request-lead">Escolha um plano, conte um pouco sobre seu negócio e envie a solicitação. O Admin Master analisa os dados antes de liberar o painel.</p>
        <div className="request-proof-list"><article><span>01</span><div><strong>14 dias para testar</strong><p>Após a aprovação, você configura a marca, a vitrine e o conteúdo sem cobrança automática.</p></div></article><article><span>02</span><div><strong>Você controla o conteúdo</strong><p>As ideias da IA são sugestões contextualizadas. Você revisa, ajusta e decide o que publicar.</p></div></article><article><span>03</span><div><strong>Pix confirmado manualmente</strong><p>O pagamento é combinado com o Admin Master e confirmado depois da conferência do crédito.</p></div></article></div>
        <div className="request-trust-row"><span>✓ Sem cartão para começar</span><span>✓ Aprovação humana</span><span>✓ Personal ou criador</span></div>
      </section>
      <section className="request-access-card" aria-labelledby="request-access-title">
        <div className="request-card-tabs"><span className="active">Solicitar espaço</span><Link to="/admin/login">Já tenho conta</Link></div>
        <div className="request-card-body"><p className="panel-kicker">Seu primeiro passo</p><h2 id="request-access-title">Escolha o plano que combina com você</h2><p className="request-card-intro">Você poderá revisar tudo durante o cadastro e o Admin Master confirmará a liberação.</p>
          {loading ? <div className="request-plan-loading">Carregando opções…</div> : <div className="request-plan-options">{plans.map((plan) => <button type="button" className={`request-plan-option ${plan.code === selectedCode ? 'selected' : ''}`} key={plan.code} onClick={() => setSelectedCode(plan.code)}><span><small>{plan.code === 'creator' ? 'Mais escolhido' : plan.code === 'starter' ? 'Para começar' : 'Para crescer'}</small><strong>{plan.name}</strong></span><b>{currency.format(plan.monthly_price_cents / 100)}<small>/mês</small></b>{plan.code === selectedCode && <i aria-hidden="true">✓</i>}</button>)}</div>}
          {selectedPlan && <div className="request-selected-plan"><div><span>Plano selecionado</span><strong>{selectedPlan.name} · {currency.format(selectedPlan.monthly_price_cents / 100)}/mês</strong></div><p>Até {selectedPlan.product_limit} produtos ou serviços e {selectedPlan.ai_daily_limit} ideias com IA por dia.</p></div>}
          <Link className="primary-button plain-link request-continue" to={signupUrl}>Continuar para o cadastro <span>→</span></Link>
          <p className="request-legal">Ao continuar, você poderá informar nome, nicho, endereço público e dados de contato. A solicitação só fica ativa depois do envio e da análise.</p>
          {fallback && <p className="request-fallback-note">Exibindo valores de demonstração enquanto os planos não estão disponíveis.</p>}
        </div>
      </section>
    </div>
    <section className="request-access-bottom"><div><p className="eyebrow">O que acontece depois</p><h2>Um cadastro simples, uma aprovação transparente.</h2></div><div className="request-next-steps"><article><b>1</b><strong>Você cria sua conta</strong><p>Informe e-mail e senha para entrar no painel de primeiros passos.</p></article><article><b>2</b><strong>Você monta o espaço</strong><p>Defina nome, endereço público, nicho e o plano que deseja solicitar.</p></article><article><b>3</b><strong>O Master libera o teste</strong><p>Após a análise, seu espaço começa com 14 dias para ser configurado.</p></article></div></section>
  </main>
}

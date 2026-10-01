import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

type Plan = {
  code: 'demo' | 'starter' | 'creator' | 'pro'
  name: string
  monthly_price_cents: number
  product_limit: number
  ai_daily_limit: number
  enabled: boolean
  updated_at: string
}
type Draft = { price: string; productLimit: string; aiDailyLimit: string; enabled: boolean }

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const planOrder = ['demo', 'starter', 'creator', 'pro']
const toDraft = (plan: Plan): Draft => ({
  price: (plan.monthly_price_cents / 100).toFixed(2).replace('.', ','),
  productLimit: String(plan.product_limit),
  aiDailyLimit: String(plan.ai_daily_limit),
  enabled: plan.enabled,
})

export function MasterPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setLoading(true)
    const { data, error: queryError } = await supabase.from('platform_plans')
      .select('code,name,monthly_price_cents,product_limit,ai_daily_limit,enabled,updated_at')
    if (queryError) setError(queryError.message)
    else {
      const rows = ((data ?? []) as Plan[]).sort((a, b) => planOrder.indexOf(a.code) - planOrder.indexOf(b.code))
      setPlans(rows)
      setDrafts(Object.fromEntries(rows.map((plan) => [plan.code, toDraft(plan)])))
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function change(code: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [code]: { ...current[code], ...patch } }))
  }

  async function save(event: FormEvent<HTMLFormElement>, plan: Plan) {
    event.preventDefault()
    if (!supabase || busyCode) return
    const draft = drafts[plan.code]
    if (!draft) return
    const normalizedPrice = draft.price.trim().replace(',', '.')
    const priceCents = /^\d+(?:\.\d{1,2})?$/.test(normalizedPrice) ? Math.round(Number(normalizedPrice) * 100) : NaN
    const productLimit = Number(draft.productLimit)
    const aiDailyLimit = Number(draft.aiDailyLimit)
    if (!Number.isSafeInteger(priceCents) || priceCents < 0 || (plan.code !== 'demo' && priceCents === 0)) { setError(plan.code === 'demo' ? 'A demonstração pode ter preço zero.' : 'Informe um preço positivo com até duas casas decimais.'); return }
    if (!Number.isInteger(productLimit) || productLimit < 1 || productLimit > 1000) { setError('O limite de produtos deve estar entre 1 e 1000.'); return }
    if (!Number.isInteger(aiDailyLimit) || aiDailyLimit < 1 || aiDailyLimit > 20) { setError('O limite diário de IA deve estar entre 1 e 20.'); return }
    if (draft.enabled !== plan.enabled && !window.confirm(draft.enabled
      ? `Ativar novas solicitações do plano ${plan.name}?`
      : `Desativar novas solicitações do plano ${plan.name}? Cobranças já emitidas mantêm o valor registrado.`)) return
    setBusyCode(plan.code); setError(''); setMessage('')
    const { data, error: updateError } = await supabase.from('platform_plans').update({
      monthly_price_cents: priceCents,
      product_limit: productLimit,
      ai_daily_limit: aiDailyLimit,
      enabled: draft.enabled,
      updated_at: new Date().toISOString(),
    }).eq('code', plan.code).select('code,name,monthly_price_cents,product_limit,ai_daily_limit,enabled,updated_at').single()
    if (updateError || !data) setError(updateError?.message ?? 'Plano não atualizado.')
    else {
      const saved = data as Plan
      setPlans((current) => current.map((item) => item.code === saved.code ? saved : item))
      setDrafts((current) => ({ ...current, [saved.code]: toDraft(saved) }))
      setMessage(`${saved.name} atualizado.`)
    }
    setBusyCode(null)
  }

  return <>
    <div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Planos da plataforma</h1><p className="intro-description">Defina o preço mensal e os limites que serão usados nas próximas solicitações.</p></div><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading || Boolean(busyCode)}>Atualizar ↻</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    <section className="plan-note"><span>◇</span><div><strong>Como os preços são aplicados</strong><p>Uma nova cobrança usa o preço atual do plano. Cobranças já solicitadas mantêm o valor registrado; mudanças de plano e vencimento dependem da confirmação do Pix pelo Master.</p></div></section>
    {loading ? <p className="empty-copy">Carregando planos…</p> : plans.length ? <div className="request-list">{plans.map((plan) => {
      const draft = drafts[plan.code]
      if (!draft) return null
      return <section className="panel" key={plan.code}><div className="panel-heading"><div><span className="panel-kicker">{plan.code} · {plan.enabled ? 'Disponível' : 'Desativado'}</span><h2>{plan.name}</h2></div><strong>{plan.code === 'demo' ? 'Grátis · 14 dias' : `${currency.format(plan.monthly_price_cents / 100)}/mês`}</strong></div><form onSubmit={(event) => void save(event, plan)}><div className="form-row"><label>Preço mensal (R$)<input inputMode="decimal" required value={draft.price} onChange={(event) => change(plan.code, { price: event.target.value })} /></label><label>Limite de produtos ou serviços<input type="number" min="1" max="1000" step="1" required value={draft.productLimit} onChange={(event) => change(plan.code, { productLimit: event.target.value })} /></label><label>Ideias com IA por dia<input type="number" min="1" max="20" step="1" required value={draft.aiDailyLimit} onChange={(event) => change(plan.code, { aiDailyLimit: event.target.value })} /></label></div><label className="check-row"><input type="checkbox" checked={draft.enabled} onChange={(event) => change(plan.code, { enabled: event.target.checked })} /> Disponível para novas solicitações</label><p className="field-help">{plan.code === 'demo' ? 'Aprovado pelo Admin Master, este plano inicia 14 dias de teste e não gera cobrança Pix.' : 'Cobranças futuras usam o valor salvo; a confirmação continua manual.'}</p><div className="form-actions"><button type="submit" className="primary-button" disabled={Boolean(busyCode)}>{busyCode === plan.code ? 'Salvando…' : `Salvar ${plan.name}`}</button></div></form></section>
    })}</div> : <p className="empty-copy">Nenhum plano encontrado.</p>}
  </>
}

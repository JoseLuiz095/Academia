import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Workspace } from '../../types'

type MasterWorkspace = Pick<Workspace, 'id' | 'name' | 'slug' | 'niche' | 'published' | 'plan_code' | 'subscription_status' | 'subscription_started_at' | 'subscription_ends_at' | 'approval_status' | 'billing_exempt_until' | 'billing_exempt_reason' | 'negotiated_monthly_price_cents' | 'negotiated_price_note'>
type Action = 'suspend' | 'restore' | 'waive' | 'negotiate' | 'clear_negotiation' | 'clear_exemption' | 'change_plan'
type PlanCode = 'demo' | 'starter' | 'creator' | 'pro'

const planNames: Record<PlanCode, string> = { demo: 'Demonstração', starter: 'Essencial', creator: 'Criador', pro: 'Crescimento' }
const actionNames: Record<Action, string> = { suspend: 'Suspender acesso', restore: 'Restaurar acesso', waive: 'Conceder isenção', negotiate: 'Salvar negociação', clear_negotiation: 'Remover negociação', clear_exemption: 'Remover isenção', change_plan: 'Gerar cobrança para alterar plano' }
const statusNames: Record<string, string> = { trial: 'Em teste', active: 'Ativa', past_due: 'Vencida', cancelled: 'Cancelada' }
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Não definido'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data inválida' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

function priceLabel(value: number | null | undefined) {
  return value === null || value === undefined ? 'Preço do plano' : money.format(value / 100)
}

export function MasterWorkspaces() {
  const [workspaces, setWorkspaces] = useState<MasterWorkspace[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<MasterWorkspace | null>(null)
  const [action, setAction] = useState<Action>('waive')
  const [plan, setPlan] = useState<PlanCode>('starter')
  const [periodDays, setPeriodDays] = useState(30)
  const [negotiatedPrice, setNegotiatedPrice] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setLoading(true)
    const { data, error: queryError } = await supabase.from('workspaces')
      .select('id,name,slug,niche,published,plan_code,subscription_status,subscription_started_at,subscription_ends_at,approval_status,billing_exempt_until,billing_exempt_reason,negotiated_monthly_price_cents,negotiated_price_note')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else { setWorkspaces((data ?? []) as MasterWorkspace[]); setError('') }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function openManage(item: MasterWorkspace) {
    setSelected(item)
    setAction(item.approval_status === 'suspended' ? 'restore' : 'waive')
    setPlan(item.plan_code ?? 'starter')
    setPeriodDays(30)
    setNegotiatedPrice(item.negotiated_monthly_price_cents ? (item.negotiated_monthly_price_cents / 100).toFixed(2).replace('.', ',') : '')
    setNote('')
    setError('')
    setMessage('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !supabase || saving) return
    const amountText = negotiatedPrice.trim().replace(',', '.')
    const amountCents = amountText && /^\d+(?:\.\d{1,2})?$/.test(amountText) ? Math.round(Number(amountText) * 100) : null
    if (action === 'waive' && (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 730)) { setError('Informe uma isenção entre 1 e 730 dias.'); return }
    if (action === 'negotiate' && (!amountCents || amountCents < 100 || amountCents > 1000000)) { setError('Informe um valor entre R$ 1,00 e R$ 10.000,00.'); return }
    if (['suspend', 'waive', 'negotiate'].includes(action) && note.trim().length < 5) { setError('Informe uma observação com pelo menos 5 caracteres.'); return }
    const detail = action === 'waive' ? `${periodDays} dias sem cobrança Pix.` : action === 'negotiate' ? `Mensalidade de ${money.format((amountCents ?? 0) / 100)} nas próximas cobranças.` : action === 'change_plan' ? `Será criada uma cobrança Pix de ${planNames[plan]}.` : 'A ação será registrada no histórico.'
    if (!window.confirm(`${actionNames[action]} para ${selected.name}? ${detail}`)) return
    setSaving(true); setError(''); setMessage('')
    const result = action === 'change_plan'
      ? await supabase.rpc('request_subscription_payment', { target_workspace_id: selected.id, target_plan_code: plan })
      : ['waive', 'negotiate', 'clear_negotiation', 'clear_exemption'].includes(action)
        ? await supabase.rpc('manage_workspace_billing', { target_workspace_id: selected.id, action, negotiated_amount_cents: action === 'negotiate' ? amountCents : null, exemption_days: action === 'waive' ? periodDays : null, note: note.trim() || null })
        : await supabase.rpc('manage_workspace_subscription', { target_workspace_id: selected.id, action, plan: null, period_days: null, note: note.trim() || null })
    if (result.error) setError(result.error.message)
    else {
      setMessage(action === 'change_plan' ? `Cobrança Pix de ${planNames[plan]} criada para ${selected.name}.` : `${actionNames[action]} registrada para ${selected.name}.`)
      setSelected(null)
      await load()
    }
    setSaving(false)
  }

  const shown = workspaces.filter((item) => `${item.name} ${item.slug} ${item.niche}`.toLowerCase().includes(filter.trim().toLowerCase()))
  return <>
    <div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Personais e criadores</h1><p className="intro-description">Controle planos, vencimentos, isenções e condições negociadas de cada espaço.</p></div><div className="form-actions"><Link className="secondary-button plain-link" to="/admin-master/pagamentos">Ver pagamentos →</Link><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>Atualizar ↻</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Espaços</span><h2>Todos os cadastros</h2></div><input className="search-input" aria-label="Buscar criador" placeholder="Buscar por nome ou link" value={filter} onChange={(event) => setFilter(event.target.value)} /></div>
      {loading ? <p className="empty-copy">Carregando espaços…</p> : shown.length ? <div className="simple-list">{shown.map((item) => {
        const due = item.subscription_ends_at ? new Date(item.subscription_ends_at).getTime() : null
        const exemptionActive = Boolean(item.billing_exempt_until && new Date(item.billing_exempt_until).getTime() > Date.now())
        const overdue = due !== null && due <= Date.now() && item.subscription_status !== 'cancelled' && !exemptionActive
        const status = exemptionActive ? 'Isento até ' + dateLabel(item.billing_exempt_until) : overdue ? 'Vencida' : statusNames[item.subscription_status ?? ''] ?? 'Sem status'
        return <div key={item.id} className="master-workspace-row"><div><strong>{item.name}</strong><small>/p/{item.slug} · {item.niche} · {planNames[item.plan_code ?? 'starter']}</small><small>{status}{item.negotiated_monthly_price_cents ? ` · negociado: ${priceLabel(item.negotiated_monthly_price_cents)}/mês` : ''}{item.approval_status === 'suspended' ? ' · acesso suspenso' : ''}</small></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => openManage(item)}>Gerenciar</button>{item.published && <a href={`/p/${item.slug}`} target="_blank" rel="noreferrer">Abrir ↗</a>}</div></div>
      })}</div> : <p className="empty-copy">Nenhum espaço encontrado.</p>}
    </section>

    {selected && <section className="panel" aria-label={`Gerenciar assinatura de ${selected.name}`}><div className="panel-heading"><div><span className="panel-kicker">Gestão comercial</span><h2>{selected.name}</h2></div><button type="button" className="text-button" onClick={() => setSelected(null)}>Fechar</button></div><p>Plano atual: {planNames[selected.plan_code ?? 'starter']} · {statusNames[selected.subscription_status ?? ''] ?? 'Sem status'} · vence em {dateLabel(selected.subscription_ends_at)}.</p>{selected.billing_exempt_until && <p className="field-help">Isenção atual: até {dateLabel(selected.billing_exempt_until)}{selected.billing_exempt_reason ? ` · ${selected.billing_exempt_reason}` : ''}</p>}{selected.negotiated_monthly_price_cents && <p className="field-help">Valor negociado atual: {priceLabel(selected.negotiated_monthly_price_cents)}/mês{selected.negotiated_price_note ? ` · ${selected.negotiated_price_note}` : ''}</p>}<form onSubmit={(event) => void save(event)}><div className="form-row"><label>Ação<select value={action} onChange={(event) => setAction(event.target.value as Action)}><option value="waive">Conceder isenção/cortesia</option><option value="negotiate">Negociar mensalidade</option><option value="clear_negotiation">Remover negociação</option><option value="clear_exemption">Remover isenção</option><option value="suspend">Suspender acesso</option><option value="restore">Restaurar acesso</option><option value="change_plan">Gerar cobrança para alterar plano</option></select></label>{action === 'change_plan' && <label>Plano<select value={plan} onChange={(event) => setPlan(event.target.value as PlanCode)}>{Object.entries(planNames).filter(([code]) => code !== 'demo').map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>}{action === 'waive' && <label>Período sem cobrança (dias)<input type="number" min="1" max="730" step="1" required value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} /></label>}{action === 'negotiate' && <label>Mensalidade negociada (R$)<input inputMode="decimal" required value={negotiatedPrice} onChange={(event) => setNegotiatedPrice(event.target.value)} placeholder="Ex.: 39,90" /></label>}</div><label>{['suspend', 'waive', 'negotiate'].includes(action) ? 'Motivo ou condição (obrigatório)' : 'Observação (opcional)'}<textarea required={['suspend', 'waive', 'negotiate'].includes(action)} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: parceria inicial, condição comercial ou cortesia aprovada." /></label><p className="empty-copy">A isenção não gera Pix e mantém o plano ativo até a data definida. A negociação é aplicada às próximas cobranças; o comprovante e a aprovação manual continuam obrigatórios.</p><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setSelected(null)}>Voltar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Salvando…' : actionNames[action]}</button></div></form></section>}
  </>
}

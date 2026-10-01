import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Workspace } from '../../types'

type MasterWorkspace = Pick<Workspace, 'id' | 'name' | 'slug' | 'niche' | 'published' | 'plan_code' | 'subscription_status' | 'subscription_started_at' | 'subscription_ends_at' | 'approval_status'>
type Action = 'suspend' | 'restore' | 'extend' | 'change_plan'
type PlanCode = 'starter' | 'creator' | 'pro'

const planNames: Record<PlanCode, string> = { starter: 'Essencial', creator: 'Criador', pro: 'Crescimento' }
const actionNames: Record<Action, string> = { suspend: 'Suspender acesso', restore: 'Restaurar acesso', extend: 'Estender prazo', change_plan: 'Gerar cobrança para alterar plano' }
const statusNames: Record<string, string> = { trial: 'Em teste', active: 'Ativa', past_due: 'Vencida', cancelled: 'Cancelada' }

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Não definido'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data inválida' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

export function MasterWorkspaces() {
  const [workspaces, setWorkspaces] = useState<MasterWorkspace[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<MasterWorkspace | null>(null)
  const [action, setAction] = useState<Action>('extend')
  const [plan, setPlan] = useState<PlanCode>('starter')
  const [periodDays, setPeriodDays] = useState(30)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setLoading(true)
    const { data, error: queryError } = await supabase.from('workspaces')
      .select('id,name,slug,niche,published,plan_code,subscription_status,subscription_started_at,subscription_ends_at,approval_status')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else { setWorkspaces((data ?? []) as MasterWorkspace[]); setError('') }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function openManage(item: MasterWorkspace) {
    setSelected(item)
    setAction(item.approval_status === 'suspended' ? 'restore' : 'extend')
    setPlan(item.plan_code ?? 'starter')
    setPeriodDays(30)
    setNote('')
    setError('')
    setMessage('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !supabase || saving) return
    if (action === 'extend' && (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 365)) {
      setError('Informe um período entre 1 e 365 dias.')
      return
    }
    if ((action === 'suspend' || action === 'extend') && note.trim().length < 5) {
      setError(action === 'extend' ? 'Informe o motivo da prorrogação administrativa.' : 'Informe o motivo da suspensão.')
      return
    }
    const detail = action === 'extend' ? `${periodDays} dias. Esta é uma prorrogação administrativa do vencimento, sem confirmação de pagamento.` : action === 'change_plan' ? `Será criada uma cobrança Pix de ${planNames[plan]}. O plano só muda após comprovante e conferência do crédito.` : 'Confira os dados do espaço.'
    if (!window.confirm(`${actionNames[action]} de ${selected.name}? ${detail}`)) return
    setSaving(true); setError(''); setMessage('')
    const result = action === 'change_plan'
      ? await supabase.rpc('request_subscription_payment', { target_workspace_id: selected.id, target_plan_code: plan })
      : await supabase.rpc('manage_workspace_subscription', {
        target_workspace_id: selected.id,
        action,
        plan: null,
        period_days: action === 'extend' ? periodDays : null,
        note: note.trim() || null,
      })
    const mutationError = result.error
    if (mutationError) setError(mutationError.message)
    else {
      setMessage(action === 'change_plan' ? `Cobrança Pix de ${planNames[plan]} criada para ${selected.name}. Aguarde o pagamento e o comprovante do criador.` : `${actionNames[action]} registrada para ${selected.name}.`)
      setSelected(null)
      await load()
    }
    setSaving(false)
  }

  const shown = workspaces.filter((item) => `${item.name} ${item.slug} ${item.niche}`.toLowerCase().includes(filter.trim().toLowerCase()))
  return <>
    <div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Personais e criadores</h1><p className="intro-description">Controle planos, vencimentos e acesso de cada espaço.</p></div><div className="form-actions"><Link className="secondary-button plain-link" to="/admin-master/pagamentos">Ver pagamentos →</Link><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>Atualizar ↻</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Espaços</span><h2>Todos os cadastros</h2></div><input className="search-input" aria-label="Buscar criador" placeholder="Buscar por nome ou link" value={filter} onChange={(event) => setFilter(event.target.value)} /></div>
      {loading ? <p className="empty-copy">Carregando espaços…</p> : shown.length ? <div className="simple-list">{shown.map((item) => {
        const due = item.subscription_ends_at ? new Date(item.subscription_ends_at).getTime() : null
        const overdue = due !== null && due <= Date.now() && item.subscription_status !== 'cancelled'
        const status = overdue ? 'Vencida' : statusNames[item.subscription_status ?? ''] ?? 'Sem status'
        return <div key={item.id} className="master-workspace-row"><div><strong>{item.name}</strong><small>/p/{item.slug} · {item.niche} · {planNames[item.plan_code ?? 'starter']}</small><small>{status} · vencimento: {dateLabel(item.subscription_ends_at)}{item.approval_status === 'suspended' ? ' · acesso suspenso' : ''}</small></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => openManage(item)}>Gerenciar</button>{item.published && <a href={`/p/${item.slug}`} target="_blank" rel="noreferrer">Abrir ↗</a>}</div></div>
      })}</div> : <p className="empty-copy">Nenhum espaço encontrado.</p>}
    </section>

    {selected && <section className="panel" aria-label={`Gerenciar assinatura de ${selected.name}`}><div className="panel-heading"><div><span className="panel-kicker">Gestão</span><h2>{selected.name}</h2></div><button type="button" className="text-button" onClick={() => setSelected(null)}>Fechar</button></div><p>Plano atual: {planNames[selected.plan_code ?? 'starter']} · {statusNames[selected.subscription_status ?? ''] ?? 'Sem status'} · vence em {dateLabel(selected.subscription_ends_at)}.</p><form onSubmit={(event) => void save(event)}><div className="form-row"><label>Ação<select value={action} onChange={(event) => setAction(event.target.value as Action)}><option value="suspend">Suspender acesso</option><option value="restore">Restaurar acesso</option><option value="extend">Prorrogação administrativa</option><option value="change_plan">Gerar cobrança para alterar plano</option></select></label>{action === 'change_plan' && <label>Plano<select value={plan} onChange={(event) => setPlan(event.target.value as PlanCode)}>{Object.entries(planNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>}{action === 'extend' && <label>Período (dias)<input type="number" min="1" max="365" step="1" required value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} /></label>}</div><label>Observação{action === 'suspend' || action === 'extend' ? ' (obrigatória)' : ' (opcional)'}<textarea value={note} required={action === 'suspend' || action === 'extend'} onChange={(event) => setNote(event.target.value)} placeholder="Motivo administrativo" /></label><p className="empty-copy">A alteração de plano gera cobrança Pix e só entra em vigor depois do comprovante e da conferência do crédito. Prorrogações continuam sendo ações administrativas.</p><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setSelected(null)}>Voltar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Salvando…' : actionNames[action]}</button></div></form></section>}
  </>
}

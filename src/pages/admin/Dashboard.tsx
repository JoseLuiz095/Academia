import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ContentIdea, Product } from '../../types'
import { PwaExperience } from '../../components/PwaExperience'
import { notifyBrowser } from '../../lib/pwa'

type Reminder = { id: string; title: string; scheduled_for: string; channel: 'internal' | 'whatsapp' }
type OrderSignal = { id: string; status: 'pending' | 'confirmed' | 'cancelled'; payment_provider?: 'manual_pix' | 'asaas'; payment_status?: 'manual_review' | 'awaiting_payment' | 'confirmed' | 'overdue' | 'cancelled' | 'refunded' | 'error' }
type EvaluationSignal = { id: string; order_id: string; status: 'payment_pending' | 'awaiting_approval' | 'confirmed' | 'rejected' | 'cancelled' | 'expired' }

export function AdminDashboard() {
  const { workspace } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [orderSignals, setOrderSignals] = useState<OrderSignal[]>([])
  const [evaluationSignals, setEvaluationSignals] = useState<EvaluationSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!supabase || !workspace) return
    let active = true
    setLoading(true)
    setProducts([])
    setIdeas([])
    setReminders([])
    setOrderSignals([])
    setEvaluationSignals([])
    setLoadError(false)
    void Promise.all([
      supabase.from('products').select('id,workspace_id,kind,name,description,price,currency,published,image_url,service_area').eq('workspace_id', workspace.id),
      supabase.from('content_ideas').select('id,workspace_id,format,title,hook,body,cta,status,source,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('content_reminders').select('id,title,scheduled_for,channel').eq('workspace_id', workspace.id).eq('status', 'pending').order('scheduled_for', { ascending: true }).limit(10),
      supabase.from('orders').select('id,status,payment_provider,payment_status').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('evaluation_bookings').select('id,order_id,status').eq('workspace_id', workspace.id).in('status', ['payment_pending', 'awaiting_approval']),
    ]).then(([productsResult, ideasResult, remindersResult, ordersResult, evaluationsResult]) => { if (active) { setProducts((productsResult.data ?? []) as Product[]); setIdeas((ideasResult.data ?? []) as ContentIdea[]); setReminders((remindersResult.data ?? []) as Reminder[]); setOrderSignals((ordersResult.data ?? []) as OrderSignal[]); setEvaluationSignals((evaluationsResult.data ?? []) as EvaluationSignal[]); setLoadError(!!productsResult.error || !!ideasResult.error || !!remindersResult.error || !!ordersResult.error || !!evaluationsResult.error); setLoading(false) } })
    return () => { active = false }
  }, [workspace?.id])

  useEffect(() => {
    const currentPending = new Set([...orderSignals.filter((order) => order.status === 'pending').map((order) => order.id), ...evaluationSignals.map((booking) => booking.order_id)]).size
    if (!workspace || currentPending < 1 || !('Notification' in window) || Notification.permission !== 'granted') return
    const seenKey = `impulso:admin:last-pending:${workspace.id}`
    let previous = 0
    try { previous = Number(localStorage.getItem(seenKey) ?? '0') } catch { /* Sem histórico local, o alerta pode ser exibido uma vez. */ }
    if (currentPending > previous) void notifyBrowser('Impulso · nova pendência', { body: `${currentPending} item${currentPending === 1 ? '' : 's'} aguardando conferência, incluindo compras e avaliações.`, tag: `pending-${workspace.id}`, url: '/admin/pedidos' })
    try { localStorage.setItem(seenKey, String(currentPending)) } catch { /* O indicador visual não deve quebrar o painel. */ }
  }, [orderSignals, evaluationSignals, workspace?.id])

  const daysRemaining = workspace?.subscription_ends_at ? Math.ceil((new Date(workspace.subscription_ends_at).getTime() - Date.now()) / 86400000) : null
  const subscriptionDate = workspace?.subscription_ends_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(workspace.subscription_ends_at)) : 'A definir'
  const planLabel = workspace?.plan_code === 'pro' ? 'Crescimento' : workspace?.plan_code === 'creator' ? 'Criador' : workspace?.plan_code === 'demo' ? 'Demonstração' : 'Essencial'
  const subscriptionIsExpired = daysRemaining !== null && daysRemaining <= 0
  const subscriptionIsAttention = subscriptionIsExpired || workspace?.subscription_status === 'past_due' || workspace?.subscription_status === 'cancelled'
  const billingExemptionActive = Boolean(workspace?.billing_exempt_until && new Date(workspace.billing_exempt_until).getTime() > Date.now())
  const pendingOrderSignals = orderSignals.filter((order) => order.status === 'pending')
  const manualPaymentCount = pendingOrderSignals.filter((order) => order.payment_provider !== 'asaas' || ['manual_review', 'error'].includes(order.payment_status ?? '')).length
  const asaasWaitingCount = pendingOrderSignals.filter((order) => order.payment_provider === 'asaas' && order.payment_status !== 'confirmed').length
  const evaluationsAwaitingApproval = evaluationSignals.filter((booking) => booking.status === 'awaiting_approval').length
  const evaluationsAwaitingPayment = evaluationSignals.filter((booking) => booking.status === 'payment_pending').length
  const operationalOrderIds = new Set([...pendingOrderSignals.map((order) => order.id), ...evaluationSignals.map((booking) => booking.order_id)])
  const pendingCount = operationalOrderIds.size
  const subscriptionMessage = billingExemptionActive ? `Isenção ativa até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(workspace?.billing_exempt_until ?? ''))}.` : subscriptionIsExpired ? 'Sua assinatura venceu. Revise o plano para manter o acesso.' : workspace?.subscription_status === 'past_due' ? 'Há uma cobrança em atraso para revisar.' : workspace?.subscription_status === 'cancelled' ? 'A assinatura está cancelada. Escolha um plano para retomar.' : `Próximo vencimento em ${subscriptionDate}.`
  const dueReminders = reminders.filter((item) => new Date(item.scheduled_for).getTime() <= Date.now())
  const setupTasks = [
    { label: 'Adicionar WhatsApp de atendimento', done: Boolean(workspace?.whatsapp_number), to: '/admin/configuracoes' },
    { label: 'Configurar Pix da vitrine', done: Boolean(workspace?.pix_key), to: '/admin/configuracoes' },
    { label: 'Cadastrar o primeiro produto', done: products.length > 0, to: '/admin/produtos' },
    { label: 'Criar a primeira ideia de conteúdo', done: ideas.length > 0, to: '/admin/conteudo' },
    { label: 'Publicar a página para clientes', done: Boolean(workspace?.published), to: '/admin/configuracoes' },
  ]
  const completedTasks = setupTasks.filter((task) => task.done).length

  return <><div className="page-intro"><div><p className="eyebrow">Visão geral</p><h1>Olá, {workspace?.name}</h1><p className="intro-description">Sua operação em um só lugar, com dados reais do seu espaço.</p></div><Link className="primary-button plain-link" to="/admin/produtos">Adicionar produto <span>＋</span></Link></div>
    {!workspace?.published && <div className="setup-banner"><div className="setup-illustration"><div className="sun" /><div className="setup-person">✦</div></div><div className="setup-copy"><span className="setup-label">Sua vitrine ainda é privada</span><strong>Prepare seu espaço antes de compartilhar</strong><p>Configure o WhatsApp, cadastre um produto e publique quando estiver pronta.</p><Link to="/admin/primeiros-passos">Ver primeiros passos <span>→</span></Link></div></div>}
    {workspace && <PwaExperience audience="admin" workspaceId={workspace.id} compact />}
    {!loading && !loadError && <section className="order-summary-strip" aria-label="Resumo operacional"><div><span>Fila operacional</span><strong>{pendingCount}</strong><small>{pendingOrderSignals.length} pedido(s) · {evaluationsAwaitingApproval + evaluationsAwaitingPayment} avaliação(ões)</small></div><div><span>Pagamentos para acompanhar</span><strong>{manualPaymentCount + asaasWaitingCount}</strong><small>{manualPaymentCount} Pix manual · {asaasWaitingCount} Asaas</small></div><div><span>Avaliações aguardando aprovação</span><strong>{evaluationsAwaitingApproval}</strong><small>{evaluationsAwaitingPayment} aguardando pagamento/comprovante</small></div></section>}
    {!loading && pendingCount > 0 && <section className="panel editor-panel" aria-labelledby="dashboard-priority-title"><div className="panel-heading"><div><span className="panel-kicker">Prioridade de hoje</span><h2 id="dashboard-priority-title">Resolva o que libera o próximo passo</h2></div><Link className="text-button plain-link" to="/admin/pedidos">Abrir fila →</Link></div><div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/admin/pedidos">{manualPaymentCount ? `Conferir ${manualPaymentCount} Pix manual(is)` : 'Revisar pagamentos'}</Link>{evaluationsAwaitingApproval > 0 && <Link className="secondary-button plain-link" to="/admin/pedidos">Aprovar avaliações ({evaluationsAwaitingApproval})</Link>}{asaasWaitingCount > 0 && <Link className="secondary-button plain-link" to="/admin/pedidos">Acompanhar Asaas ({asaasWaitingCount})</Link>}</div><p className="field-help">A confirmação de pagamento Asaas depende do webhook. O Pix manual só deve ser confirmado depois da conferência no extrato.</p></section>}
    {completedTasks < setupTasks.length && <section className="panel activation-panel" aria-labelledby="activation-title"><div className="panel-heading"><div><span className="panel-kicker">Ativação rápida</span><h2 id="activation-title">Seu espaço está {completedTasks === 0 ? 'começando' : 'quase pronto'}</h2></div><strong className="activation-count">{completedTasks}/{setupTasks.length}</strong></div><p className="field-help">Complete estes passos para transformar o painel em uma vitrine pronta para vender e criar conteúdo.</p><div className="activation-progress"><span style={{ width: `${(completedTasks / setupTasks.length) * 100}%` }} /></div><div className="activation-list">{setupTasks.map((task) => <Link key={task.label} to={task.to} className={`activation-item ${task.done ? 'done' : ''}`}><span>{task.done ? '✓' : '○'}</span><strong>{task.label}</strong><small>{task.done ? 'Concluído' : 'Abrir'}</small></Link>)}</div></section>}
    <section className={`dashboard-subscription ${subscriptionIsAttention ? 'is-expired' : ''}`}><div className="dashboard-subscription-icon">◇</div><div className="dashboard-subscription-copy"><span className="panel-kicker">Assinatura do espaço</span><strong>{planLabel} <small>{billingExemptionActive ? '· isenção ativa' : workspace?.subscription_status === 'trial' ? '· período de teste' : workspace?.subscription_status === 'past_due' ? '· atenção necessária' : workspace?.subscription_status === 'cancelled' ? '· cancelada' : '· ativa'}</small></strong><p>{subscriptionMessage}{workspace?.negotiated_monthly_price_cents ? ` Mensalidade negociada: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(workspace.negotiated_monthly_price_cents / 100)}.` : ''}</p></div><div className="dashboard-subscription-meta"><strong>{billingExemptionActive ? 'Isento' : daysRemaining === null ? '—' : daysRemaining <= 0 ? 'Vencido' : `${daysRemaining} dias`}</strong><span>{billingExemptionActive ? 'até a data' : 'para revisar'}</span></div><Link className="secondary-button plain-link" to="/admin/planos">Ver plano →</Link></section>
    {!loading && reminders.length > 0 && <section className="panel editor-panel" aria-labelledby="dashboard-reminders"><div className="panel-heading"><div><span className="panel-kicker">Planejamento de conteúdo</span><h2 id="dashboard-reminders">{dueReminders.length ? `${dueReminders.length} lembrete${dueReminders.length === 1 ? '' : 's'} para revisar` : 'Próximos lembretes'}</h2></div><Link className="text-button plain-link" to="/admin/conteudo">Abrir agenda →</Link></div><div className="simple-list">{reminders.slice(0, 3).map((item) => <div key={item.id}><strong>{item.title}</strong><span>{new Date(item.scheduled_for).toLocaleString('pt-BR')} · {item.channel === 'whatsapp' ? 'WhatsApp manual' : 'No painel'}</span></div>)}</div><p className="field-help">Os lembretes aparecem aqui quando o painel é aberto; nenhum envio ou publicação acontece automaticamente.</p></section>}
    {loadError && <p className="form-error" role="alert">Parte dos dados não pôde ser carregada. Atualize a página para tentar novamente.</p>}
    <section className="metric-grid"><div className="metric-card"><div className="metric-icon orange">▣</div><span className="metric-label">Produtos cadastrados</span><strong className="metric-value">{loading || loadError ? '…' : products.length}</strong><div className="metric-foot"><span>{loadError ? 'Dados indisponíveis' : `${products.filter((item) => item.published).length} publicados`}</span></div></div><div className="metric-card"><div className="metric-icon purple">✦</div><span className="metric-label">Últimas ideias (até 3)</span><strong className="metric-value">{loading || loadError ? '…' : ideas.length}</strong><div className="metric-foot"><span>{loadError ? 'Dados indisponíveis' : `${ideas.filter((item) => item.status === 'approved').length} aprovadas nesta seleção`}</span></div></div><div className="metric-card"><div className="metric-icon green">↗</div><span className="metric-label">Página pública</span><strong className="metric-value metric-word">{workspace?.published ? 'No ar' : 'Privada'}</strong><div className="metric-foot"><span>{workspace?.slug}</span></div></div><div className="metric-card"><div className="metric-icon blue">◫</div><span className="metric-label">Itens para conferir</span><strong className="metric-value">{loading || loadError ? '…' : pendingCount}</strong><div className="metric-foot"><Link to="/admin/pedidos">Abrir fila →</Link></div></div></section>
    <section className="panel editor-panel"><div className="panel-heading"><div><span className="panel-kicker">Conteúdo e atendimento</span><h2>Da ideia à conversa</h2></div></div><p className="empty-copy">Configure seu perfil de conteúdo, gere ou escreva uma ideia e revise antes de aprovar. No WhatsApp, a ideia aprovada só preenche uma prévia; você decide se vai enviar a mensagem.</p><div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/admin/conteudo">Revisar ideias →</Link><Link className="secondary-button plain-link" to="/admin/whatsapp">Testar no WhatsApp →</Link></div></section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Sua vitrine</span><h2>Produtos e serviços</h2></div><Link className="text-button plain-link" to="/admin/produtos">Gerenciar →</Link></div>{loadError ? <p className="empty-copy">Dados indisponíveis no momento.</p> : products.length ? <div className="simple-list">{products.slice(0, 4).map((product) => <div key={product.id}><strong>{product.name}</strong><span>{product.published ? 'Publicado' : 'Rascunho'}</span></div>)}</div> : <p className="empty-copy">Nenhum produto cadastrado. Comece por uma avaliação ou manual.</p>}</section><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Sua voz</span><h2>Ideias recentes</h2></div><Link className="text-button plain-link" to="/admin/conteudo">Abrir conteúdo →</Link></div>{loadError ? <p className="empty-copy">Dados indisponíveis no momento.</p> : ideas.length ? <div className="simple-list">{ideas.map((idea) => <div key={idea.id}><strong>{idea.title}</strong><span>{idea.format} · {idea.status === 'approved' ? 'Aprovada' : idea.status === 'review' ? 'Em revisão' : idea.status === 'archived' ? 'Arquivada' : 'Rascunho'}</span></div>)}</div> : <p className="empty-copy">Configure o seu público e prepare a primeira ideia.</p>}</section></div>
  </>
}

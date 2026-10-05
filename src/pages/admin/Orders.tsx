import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { currency, whatsappLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'

type OrderStatus = 'pending' | 'confirmed' | 'cancelled'
type OrderRow = {
  id: string
  reference: string
  status: OrderStatus
  total: number
  created_at: string
  confirmed_at: string | null
  cancelled_at: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_note: string | null
  order_items: { id: number; product_id: string | null; product_name: string; quantity: number; line_total: number; product?: { kind?: string; access_mode?: string } | null }[]
}

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Pagamento confirmado',
  cancelled: 'Cancelado',
}

export function AdminOrders() {
  const { workspace } = useAuth()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')
  const [search, setSearch] = useState('')
  const [accessLinks, setAccessLinks] = useState<Record<string, string>>({})

  async function load(workspaceId: string) {
    if (!supabase) return
    setLoading(true)
    const result = await supabase.from('orders')
      .select('id,reference,status,total,created_at,confirmed_at,cancelled_at,customer_name,customer_phone,customer_note,order_items(id,product_id,product_name,quantity,line_total,product:products(kind,access_mode))')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders((result.data ?? []) as OrderRow[])
    setError(result.error ? 'Não foi possível carregar os pedidos. Tente atualizar a página.' : '')
    setLoading(false)
  }

  useEffect(() => { if (workspace) void load(workspace.id) }, [workspace?.id])

  const shownOrders = orders.filter((order) => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return (filter === 'all' || order.status === filter) && (!query || order.reference.toLocaleLowerCase('pt-BR').includes(query) || order.order_items.some((item) => item.product_name.toLocaleLowerCase('pt-BR').includes(query)))
  })
  const commercialSummary = useMemo(() => {
    const confirmed = orders.filter((order) => order.status === 'confirmed')
    const products = new Map<string, { quantity: number; total: number }>()
    confirmed.forEach((order) => order.order_items.forEach((item) => {
      const current = products.get(item.product_name) ?? { quantity: 0, total: 0 }
      products.set(item.product_name, { quantity: current.quantity + item.quantity, total: current.total + item.line_total })
    }))
    return { confirmedCount: confirmed.length, confirmedTotal: confirmed.reduce((sum, order) => sum + order.total, 0), pendingTotal: orders.filter((order) => order.status === 'pending').reduce((sum, order) => sum + order.total, 0), products: [...products.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 4) }
  }, [orders])

  async function changeStatus(order: OrderRow, status: OrderStatus) {
    if (!supabase || !workspace || savingId) return
    if (status === 'confirmed' && !window.confirm(`Você conferiu no extrato o crédito do pedido ${order.reference}, no valor de ${currency.format(order.total)}? Somente confirme após receber o Pix.`)) return
    if (status === 'cancelled' && !window.confirm(`Cancelar o pedido ${order.reference}? Esta ação não pode ser desfeita pelo painel.`)) return
    setSavingId(order.id)
    setError('')
    const result = await supabase.rpc('review_store_order', { target_order_id: order.id, decision: status === 'confirmed' ? 'confirm' : 'cancel' })
    if (result.error) setError('Não foi possível atualizar o pedido. Verifique seu acesso e tente novamente.')
    else await load(workspace.id)
    setSavingId(null)
  }

  async function issueAccess(order: OrderRow, productId: string | null, itemId: number) {
    if (!supabase || !workspace || !productId) return
    setSavingId(order.id); setError('')
    const result = await supabase.rpc('issue_product_access', { target_order_id: order.id, target_product_id: productId })
    if (result.error || !result.data?.token) setError(result.error?.message || 'Não foi possível liberar o conteúdo.')
    else {
      const link = `${window.location.origin}/p/${workspace.slug}/acesso?token=${encodeURIComponent(String(result.data.token))}`
      setAccessLinks((current) => ({ ...current, [`${order.id}:${itemId}`]: link }))
    }
    setSavingId(null)
  }

  return <>
    <div className="page-intro"><div><p className="eyebrow">Sua operação</p><h1>Pedidos</h1><p className="intro-description">Pedidos iniciados na vitrine. Confira o valor e a referência com o cliente, confirme o Pix no extrato e só então combine a entrega pelo WhatsApp.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loading && orders.length > 0 && <section className="order-summary-strip" aria-label="Resumo comercial"><div><span>Vendas confirmadas</span><strong>{commercialSummary.confirmedCount}</strong><small>{currency.format(commercialSummary.confirmedTotal)}</small></div><div><span>Aguardando conferência</span><strong>{orders.filter((order) => order.status === 'pending').length}</strong><small>{currency.format(commercialSummary.pendingTotal)}</small></div><div className="order-summary-products"><span>Itens com maior faturamento</span>{commercialSummary.products.length ? commercialSummary.products.map(([name, value]) => <small key={name}>{name} · {value.quantity} un. · {currency.format(value.total)}</small>) : <small>Ainda não há vendas confirmadas.</small>}</div></section>}
    {!loading && orders.length > 0 && <div className="orders-toolbar"><input aria-label="Buscar pedido" placeholder="Buscar referência ou produto" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="filter-tabs" role="tablist" aria-label="Filtrar pedidos">{(['all', 'pending', 'confirmed', 'cancelled'] as const).map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? `Todos (${orders.length})` : item === 'pending' ? `Pendentes (${orders.filter((order) => order.status === item).length})` : item === 'confirmed' ? 'Confirmados' : 'Cancelados'}</button>)}</div></div>}
    {loading ? <p className="empty-copy">Carregando pedidos…</p> : shownOrders.length ? <div className="orders-list">{shownOrders.map((order) => <article className="panel order-card" key={order.id}>
      <div className="panel-heading"><div><span className="panel-kicker">{order.reference}</span><h2>{statusLabel[order.status]}</h2></div><strong>{currency.format(order.total)}</strong></div>
      <p className="field-help">Criado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(order.created_at))}</p>
      {order.confirmed_at && <p className="field-help">Pagamento confirmado em {new Date(order.confirmed_at).toLocaleString('pt-BR')}.</p>}
      {order.cancelled_at && <p className="field-help">Pedido cancelado em {new Date(order.cancelled_at).toLocaleString('pt-BR')}.</p>}
      {order.customer_name && <div className="order-customer"><strong>Cliente: {order.customer_name}</strong>{order.customer_phone && <a href={`https://wa.me/${order.customer_phone}`} target="_blank" rel="noreferrer">WhatsApp ↗</a>}{order.customer_note && <p>{order.customer_note}</p>}</div>}
      <div className="simple-list">{order.order_items.map((item) => <div key={item.id}><strong>{item.quantity}× {item.product_name}</strong><span>{currency.format(item.line_total)}</span>{order.status === 'confirmed' && item.product?.kind === 'digital' && ['portal', 'both'].includes(item.product.access_mode ?? '') && <div className="access-release-row">{accessLinks[`${order.id}:${item.id}`] ? <><input readOnly value={accessLinks[`${order.id}:${item.id}`]} onFocus={(event) => event.target.select()} /><button type="button" className="secondary-button" onClick={() => void navigator.clipboard.writeText(accessLinks[`${order.id}:${item.id}`])}>Copiar link</button>{order.customer_phone && <a className="secondary-button plain-link" href={whatsappLink(order.customer_phone, `Seu acesso ao conteúdo ${item.product_name} foi liberado: ${accessLinks[`${order.id}:${item.id}`]}`) ?? '#'} target="_blank" rel="noreferrer">Avisar cliente ↗</a>}</> : <button type="button" className="secondary-button" disabled={savingId !== null} onClick={() => void issueAccess(order, item.product_id, item.id)}>Liberar acesso protegido</button>}</div>}</div>)}</div>
      {order.status === 'pending' && <div className="form-actions"><button className="secondary-button" disabled={savingId !== null} onClick={() => void changeStatus(order, 'cancelled')}>Cancelar pedido</button><button className="primary-button" disabled={savingId !== null} onClick={() => void changeStatus(order, 'confirmed')}>{savingId === order.id ? 'Salvando…' : 'Confirmar pagamento'} <span>✓</span></button></div>}
      <p className="field-help">Localize a conversa do cliente pela referência {order.reference}. {order.status === 'confirmed' ? 'Pagamento marcado como confirmado; libere o portal quando o conteúdo estiver pronto ou combine a entrega pelo WhatsApp.' : 'A plataforma não verifica o Pix automaticamente nem envia arquivos ao cliente.'}</p>
    </article>)}</div> : <section className="panel empty-panel"><h2>{orders.length ? 'Nenhum pedido corresponde ao filtro' : 'Nenhum pedido ainda'}</h2><p>{orders.length ? 'Tente buscar por outra referência ou status.' : 'Os pedidos iniciados na sua vitrine aparecerão aqui.'}</p></section>}
  </>
}

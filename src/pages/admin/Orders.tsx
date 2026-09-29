import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { currency } from '../../lib/format'
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
  order_items: { id: number; product_name: string; quantity: number; line_total: number }[]
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

  async function load(workspaceId: string) {
    if (!supabase) return
    setLoading(true)
    const result = await supabase.from('orders')
      .select('id,reference,status,total,created_at,confirmed_at,cancelled_at,order_items(id,product_name,quantity,line_total)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders((result.data ?? []) as OrderRow[])
    setError(result.error ? 'Não foi possível carregar os pedidos. Tente atualizar a página.' : '')
    setLoading(false)
  }

  useEffect(() => { if (workspace) void load(workspace.id) }, [workspace?.id])

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

  return <>
    <div className="page-intro"><div><p className="eyebrow">Sua operação</p><h1>Pedidos</h1><p className="intro-description">Pedidos iniciados na vitrine. Confira o valor e a referência com o cliente, confirme o Pix no extrato e só então combine a entrega pelo WhatsApp.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="empty-copy">Carregando pedidos…</p> : orders.length ? <div className="orders-list">{orders.map((order) => <article className="panel order-card" key={order.id}>
      <div className="panel-heading"><div><span className="panel-kicker">{order.reference}</span><h2>{statusLabel[order.status]}</h2></div><strong>{currency.format(order.total)}</strong></div>
      <p className="field-help">Criado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(order.created_at))}</p>
      {order.confirmed_at && <p className="field-help">Pagamento confirmado em {new Date(order.confirmed_at).toLocaleString('pt-BR')}.</p>}
      {order.cancelled_at && <p className="field-help">Pedido cancelado em {new Date(order.cancelled_at).toLocaleString('pt-BR')}.</p>}
      <div className="simple-list">{order.order_items.map((item) => <div key={item.id}><strong>{item.quantity}× {item.product_name}</strong><span>{currency.format(item.line_total)}</span></div>)}</div>
      {order.status === 'pending' && <div className="form-actions"><button className="secondary-button" disabled={savingId !== null} onClick={() => void changeStatus(order, 'cancelled')}>Cancelar pedido</button><button className="primary-button" disabled={savingId !== null} onClick={() => void changeStatus(order, 'confirmed')}>{savingId === order.id ? 'Salvando…' : 'Confirmar pagamento'} <span>✓</span></button></div>}
      <p className="field-help">Localize a conversa do cliente pela referência {order.reference}. {order.status === 'confirmed' ? 'Pagamento marcado como confirmado; combine a entrega do manual, produto ou serviço na conversa.' : 'A plataforma não verifica o Pix automaticamente nem envia arquivos ao cliente.'}</p>
    </article>)}</div> : <section className="panel empty-panel"><h2>Nenhum pedido ainda</h2><p>Os pedidos iniciados na sua vitrine aparecerão aqui.</p></section>}
  </>
}

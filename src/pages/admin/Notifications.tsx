import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ClientNotification, Product } from '../../types'

type NotificationKind = ClientNotification['kind']
type Audience = 'all' | 'product'

const kindLabel: Record<NotificationKind, string> = { general: 'Orientação geral', workout: 'Treino', diet: 'Dieta', schedule: 'Agenda', important: 'Importante' }

export function AdminNotifications() {
  const { user, workspace } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [audience, setAudience] = useState<Audience>('all')
  const [productId, setProductId] = useState('')
  const [kind, setKind] = useState<NotificationKind>('general')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    if (!supabase || !workspace) return
    setLoading(true); setError('')
    const [productsResult, notificationsResult] = await Promise.all([
      supabase.from('products').select('id,workspace_id,kind,name,description,price,currency,published,image_url,service_area,category,level,access_mode,access_days,booking_enabled,content').eq('workspace_id', workspace.id).eq('kind', 'digital').order('created_at', { ascending: false }),
      supabase.from('client_notifications').select('id,audience,kind,title,body,product_id,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(30),
    ])
    if (productsResult.error || notificationsResult.error) setError('Não foi possível carregar as notificações. Atualize e tente novamente.')
    setProducts((productsResult.data ?? []) as Product[])
    setNotifications((notificationsResult.data ?? []) as ClientNotification[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [workspace?.id])

  async function sendNotification(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !workspace || !user || saving) return
    if (audience === 'product' && !productId) { setError('Escolha qual produto receberá este aviso.'); return }
    setSaving(true); setError(''); setMessage('')
    const result = await supabase.from('client_notifications').insert({ workspace_id: workspace.id, product_id: audience === 'product' ? productId : null, audience, kind, title: title.trim(), body: body.trim(), created_by: user.id }).select('id,audience,kind,title,body,product_id,created_at').single()
    if (result.error) setError(result.error.message || 'Não foi possível publicar o aviso.')
    else { setMessage('Aviso enviado para os acessos ativos selecionados.'); setTitle(''); setBody(''); setAudience('all'); setProductId(''); await load() }
    setSaving(false)
  }

  return <><div className="page-intro"><div><p className="eyebrow">Área dos alunos</p><h1>Notificações</h1><p className="intro-description">Envie orientações, lembretes e mudanças de agenda para quem possui acesso ativo aos seus conteúdos.</p></div><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>Atualizar ↻</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <section className="panel notification-composer"><div className="panel-heading"><div><span className="panel-kicker">Novo aviso</span><h2>Falar com seus alunos</h2></div><span className="notification-safety-badge">PWA + portal</span></div><p className="field-help">O aviso aparece dentro do portal protegido. Se o aluno permitir notificações, o navegador também pode sinalizar a novidade enquanto o acesso estiver aberto.</p><form className="form-grid" onSubmit={(event) => void sendNotification(event)}><div className="form-row"><label>Enviar para<select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}><option value="all">Todos os alunos com acesso ativo</option><option value="product">Alunos de um produto</option></select></label>{audience === 'product' ? <label>Produto<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione um conteúdo</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label> : <div />}</div><div className="form-row"><label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as NotificationKind)}>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="notification-preview-chip"><span>Entrega</span><strong>{audience === 'all' ? 'Base completa' : products.find((product) => product.id === productId)?.name || 'Produto selecionado'}</strong></div></div><label>Título<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Ajuste no treino de hoje" /></label><label>Mensagem<textarea required minLength={3} maxLength={1200} rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escreva uma orientação clara para os alunos." /></label><div className="form-actions form-actions-start"><button type="submit" className="primary-button" disabled={saving || !title.trim() || !body.trim() || (audience === 'product' && !productId)}>{saving ? 'Enviando…' : 'Enviar aviso'} <span>↗</span></button><span className="field-help">Não envia WhatsApp automaticamente.</span></div></form></section>
    <section className="panel notification-history"><div className="panel-heading"><div><span className="panel-kicker">Histórico</span><h2>Últimos avisos</h2></div><span>{notifications.length} registrados</span></div>{loading ? <p className="empty-copy">Carregando avisos…</p> : notifications.length ? <div className="notification-history-list">{notifications.map((notification) => <article key={notification.id}><div className="notification-history-icon">{notification.kind === 'workout' ? '↗' : notification.kind === 'diet' ? '◌' : notification.kind === 'schedule' ? '◷' : notification.kind === 'important' ? '!' : '✦'}</div><div><strong>{notification.title}</strong><p>{notification.body}</p><small>{kindLabel[notification.kind]} · {notification.audience === 'all' ? 'Todos os alunos' : products.find((product) => product.id === notification.product_id)?.name || 'Produto'} · {new Date(notification.created_at).toLocaleString('pt-BR')}</small></div></article>)}</div> : <p className="empty-copy">Nenhum aviso enviado ainda.</p>}</section>
  </>
}

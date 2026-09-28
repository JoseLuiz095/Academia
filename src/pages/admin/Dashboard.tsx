import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ContentIdea, Product } from '../../types'

export function AdminDashboard() {
  const { workspace } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!supabase || !workspace) return
    let active = true
    setLoading(true)
    setProducts([])
    setIdeas([])
    setLoadError(false)
    void Promise.all([
      supabase.from('products').select('id,workspace_id,kind,name,description,price,currency,published,image_url,service_area').eq('workspace_id', workspace.id),
      supabase.from('content_ideas').select('id,workspace_id,format,title,hook,body,cta,status,source,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(3),
    ]).then(([productsResult, ideasResult]) => { if (active) { setProducts((productsResult.data ?? []) as Product[]); setIdeas((ideasResult.data ?? []) as ContentIdea[]); setLoadError(!!productsResult.error || !!ideasResult.error); setLoading(false) } })
    return () => { active = false }
  }, [workspace?.id])

  const daysRemaining = workspace?.subscription_ends_at ? Math.ceil((new Date(workspace.subscription_ends_at).getTime() - Date.now()) / 86400000) : null
  const subscriptionDate = workspace?.subscription_ends_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(workspace.subscription_ends_at)) : 'A definir'
  const planLabel = workspace?.plan_code === 'pro' ? 'Crescimento' : workspace?.plan_code === 'creator' ? 'Criador' : 'Essencial'

  return <><div className="page-intro"><div><p className="eyebrow">Visão geral</p><h1>Olá, {workspace?.name}</h1><p className="intro-description">Sua operação em um só lugar, com dados reais do seu espaço.</p></div><Link className="primary-button plain-link" to="/admin/produtos">Adicionar produto <span>＋</span></Link></div>
    {!workspace?.published && <div className="setup-banner"><div className="setup-illustration"><div className="sun" /><div className="setup-person">✦</div></div><div className="setup-copy"><span className="setup-label">Sua vitrine ainda é privada</span><strong>Prepare seu espaço antes de compartilhar</strong><p>Configure o WhatsApp, cadastre um produto e publique quando estiver pronta.</p><Link to="/admin/primeiros-passos">Ver primeiros passos <span>→</span></Link></div></div>}
    <section className={`dashboard-subscription ${daysRemaining !== null && daysRemaining <= 0 ? 'is-expired' : ''}`}><div className="dashboard-subscription-icon">◇</div><div className="dashboard-subscription-copy"><span className="panel-kicker">Assinatura do espaço</span><strong>{planLabel} <small>{workspace?.subscription_status === 'trial' ? '· período de teste' : '· ativo'}</small></strong><p>{daysRemaining !== null && daysRemaining <= 0 ? 'Sua assinatura venceu. Revise o plano para manter o acesso.' : `Próximo vencimento em ${subscriptionDate}.`}</p></div><div className="dashboard-subscription-meta"><strong>{daysRemaining === null ? '—' : daysRemaining <= 0 ? 'Vencido' : `${daysRemaining} dias`}</strong><span>para revisar</span></div><Link className="secondary-button plain-link" to="/admin/planos">Ver plano →</Link></section>
    {loadError && <p className="form-error" role="alert">Parte dos dados não pôde ser carregada. Atualize a página para tentar novamente.</p>}
    <section className="metric-grid"><div className="metric-card"><div className="metric-icon orange">▣</div><span className="metric-label">Produtos cadastrados</span><strong className="metric-value">{loading || loadError ? '…' : products.length}</strong><div className="metric-foot"><span>{loadError ? 'Dados indisponíveis' : `${products.filter((item) => item.published).length} publicados`}</span></div></div><div className="metric-card"><div className="metric-icon purple">✦</div><span className="metric-label">Últimas ideias (até 3)</span><strong className="metric-value">{loading || loadError ? '…' : ideas.length}</strong><div className="metric-foot"><span>{loadError ? 'Dados indisponíveis' : `${ideas.filter((item) => item.status === 'approved').length} aprovadas nesta seleção`}</span></div></div><div className="metric-card"><div className="metric-icon green">↗</div><span className="metric-label">Página pública</span><strong className="metric-value metric-word">{workspace?.published ? 'No ar' : 'Privada'}</strong><div className="metric-foot"><span>{workspace?.slug}</span></div></div></section>
    <section className="panel editor-panel"><div className="panel-heading"><div><span className="panel-kicker">Conteúdo e atendimento</span><h2>Da ideia à conversa</h2></div></div><p className="empty-copy">Configure seu perfil de conteúdo, gere ou escreva uma ideia e revise antes de aprovar. No WhatsApp, a ideia aprovada só preenche uma prévia; você decide se vai enviar a mensagem.</p><div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/admin/conteudo">Revisar ideias →</Link><Link className="secondary-button plain-link" to="/admin/whatsapp">Testar no WhatsApp →</Link></div></section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Sua vitrine</span><h2>Produtos e serviços</h2></div><Link className="text-button plain-link" to="/admin/produtos">Gerenciar →</Link></div>{loadError ? <p className="empty-copy">Dados indisponíveis no momento.</p> : products.length ? <div className="simple-list">{products.slice(0, 4).map((product) => <div key={product.id}><strong>{product.name}</strong><span>{product.published ? 'Publicado' : 'Rascunho'}</span></div>)}</div> : <p className="empty-copy">Nenhum produto cadastrado. Comece por uma avaliação ou manual.</p>}</section><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Sua voz</span><h2>Ideias recentes</h2></div><Link className="text-button plain-link" to="/admin/conteudo">Abrir conteúdo →</Link></div>{loadError ? <p className="empty-copy">Dados indisponíveis no momento.</p> : ideas.length ? <div className="simple-list">{ideas.map((idea) => <div key={idea.id}><strong>{idea.title}</strong><span>{idea.format} · {idea.status === 'approved' ? 'Aprovada' : idea.status === 'review' ? 'Em revisão' : idea.status === 'archived' ? 'Arquivada' : 'Rascunho'}</span></div>)}</div> : <p className="empty-copy">Configure o seu público e prepare a primeira ideia.</p>}</section></div>
  </>
}

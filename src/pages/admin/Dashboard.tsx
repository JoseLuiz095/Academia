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

  useEffect(() => {
    if (!supabase || !workspace) return
    let active = true
    setLoading(true)
    setProducts([])
    setIdeas([])
    void Promise.all([
      supabase.from('products').select('id,workspace_id,kind,name,description,price,currency,published,image_url,service_area').eq('workspace_id', workspace.id),
      supabase.from('content_ideas').select('id,workspace_id,format,title,hook,body,cta,status,source,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(3),
    ]).then(([productsResult, ideasResult]) => { if (active) { setProducts((productsResult.data ?? []) as Product[]); setIdeas((ideasResult.data ?? []) as ContentIdea[]); setLoading(false) } })
    return () => { active = false }
  }, [workspace?.id])

  return <><div className="page-intro"><div><p className="eyebrow">Visão geral</p><h1>Olá, {workspace?.name}</h1><p className="intro-description">Sua operação em um só lugar, com dados reais do seu espaço.</p></div><Link className="primary-button plain-link" to="/admin/produtos">Adicionar produto <span>＋</span></Link></div>
    {!workspace?.published && <div className="setup-banner"><div className="setup-illustration"><div className="sun" /><div className="setup-person">✦</div></div><div className="setup-copy"><span className="setup-label">Sua vitrine ainda é privada</span><strong>Prepare seu espaço antes de compartilhar</strong><p>Configure o WhatsApp, cadastre um produto e publique quando estiver pronta.</p><Link to="/admin/primeiros-passos">Ver primeiros passos <span>→</span></Link></div></div>}
    <section className="metric-grid"><div className="metric-card"><div className="metric-icon orange">▣</div><span className="metric-label">Produtos cadastrados</span><strong className="metric-value">{loading ? '…' : products.length}</strong><div className="metric-foot"><span>{products.filter((item) => item.published).length} publicados</span></div></div><div className="metric-card"><div className="metric-icon purple">✦</div><span className="metric-label">Ideias recentes</span><strong className="metric-value">{loading ? '…' : ideas.length}</strong><div className="metric-foot"><span>{ideas.filter((item) => item.status === 'approved').length} aprovadas entre as recentes</span></div></div><div className="metric-card"><div className="metric-icon green">↗</div><span className="metric-label">Página pública</span><strong className="metric-value metric-word">{workspace?.published ? 'No ar' : 'Privada'}</strong><div className="metric-foot"><span>{workspace?.slug}</span></div></div></section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Sua vitrine</span><h2>Produtos e serviços</h2></div><Link className="text-button plain-link" to="/admin/produtos">Gerenciar →</Link></div>{products.length ? <div className="simple-list">{products.slice(0, 4).map((product) => <div key={product.id}><strong>{product.name}</strong><span>{product.published ? 'Publicado' : 'Rascunho'}</span></div>)}</div> : <p className="empty-copy">Nenhum produto cadastrado. Comece por uma avaliação ou manual.</p>}</section><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Sua voz</span><h2>Ideias recentes</h2></div><Link className="text-button plain-link" to="/admin/conteudo">Abrir conteúdo →</Link></div>{ideas.length ? <div className="simple-list">{ideas.map((idea) => <div key={idea.id}><strong>{idea.title}</strong><span>{idea.format} · {idea.status}</span></div>)}</div> : <p className="empty-copy">Configure o seu público e prepare a primeira ideia.</p>}</section></div>
  </>
}

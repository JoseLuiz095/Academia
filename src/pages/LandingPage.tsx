import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Workspace } from '../types'

export function LandingPage() {
  const [creators, setCreators] = useState<Workspace[]>([])
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.from('workspaces').select('id,name,slug,niche,description,published').eq('published', true).limit(6).then(({ data }) => { if (active) setCreators((data ?? []) as Workspace[]) })
    return () => { active = false }
  }, [])
  return <div className="landing-shell"><header className="landing-header"><Link to="/" className="store-logo plain-link"><span className="brand-mark">M</span><strong>movência</strong></Link><nav><a href="#como-funciona">Como funciona</a><Link to="/admin/login">Entrar</Link><Link className="primary-button" to="/admin/login">Criar meu espaço <span>→</span></Link></nav></header><main><section className="landing-hero"><div><p className="eyebrow">Sua marca em movimento</p><h1>Dê ritmo ao seu conteúdo. Venda do seu jeito.</h1><p>Para personal trainers, ideias de conteúdo e uma vitrine para serviços e produtos. Para criadores de outros nichos, apoio para posts e stories — mesmo sem usar a loja.</p><div className="landing-actions"><Link className="primary-button" to="/admin/login">Começar agora <span>→</span></Link><a className="secondary-link" href="#como-funciona">Conhecer a plataforma</a></div></div><div className="landing-art"><div className="landing-art-card"><span>✦ Ideia de conteúdo</span><strong>O treino que cabe na rotina do seu aluno</strong><small>Story · pronto para revisão</small></div><div className="landing-art-card accent"><span>▣ Sua vitrine</span><strong>Manuais, avaliações e produtos em um só lugar.</strong><small>Compartilhe seu próprio link</small></div></div></section><section id="como-funciona" className="landing-steps"><p className="eyebrow">Simples para começar</p><h2>Da primeira ideia ao próximo cliente</h2><div><article><span>01</span><h3>Monte seu espaço</h3><p>Defina sua marca, seu público e o tom da sua comunicação.</p></article><article><span>02</span><h3>Ative sua vitrine, se quiser</h3><p>Ofereça serviços, manuais e produtos quando fizer sentido para você.</p></article><article><span>03</span><h3>Organize seu conteúdo</h3><p>Configure o contexto da IA e revise ideias antes de usar.</p></article></div></section>{creators.length > 0 && <section className="landing-creators"><p className="eyebrow">Espaços publicados</p><h2>Conheça alguns criadores</h2><div className="store-grid">{creators.map((creator) => <Link key={creator.id} to={`/p/${creator.slug}`} className="store-card plain-link"><span className="store-card-icon">✦</span><strong>{creator.name}</strong><small>{creator.description || creator.niche}</small><span>Visitar página →</span></Link>)}</div></section>}</main><footer className="store-footer">movência · conteúdo que move</footer></div>
}

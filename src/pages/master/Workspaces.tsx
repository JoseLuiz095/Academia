import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Workspace } from '../../types'

export function MasterWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.from('workspaces').select('id,owner_id,name,slug,niche,description,whatsapp_number,pix_key,pix_receiver,pix_city,service_cities,published,created_at').order('created_at', { ascending: false }).then(({ data, error: queryError }) => { if (active) { setWorkspaces((data ?? []) as Workspace[]); setError(queryError?.message ?? '') } })
    return () => { active = false }
  }, [])
  const shown = workspaces.filter((item) => `${item.name} ${item.slug}`.toLowerCase().includes(filter.toLowerCase()))
  return <><div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Personais e criadores</h1><p className="intro-description">Espaços da plataforma, separados por proprietário e vitrine.</p></div></div><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Espaços</span><h2>Todos os cadastros</h2></div><input className="search-input" aria-label="Buscar criador" placeholder="Buscar por nome ou link" value={filter} onChange={(event) => setFilter(event.target.value)} /></div>{error && <p className="form-error" role="alert">{error}</p>}{shown.length ? <div className="simple-list">{shown.map((item) => <div key={item.id} className="master-workspace-row"><div><strong>{item.name}</strong><small>/p/{item.slug} · {item.niche}</small></div><span>{item.published ? 'Publicado' : 'Privado'}</span>{item.published && <a href={`/p/${item.slug}`} target="_blank" rel="noreferrer">Abrir ↗</a>}</div>)}</div> : <p className="empty-copy">Nenhum espaço encontrado.</p>}</section></>
}

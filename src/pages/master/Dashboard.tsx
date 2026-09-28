import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Workspace } from '../../types'

type MasterWorkspace = Pick<Workspace, 'id' | 'name' | 'published'>

export function MasterDashboard() {
  const [workspaces, setWorkspaces] = useState<MasterWorkspace[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.from('workspaces').select('id,name,published').order('created_at', { ascending: false }).then(({ data, error: queryError }) => { if (active) { setWorkspaces((data ?? []) as MasterWorkspace[]); setError(queryError?.message ?? '') } })
    return () => { active = false }
  }, [])
  return <><div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Visão da plataforma</h1><p className="intro-description">Acompanhe espaços cadastrados e vitrines publicadas.</p></div><Link className="primary-button plain-link" to="/admin-master/workspaces">Ver criadores <span>→</span></Link></div>{error && <p className="form-error" role="alert">{error}</p>}<section className="metric-grid"><div className="metric-card"><div className="metric-icon orange">▣</div><span className="metric-label">Espaços cadastrados</span><strong className="metric-value">{workspaces.length}</strong></div><div className="metric-card"><div className="metric-icon green">↗</div><span className="metric-label">Vitrines públicas</span><strong className="metric-value">{workspaces.filter((item) => item.published).length}</strong></div><div className="metric-card"><div className="metric-icon purple">◌</div><span className="metric-label">Em preparação</span><strong className="metric-value">{workspaces.filter((item) => !item.published).length}</strong></div></section><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Crescimento</span><h2>Espaços recentes</h2></div><Link className="text-button plain-link" to="/admin-master/workspaces">Ver todos →</Link></div>{workspaces.length ? <div className="simple-list">{workspaces.slice(0, 5).map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.published ? 'Publicado' : 'Em preparação'}</span></div>)}</div> : <p className="empty-copy">Nenhum espaço cadastrado ainda.</p>}</section></>
}

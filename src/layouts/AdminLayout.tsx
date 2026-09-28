import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

const navigation = [
  { to: '/admin', label: 'Visão geral', icon: '⌂', end: true },
  { to: '/admin/primeiros-passos', label: 'Primeiros passos', icon: '◷' },
  { to: '/admin/produtos', label: 'Produtos e serviços', icon: '▣' },
  { to: '/admin/pedidos', label: 'Pedidos', icon: '◫' },
  { to: '/admin/conteudo', label: 'Conteúdo IA', icon: '✦' },
  { to: '/admin/whatsapp', label: 'WhatsApp', icon: '◔' },
  { to: '/admin/configuracoes', label: 'Configurações', icon: '⚙' },
]

export function AdminLayout() {
  const { user, workspaces, workspace, isMaster, selectWorkspace, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const activeLabel = navigation.find((item) => item.to === location.pathname)?.label ?? 'Meu espaço'

  async function logout() {
    setLogoutError('')
    try {
      await signOut()
      navigate('/admin/login', { replace: true })
    } catch {
      setLogoutError('Não foi possível encerrar a sessão. Tente novamente.')
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand-lockup plain-link" href="/"><div className="brand-mark">I</div><div><strong>impulso</strong><span>conteúdo que move</span></div></a>
      {workspace ? <div className="workspace-switcher">
        <div className="avatar avatar-orange">{workspace.name.slice(0, 2).toUpperCase()}</div>
        {workspaces.length > 1 ? <select className="workspace-select" aria-label="Espaço ativo" value={workspace.id} onChange={(event) => selectWorkspace(event.target.value)}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <div className="workspace-copy"><strong>{workspace.name}</strong><span>Meu espaço</span></div>}
      </div> : <div className="workspace-switcher"><div className="avatar avatar-orange">＋</div><div className="workspace-copy"><strong>Novo espaço</strong><span>Configuração inicial</span></div></div>}
      <nav className="main-nav" aria-label="Navegação do personal">
        <p className="nav-heading">Operação</p>
        {navigation.slice(0, 2).map((item) => <NavLink key={item.to} end={item.end} to={item.to} className={({ isActive }) => `nav-item plain-link ${isActive ? 'active' : ''}`}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></NavLink>)}
        <p className="nav-heading nav-heading-spaced">Vendas e conteúdo</p>
        {navigation.slice(2, 6).map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item plain-link ${isActive ? 'active' : ''}`}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></NavLink>)}
        <p className="nav-heading nav-heading-spaced">Conta</p>
        <NavLink to="/admin/configuracoes" className={({ isActive }) => `nav-item plain-link ${isActive ? 'active' : ''}`}><span className="nav-icon">⚙</span><span>Configurações</span></NavLink>
      </nav>
      <div className="sidebar-footer">
        {workspace?.published && <a className="nav-item plain-link" href={`/p/${workspace.slug}`} target="_blank" rel="noreferrer"><span className="nav-icon">↗</span><span>Ver página pública</span></a>}
        {isMaster && <a className="nav-item plain-link" href="/admin-master"><span className="nav-icon">♛</span><span>Admin Master</span></a>}
        <button className="nav-item" onClick={() => void logout()}><span className="nav-icon">⇥</span><span>Sair</span></button>
        {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
        <div className="user-profile"><div className="avatar avatar-dark">{user?.email?.slice(0, 2).toUpperCase()}</div><div className="workspace-copy"><strong>{user?.email}</strong><span>Administrador</span></div></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark">I</div><strong>impulso</strong></div><div className="breadcrumb"><span>Meu espaço</span><b>/</b><strong>{activeLabel}</strong></div><div className="topbar-actions"><span className={`connection-status ${isSupabaseConfigured ? 'online' : ''}`}><i /> {isSupabaseConfigured ? 'Supabase configurado' : 'Configure o Supabase'}</span><span className="top-avatar">{user?.email?.slice(0, 2).toUpperCase()}</span></div></header>
      <div className="content-wrap" key={workspace?.id ?? 'setup'}><Outlet /></div>
    </main>
  </div>
}

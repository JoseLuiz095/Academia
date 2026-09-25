import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function MasterLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  async function logout() { await signOut(); navigate('/admin-master/login', { replace: true }) }
  return <div className="app-shell master-shell">
    <aside className="sidebar">
      <a className="brand-lockup plain-link" href="/"><div className="brand-mark">A</div><div><strong>academia</strong><span>admin master</span></div></a>
      <div className="workspace-switcher"><div className="avatar avatar-dark">AM</div><div className="workspace-copy"><strong>Plataforma</strong><span>Gestão central</span></div></div>
      <nav className="main-nav" aria-label="Navegação do Admin Master">
        <p className="nav-heading">Plataforma</p>
        <NavLink end to="/admin-master" className={({ isActive }) => `nav-item plain-link ${isActive ? 'active' : ''}`}><span className="nav-icon">⌂</span><span>Visão geral</span></NavLink>
        <NavLink to="/admin-master/workspaces" className={({ isActive }) => `nav-item plain-link ${isActive ? 'active' : ''}`}><span className="nav-icon">▣</span><span>Personais e criadores</span></NavLink>
      </nav>
      <div className="sidebar-footer"><a className="nav-item plain-link" href="/admin"><span className="nav-icon">↗</span><span>Painel do criador</span></a><button className="nav-item" onClick={() => void logout()}><span className="nav-icon">⇥</span><span>Sair</span></button><div className="user-profile"><div className="avatar avatar-dark">AM</div><div className="workspace-copy"><strong>{user?.email}</strong><span>Admin Master</span></div></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="mobile-brand"><div className="brand-mark">A</div><strong>academia</strong></div><div className="breadcrumb"><span>Plataforma</span><b>/</b><strong>Admin Master</strong></div><span className="connection-status online"><i /> Área restrita</span></header><div className="content-wrap"><Outlet /></div></main>
  </div>
}

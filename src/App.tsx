import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AdminLayout } from './layouts/AdminLayout'
import { MasterLayout } from './layouts/MasterLayout'
import { PublicLayout } from './layouts/PublicLayout'

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((module) => ({ default: module.AdminDashboard })))
const AdminProducts = lazy(() => import('./pages/admin/Products').then((module) => ({ default: module.AdminProducts })))
const AdminContent = lazy(() => import('./pages/admin/Content').then((module) => ({ default: module.AdminContent })))
const AdminSettings = lazy(() => import('./pages/admin/Settings').then((module) => ({ default: module.AdminSettings })))
const AdminWhatsApp = lazy(() => import('./pages/admin/WhatsApp').then((module) => ({ default: module.AdminWhatsApp })))
const AdminOnboarding = lazy(() => import('./pages/admin/Onboarding').then((module) => ({ default: module.AdminOnboarding })))
const MasterDashboard = lazy(() => import('./pages/master/Dashboard').then((module) => ({ default: module.MasterDashboard })))
const MasterWorkspaces = lazy(() => import('./pages/master/Workspaces').then((module) => ({ default: module.MasterWorkspaces })))
const Storefront = lazy(() => import('./pages/store/Storefront').then((module) => ({ default: module.StoreHome })))
const StoreProduct = lazy(() => import('./pages/store/Storefront').then((module) => ({ default: module.StoreProduct })))
const StoreCart = lazy(() => import('./pages/store/Storefront').then((module) => ({ default: module.StoreCart })))
const StoreCheckout = lazy(() => import('./pages/store/Storefront').then((module) => ({ default: module.StoreCheckout })))

function ProtectedAdmin() {
  const { user, loading, workspace } = useAuth()
  const location = useLocation()
  if (loading) return <div className="loading-page">Carregando seu espaço…</div>
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (!workspace && location.pathname !== '/admin/primeiros-passos') return <Navigate to="/admin/primeiros-passos" replace />
  return <AdminLayout />
}

function ProtectedMaster() {
  const { user, loading, isMaster } = useAuth()
  const location = useLocation()
  if (loading) return <div className="loading-page">Validando acesso…</div>
  if (!user) return <Navigate to="/admin-master/login" replace state={{ from: location.pathname }} />
  if (!isMaster) return <div className="loading-page"><div><h1>Acesso restrito</h1><p>Esta conta ainda não é administradora da plataforma.</p><a href="/admin">Ir para meu painel</a></div></div>
  return <MasterLayout />
}

export default function App() {
  return <Suspense fallback={<div className="loading-page">Carregando…</div>}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route element={<PublicLayout />}>
      <Route path="/p/:slug" element={<Storefront />} />
      <Route path="/p/:slug/produto/:id" element={<StoreProduct />} />
      <Route path="/p/:slug/carrinho" element={<StoreCart />} />
      <Route path="/p/:slug/finalizar" element={<StoreCheckout />} />
    </Route>

    <Route path="/admin/login" element={<LoginPage area="admin" />} />
    <Route element={<ProtectedAdmin />}>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/primeiros-passos" element={<AdminOnboarding />} />
      <Route path="/admin/produtos" element={<AdminProducts />} />
      <Route path="/admin/conteudo" element={<AdminContent />} />
      <Route path="/admin/whatsapp" element={<AdminWhatsApp />} />
      <Route path="/admin/configuracoes" element={<AdminSettings />} />
    </Route>

    <Route path="/admin-master/login" element={<LoginPage area="master" />} />
    <Route element={<ProtectedMaster />}>
      <Route path="/admin-master" element={<MasterDashboard />} />
      <Route path="/admin-master/workspaces" element={<MasterWorkspaces />} />
    </Route>

    <Route path="*" element={<div className="loading-page"><div><h1>Página não encontrada</h1><a href="/">Voltar ao início</a></div></div>} />
  </Routes></Suspense>
}

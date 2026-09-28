import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function LoginPage({ area }: { area: 'admin' | 'master' }) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh, authError } = useAuth()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para acessar.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      if (register && area === 'admin') {
        const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin/primeiros-passos` } })
        if (result.error) throw result.error
        if (result.data.session) { await refresh(); navigate('/admin/primeiros-passos', { replace: true }) }
        else setMessage('Conta criada. Confirme seu e-mail e depois entre no painel.')
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password })
        if (result.error) throw result.error
        const auth = await refresh()
        if (!auth.user) throw new Error('Não foi possível validar sua sessão. Tente novamente.')
        if (area === 'master' && !auth.isMaster) {
          setError('Esta conta não tem acesso ao Admin Master. Use o painel do criador ou entre com outra conta.')
          return
        }
        const from = (location.state as { from?: string } | null)?.from
        const validFrom = area === 'master'
          ? from === '/admin-master' || from?.startsWith('/admin-master/')
          : from === '/admin' || (from?.startsWith('/admin/') && from !== '/admin/login')
        navigate(validFrom && from ? from : area === 'master' ? '/admin-master' : '/admin', { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível acessar a conta.')
    } finally { setBusy(false) }
  }

  return <main className="auth-shell"><Link to="/" className="brand-lockup plain-link"><span className="brand-mark">I</span><span><strong>impulso</strong><small>conteúdo que move</small></span></Link><div className="auth-card"><p className="eyebrow">{area === 'master' ? 'Admin Master' : 'Painel do criador'}</p><h1>{register ? 'Crie seu espaço' : 'Bem-vindo de volta'}</h1><p>{register ? 'Comece a montar sua vitrine e suas ideias de conteúdo.' : 'Entre para cuidar da sua vitrine e do seu conteúdo.'}</p>{!isSupabaseConfigured && <div className="auth-setup-notice"><strong>Ambiente local incompleto</strong><span>Copie <code>.env.example</code> para <code>.env.local</code>, preencha a chave publicável do Supabase e reinicie o Vite.</span></div>}<form onSubmit={(event) => void submit(event)}><label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{(error || authError) && <p className="form-error" role="alert">{error || authError}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'} <span>→</span></button></form>{area === 'admin' && <><button className="text-button auth-switch" onClick={() => { setRegister(!register); setError(''); setMessage('') }}>{register ? 'Já tenho conta' : 'Criar minha conta'}</button><Link className="demo-access-link" to="/admin/demo">Abrir painel de demonstração sem configurar conta →</Link></>}</div><p className="auth-footer"><Link to="/">Voltar ao início</Link>{area === 'master' && <Link to="/admin/login">Sou personal</Link>}</p></main>
}

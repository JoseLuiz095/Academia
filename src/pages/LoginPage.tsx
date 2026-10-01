import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { useAuth } from '../contexts/AuthContext'
import { appConfig } from '../lib/config'
import { isSupabaseConfigured, supabase, supabaseConfigIssue } from '../lib/supabase'

export function LoginPage({ area }: { area: 'admin' | 'master' }) {
  const [searchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plan')
  const selectedPlan = requestedPlan || localStorage.getItem('impulso:pending-plan') || ''
  const [register, setRegister] = useState(area === 'admin' && searchParams.get('register') === '1')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [canResend, setCanResend] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh, authError } = useAuth()

  useEffect(() => {
    if (area === 'admin' && searchParams.get('register') === '1') setRegister(true)
    if (area === 'admin' && requestedPlan && ['demo', 'starter', 'creator', 'pro'].includes(requestedPlan)) localStorage.setItem('impulso:pending-plan', requestedPlan)
  }, [area, searchParams])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para acessar.'); return }
    if (appConfig.turnstileSiteKey && !captchaToken) { setError('Conclua a verificação de segurança.'); return }
    setBusy(true); setError(''); setMessage(''); setCanResend(false)
    try {
      if (register && area === 'admin') {
        const redirect = `${window.location.origin}/admin/primeiros-passos${selectedPlan ? `?plan=${encodeURIComponent(selectedPlan)}` : ''}`
        const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect, ...(captchaToken ? { captchaToken } : {}) } })
        if (result.error) throw result.error
        if (result.data.session) { await refresh(); localStorage.removeItem('impulso:pending-plan'); navigate(`/admin/primeiros-passos${selectedPlan ? `?plan=${encodeURIComponent(selectedPlan)}` : ''}`, { replace: true }) }
        else { setMessage('Conta criada. Confirme seu e-mail e depois entre no painel.'); setCanResend(true) }
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined })
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
      const caughtMessage = caught instanceof Error ? caught.message : 'Não foi possível acessar a conta.'
      setError(/invalid api key/i.test(caughtMessage) ? 'A chave publicável do Supabase foi rejeitada. Confira se ela pertence ao projeto vnpoinodvchmmbyxpacj, se não tem aspas ou espaços e refaça o deploy do Cloudflare.' : caughtMessage)
      if (appConfig.turnstileSiteKey) { setCaptchaToken(''); setCaptchaReset((value) => value + 1) }
    } finally { setBusy(false) }
  }

  async function resendConfirmation() {
    if (!supabase || !email) return
    if (appConfig.turnstileSiteKey && !captchaToken) { setError('Conclua a verificação de segurança antes de reenviar.'); return }
    setBusy(true); setError('')
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: captchaToken ? { captchaToken } : undefined })
    if (resendError) setError('Não foi possível reenviar agora. Aguarde o limite de envio e confira o SMTP do projeto.')
    else setMessage('Solicitação reenviada. Confira a caixa de entrada e o spam.')
    if (resendError && appConfig.turnstileSiteKey) { setCaptchaToken(''); setCaptchaReset((value) => value + 1) }
    setBusy(false)
  }

  const isHosted = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)
  const setupTitle = isHosted ? 'Configuração de homologação incompleta' : 'Ambiente local incompleto'
  const setupText = isHosted
    ? 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nas variáveis de build do Cloudflare e faça um novo deploy. O .env.local da sua máquina não é enviado para a hospedagem.'
    : 'Copie .env.example para .env.local, preencha a chave publicável do Supabase e reinicie o Vite.'
  return <main className="auth-shell"><Link to="/" className="brand-lockup plain-link"><span className="brand-mark">I</span><span><strong>impulso</strong><small>conteúdo que move</small></span></Link><div className="auth-card"><p className="eyebrow">{area === 'master' ? 'Admin Master' : 'Painel do criador'}</p><h1>{register ? 'Crie seu espaço' : 'Bem-vindo de volta'}</h1><p>{register ? 'Comece a montar sua vitrine e suas ideias de conteúdo.' : 'Entre para cuidar da sua vitrine e do seu conteúdo.'}</p>{!isSupabaseConfigured && <div className="auth-setup-notice"><strong>{setupTitle}</strong><span>{setupText}</span>{supabaseConfigIssue && <small>Verifique também se a variável foi criada no ambiente correto: Produção e/ou Preview.</small>}</div>}<form onSubmit={(event) => void submit(event)}><label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{appConfig.turnstileSiteKey && <div className="auth-security-card"><strong>Verificação de segurança</strong><small>Protege o acesso contra tentativas automatizadas.</small><TurnstileWidget siteKey={appConfig.turnstileSiteKey} action={register ? 'signup' : 'login'} onToken={setCaptchaToken} resetSignal={captchaReset} /></div>}{(error || authError) && <p className="form-error" role="alert">{error || authError}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="primary-button" disabled={busy || Boolean(appConfig.turnstileSiteKey && !captchaToken)}>{busy ? 'Aguarde…' : appConfig.turnstileSiteKey && !captchaToken ? 'Conclua a verificação' : register ? 'Criar conta' : 'Entrar'} <span>→</span></button></form>{canResend && <button type="button" className="text-button auth-resend" disabled={busy} onClick={() => void resendConfirmation()}>Reenviar confirmação</button>}{!register && <Link className="password-recovery-link" to={`/recuperar-senha?area=${area}`}>Esqueci minha senha</Link>}{area === 'admin' && <><button className="text-button auth-switch" onClick={() => { setRegister(!register); setError(''); setMessage(''); setCanResend(false); setCaptchaToken(''); setCaptchaReset((value) => value + 1) }}>{register ? 'Já tenho conta' : 'Criar minha conta'}</button><Link className="demo-access-link" to="/admin/demo">Abrir painel de demonstração sem configurar conta →</Link></>}</div><p className="auth-footer"><Link to="/">Voltar ao início</Link>{area === 'master' && <Link to="/admin/login">Sou personal</Link>}</p></main>
}

import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { appConfig } from '../lib/config'
import { supabase } from '../lib/supabase'

function returnPath(area: string | null) {
  return area === 'master' ? '/admin-master' : '/admin'
}

function AuthBrand() {
  return <Link to="/" className="brand-lockup plain-link"><span className="brand-mark">I</span><span><strong>impulso</strong><small>conteúdo que move</small></span></Link>
}

export function PasswordRecoveryPage() {
  const [searchParams] = useSearchParams()
  const area = searchParams.get('area')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Configure o Supabase antes de recuperar a senha.'); return }
    if (appConfig.turnstileSiteKey && !captchaToken) { setError('Conclua a verificação de segurança.'); return }
    setBusy(true); setError(''); setMessage('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/conta/seguranca?area=${area === 'master' ? 'master' : 'admin'}`, ...(captchaToken ? { captchaToken } : {}) })
    if (resetError) setError('Não foi possível solicitar a recuperação. Confira o e-mail e tente novamente.')
    else setMessage('Se este e-mail estiver cadastrado, enviaremos um link para criar uma nova senha. Confira também o spam.')
    if (resetError && appConfig.turnstileSiteKey) { setCaptchaToken(''); setCaptchaReset((value) => value + 1) }
    setBusy(false)
  }

  return <main className="auth-shell"><AuthBrand /><div className="auth-card"><p className="eyebrow">Segurança da conta</p><h1>Recupere sua senha</h1><p>Informe o e-mail usado no painel. O link recebido abrirá uma página segura para cadastrar uma nova senha.</p><form onSubmit={(event) => void submit(event)}><label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>{appConfig.turnstileSiteKey && <div className="auth-security-card"><strong>Verificação de segurança</strong><small>Protege o envio do link de recuperação.</small><TurnstileWidget siteKey={appConfig.turnstileSiteKey} action="password-recovery" onToken={setCaptchaToken} resetSignal={captchaReset} /></div>}{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="primary-button" disabled={busy || Boolean(appConfig.turnstileSiteKey && !captchaToken)}>{busy ? 'Enviando…' : appConfig.turnstileSiteKey && !captchaToken ? 'Conclua a verificação' : 'Enviar link'} <span>→</span></button></form><Link className="demo-access-link" to={area === 'master' ? '/admin-master/login' : '/admin/login'}>Voltar para o login</Link></div></main>
}

export function ChangePasswordPage() {
  const [searchParams] = useSearchParams()
  const area = searchParams.get('area')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const destination = returnPath(area)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('Configure o Supabase antes de alterar a senha.'); return }
    if (password.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return }
    if (password !== confirmation) { setError('A confirmação da senha não confere.'); return }
    setBusy(true); setError(''); setMessage('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError('Não foi possível alterar a senha. Abra novamente o link de recuperação ou entre no painel.')
    else { setPassword(''); setConfirmation(''); setMessage('Senha alterada com sucesso. Agora você pode entrar com a nova senha.') }
    setBusy(false)
  }

  return <main className="auth-shell"><AuthBrand /><div className="auth-card"><p className="eyebrow">Segurança da conta</p><h1>Altere sua senha</h1><p>Use esta página depois de entrar no painel ou de abrir o link enviado pelo Supabase.</p><form onSubmit={(event) => void submit(event)}><label>Nova senha<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirme a nova senha<input type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Alterar senha'} <span>→</span></button></form><Link className="demo-access-link" to={destination}>Voltar ao painel</Link></div></main>
}

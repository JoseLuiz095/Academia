import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TurnstileWidget } from '../../components/TurnstileWidget'
import { useStore } from '../../layouts/PublicLayout'
import { appConfig } from '../../lib/config'
import { supabase } from '../../lib/supabase'

export function StoreReport() {
  const { workspace, products } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [productId, setProductId] = useState(new URLSearchParams(window.location.search).get('produto') ?? '')
  const [reason, setReason] = useState('Documento profissional ausente ou inválido')
  const [details, setDetails] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !appConfig.turnstileSiteKey || !captchaToken) { setError('Conclua a verificação de segurança para enviar a denúncia.'); return }
    setBusy(true); setError('')
    const result = await supabase.functions.invoke('report-public-store', { body: { workspace_id: workspace.id, product_id: productId || null, reporter_name: name, reporter_email: email, reason, details, turnstile_token: captchaToken } })
    if (result.error) { setError(result.error.message || 'Não foi possível registrar a denúncia.'); setCaptchaToken(''); setCaptchaReset((current) => current + 1) }
    else setSent(true)
    setBusy(false)
  }

  return <section className="store-section narrow"><Link className="back-link" to={`/p/${workspace.slug}`}>← Voltar à vitrine</Link>{sent ? <section className="panel report-success"><span>✓</span><h1>Denúncia registrada</h1><p>O Admin Master recebeu o pedido de análise. A plataforma vai revisar as informações e os documentos apresentados.</p><Link className="primary-button plain-link" to={`/p/${workspace.slug}`}>Voltar à página</Link></section> : <><p className="eyebrow">Canal de responsabilidade</p><h1>Denunciar esta página</h1><p className="checkout-intro">Use este canal para relatar ausência ou possível irregularidade em documento profissional, ficha de treino, dieta ou outro conteúdo. A denúncia será analisada; o envio não fecha a página automaticamente.</p><form className="panel report-form" onSubmit={(event) => void submit(event)}><label>Seu nome<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" /></label><label>Seu e-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></label><label>Produto relacionado (opcional)<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Página inteira</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Motivo<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Documento profissional ausente ou inválido</option><option>Conteúdo de treino ou dieta potencialmente irregular</option><option>Informação comercial enganosa</option><option>Outro motivo</option></select></label><label>Detalhes<textarea required rows={5} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Explique o que deve ser analisado e, se possível, informe o produto ou trecho da página." /></label>{appConfig.turnstileSiteKey ? <div className="report-captcha"><strong>Verificação de segurança</strong><TurnstileWidget siteKey={appConfig.turnstileSiteKey} action="public-report" onToken={setCaptchaToken} resetSignal={captchaReset} /></div> : <p className="form-error">O canal de denúncia ficará disponível depois que o Cloudflare Turnstile for configurado.</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy || !captchaToken || !appConfig.turnstileSiteKey}>{busy ? 'Enviando…' : 'Enviar para análise'} <span>→</span></button><p className="field-help">Seu e-mail será usado somente para eventual retorno sobre esta análise. Não publique dados pessoais de terceiros no campo de detalhes.</p></form></>}</section>
}

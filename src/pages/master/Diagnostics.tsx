import { useCallback, useEffect, useState } from 'react'
import { appConfig } from '../../lib/config'
import { supabase } from '../../lib/supabase'

type Check = { label: string; detail: string; ok: boolean; action?: string }

export function MasterDiagnostics() {
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    if (!supabase) {
      setChecks([{ label: 'Supabase', detail: 'A chave publicável e a URL ainda não estão configuradas neste build.', ok: false, action: 'Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.' }])
      setLoading(false)
      return
    }
    const [billingResult, plansResult, workspacesResult, requestsResult] = await Promise.all([
      supabase.from('platform_billing_settings').select('pix_key,pix_receiver,pix_city,pix_static_code,whatsapp').eq('id', true).maybeSingle(),
      supabase.from('platform_plans').select('code,enabled').eq('enabled', true),
      supabase.from('workspaces').select('id', { count: 'exact', head: true }),
      supabase.from('workspace_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    const queryError = billingResult.error ?? plansResult.error ?? workspacesResult.error ?? requestsResult.error
    if (queryError) setError('Não foi possível concluir o diagnóstico. Atualize a página e tente novamente.')
    const billing = billingResult.data
    const hasPix = Boolean(billing?.pix_static_code || (billing?.pix_key && billing?.pix_receiver && billing?.pix_city))
    const checks: Check[] = [
      { label: 'Supabase', detail: 'Conexão com o projeto e autenticação disponíveis.', ok: !queryError },
      { label: 'Turnstile público', detail: appConfig.turnstileSiteKey ? 'A chave pública está disponível no build atual.' : 'A chave pública não está disponível neste ambiente.', ok: Boolean(appConfig.turnstileSiteKey), action: 'Preencha VITE_TURNSTILE_SITE_KEY no build do Cloudflare.' },
      { label: 'Pix da plataforma', detail: hasPix ? 'O Admin Master possui Pix estático ou chave com favorecido e cidade.' : 'Os dados para cobrar planos ainda estão incompletos.', ok: hasPix, action: 'Configure em Admin Master → Pagamentos e Pix.' },
      { label: 'WhatsApp financeiro', detail: billing?.whatsapp ? 'O canal para comprovantes está configurado.' : 'Nenhum WhatsApp financeiro foi informado.', ok: Boolean(billing?.whatsapp), action: 'Cadastre o número em Admin Master → Pagamentos e Pix.' },
      { label: 'Planos disponíveis', detail: `${plansResult.data?.length ?? 0} plano(s) ativo(s) para novas solicitações.`, ok: (plansResult.data?.length ?? 0) > 0, action: 'Ative ao menos um plano em Admin Master → Planos e limites.' },
      { label: 'Solicitações pendentes', detail: `${requestsResult.count ?? 0} solicitação(ões) aguardando revisão.`, ok: true },
      { label: 'Espaços cadastrados', detail: `${workspacesResult.count ?? 0} espaço(s) criado(s) na plataforma.`, ok: true },
    ]
    setChecks(checks)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const healthy = checks.filter((check) => check.ok).length
  return <>
    <div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Diagnóstico da plataforma</h1><p className="intro-description">Confira rapidamente se os serviços essenciais estão prontos para receber criadores, pagamentos e pedidos.</p></div><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>Atualizar ↻</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="diagnostics-summary"><strong>{loading ? 'Verificando…' : `${healthy} de ${checks.length} verificações prontas`}</strong><span>Chaves secretas como Gemini, SMTP e TURNSTILE_SECRET_KEY continuam protegidas no Supabase e no provedor de autenticação.</span></section>
    <section className="diagnostics-list">{loading ? <p className="empty-copy">Consultando configurações…</p> : checks.map((check) => <article className={`diagnostic-card ${check.ok ? 'is-ok' : 'is-warning'}`} key={check.label}><div className="diagnostic-icon" aria-hidden="true">{check.ok ? '✓' : '!'}</div><div><strong>{check.label}</strong><p>{check.detail}</p>{check.action && <small>{check.action}</small>}</div></article>)}</section>
  </>
}

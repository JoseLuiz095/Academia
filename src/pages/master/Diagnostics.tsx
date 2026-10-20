import { useCallback, useEffect, useState } from 'react'
import { appConfig } from '../../lib/config'
import { supabase } from '../../lib/supabase'

type Check = { label: string; detail: string; ok: boolean; action?: string }
type PublicOrderPayment = { payment_provider: string | null; payment_status: string | null; created_at: string }

const formatDate = (value?: string) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : null

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
    const [billingResult, plansResult, workspacesResult, requestsResult, ordersResult] = await Promise.all([
      supabase.from('platform_billing_settings').select('pix_key,pix_receiver,pix_city,pix_static_code,whatsapp').eq('id', true).maybeSingle(),
      supabase.from('platform_plans').select('code,enabled').eq('enabled', true),
      supabase.from('workspaces').select('id', { count: 'exact', head: true }),
      supabase.from('workspace_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      // Apenas campos operacionais e não sensíveis. Segredos do Asaas e o
      // journal privado do webhook nunca são consultados pelo navegador.
      supabase.from('orders').select('payment_provider,payment_status,created_at').order('created_at', { ascending: false }).limit(200),
    ])
    const queryError = billingResult.error ?? plansResult.error ?? workspacesResult.error ?? requestsResult.error
    if (queryError) setError('Não foi possível concluir o diagnóstico. Atualize a página e tente novamente.')
    const billing = billingResult.data
    const hasPix = Boolean(billing?.pix_static_code || (billing?.pix_key && billing?.pix_receiver && billing?.pix_city))
    const storeOrders = (ordersResult.data ?? []) as PublicOrderPayment[]
    const asaasOrders = storeOrders.filter((order) => order.payment_provider === 'asaas')
    const manualOrders = storeOrders.filter((order) => order.payment_provider === 'manual_pix')
    const paymentErrors = storeOrders.filter((order) => order.payment_status === 'error')
    const latestPayment = storeOrders[0]?.created_at
    const paymentDetail = ordersResult.error
      ? 'Não foi possível ler o resumo operacional dos pedidos com a sessão atual.'
      : storeOrders.length
        ? `Asaas: ${asaasOrders.length} pedido(s), ${asaasOrders.filter((order) => order.payment_status === 'awaiting_payment').length} aguardando e ${asaasOrders.filter((order) => order.payment_status === 'confirmed').length} confirmado(s). Pix manual: ${manualOrders.length} pedido(s), ${manualOrders.filter((order) => order.payment_status === 'manual_review').length} em conferência.${latestPayment ? ` Último pedido: ${formatDate(latestPayment)}.` : ''}`
        : 'A leitura pública está disponível, mas ainda não há pedidos de loja visíveis para esta sessão.'
    const checks: Check[] = [
      { label: 'Supabase', detail: 'Conexão com o projeto e autenticação disponíveis.', ok: !queryError },
      { label: 'Turnstile público', detail: appConfig.turnstileSiteKey ? 'A chave pública está disponível no build atual.' : 'A chave pública não está disponível neste ambiente.', ok: Boolean(appConfig.turnstileSiteKey), action: 'Preencha VITE_TURNSTILE_SITE_KEY no build do Cloudflare.' },
      { label: 'Pix da plataforma', detail: hasPix ? 'O Admin Master possui Pix estático ou chave com favorecido e cidade.' : 'Os dados para cobrar planos ainda estão incompletos.', ok: hasPix, action: 'Configure em Admin Master → Pagamentos e Pix.' },
      { label: 'WhatsApp financeiro', detail: billing?.whatsapp ? 'O canal para comprovantes está configurado.' : 'Nenhum WhatsApp financeiro foi informado.', ok: Boolean(billing?.whatsapp), action: 'Cadastre o número em Admin Master → Pagamentos e Pix.' },
      { label: 'Pagamentos Asaas e Pix manual', detail: paymentDetail, ok: !ordersResult.error && paymentErrors.length === 0, action: ordersResult.error ? 'Verifique a permissão de leitura do resumo de pedidos para o Admin Master.' : paymentErrors.length ? `${paymentErrors.length} pedido(s) registram falha de pagamento e precisam de reconciliação.` : 'A tela usa somente status agregados; chaves, tokens e eventos privados não são exibidos.' },
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

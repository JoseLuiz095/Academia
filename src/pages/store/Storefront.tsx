import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TurnstileWidget } from '../../components/TurnstileWidget'
import { useStore } from '../../layouts/PublicLayout'
import { appConfig } from '../../lib/config'
import { currency, whatsappLink } from '../../lib/format'
import { buildPixCopyPaste, buildPixFromStaticBase, isPixCopyPaste, readStaticPixReceiver } from '../../lib/pix'
import { createPendingOrder, finishOrderAttempt, loadOrderReceipt, rememberOrderReceipt } from '../../lib/orders'
import type { OrderReceipt, Product } from '../../types'

const label: Record<Product['kind'], string> = { service: 'Serviço', digital: 'Manual digital', physical: 'Produto físico' }

function ProductCover({ product }: { product: Product }) {
  return <div className={`store-product-cover ${product.kind}`} aria-hidden="true">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <><span>{label[product.kind]}</span><strong>{product.name}</strong><i>✦</i></>}</div>
}

export function StoreHome() {
  const { workspace, products } = useStore()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | Product['kind']>('all')
  const settings = workspace.store_settings ?? {}
  const contact = settings.show_whatsapp !== false && whatsappLink(workspace.whatsapp_number, `Olá! Vim pela página ${workspace.name} e gostaria de saber mais.`)
  const filteredProducts = products.filter((product) => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    return (kind === 'all' || product.kind === kind) && (!normalized || `${product.name} ${product.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalized))
  })
  return <><section className="store-hero"><div><p className="eyebrow">Bem-vindo ao meu espaço</p><h1>{workspace.name}</h1><p>{settings.tagline || workspace.description || 'Conteúdo, serviços e produtos para acompanhar você na sua jornada.'}</p><div className="store-hero-actions"><a className="primary-button plain-link" href="#catalogo">{settings.cta_label || 'Conhecer produtos'} <span>↓</span></a>{contact && <a className="secondary-button plain-link" href={contact} target="_blank" rel="noreferrer">Falar no WhatsApp ↗</a>}{settings.show_service_area !== false && workspace.service_cities && <small>◎ {workspace.service_cities}</small>}</div><div className="store-trust-row"><span>✓ Atendimento humano</span>{settings.show_pix !== false && <span>✓ Pagamento Pix direto</span>}<span>✓ Entrega combinada</span></div></div><div className="store-hero-art"><span>seu espaço</span><strong>um próximo passo<br />feito para você.</strong><i>✦</i><small>{settings.show_ai_badge !== false ? 'conteúdo com contexto' : 'seu próximo passo'}</small></div></section><section id="catalogo" className="store-section"><div className="store-section-heading"><div><p className="eyebrow">Escolha seu próximo passo</p><h2>Produtos e serviços</h2><p>Uma seleção criada para ajudar você a avançar com clareza.</p></div><span>{filteredProducts.length} de {products.length} {products.length === 1 ? 'opção' : 'opções'}</span></div>{products.length ? <><div className="store-catalog-tools"><input aria-label="Buscar no catálogo" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no catálogo" /><select aria-label="Filtrar por tipo" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">Todos os tipos</option><option value="service">Serviços</option><option value="digital">Manuais digitais</option><option value="physical">Produtos físicos</option></select></div>{filteredProducts.length ? <div className="store-grid">{filteredProducts.map((product) => <Link className="store-product-card plain-link" to={`/p/${workspace.slug}/produto/${product.id}`} key={product.id}><ProductCover product={product} /><div><small>{label[product.kind]}</small><h3>{product.name}</h3><p>{product.description || 'Saiba mais sobre esta opção.'}</p><strong>{product.price === null ? 'Preço a combinar' : currency.format(product.price)}</strong><span>{product.price === null ? 'Ver como funciona' : 'Conhecer opção'} →</span></div></Link>)}</div> : <section className="panel empty-panel"><h2>Nenhum resultado</h2><p>Tente outro termo ou limpe os filtros.</p></section>}</> : <section className="panel empty-panel"><h2>Novidades em breve</h2><p>Este profissional ainda está preparando o catálogo.</p>{contact && <a className="secondary-button plain-link" href={contact} target="_blank" rel="noreferrer">Falar com o profissional ↗</a>}</section>}</section></>
}

export function StoreProduct() {
  const { id } = useParams()
  const { workspace, products, addToCart } = useStore()
  const navigate = useNavigate()
  const product = products.find((item) => item.id === id)
  if (!product) return <section className="store-section"><h1>Produto indisponível</h1><Link to={`/p/${workspace.slug}`}>Voltar para a vitrine</Link></section>
  const contact = whatsappLink(workspace.whatsapp_number, `Olá! Tenho interesse em ${product.name} da página ${workspace.name}.`)
  return <section className="store-section"><Link className="back-link" to={`/p/${workspace.slug}`}>← Voltar à vitrine</Link><div className="store-detail"><ProductCover product={product} /><div><p className="eyebrow">{label[product.kind]}</p><h1>{product.name}</h1><p>{product.description || 'Converse com o profissional para saber mais.'}</p>{product.service_area && <div className="detail-note">◎ Atendimento: {product.service_area}</div>}<strong className="store-price">{product.price === null ? 'Preço a combinar' : currency.format(product.price)}</strong><div className="detail-actions">{product.price !== null && <button className="primary-button" onClick={() => { addToCart(product.id); navigate(`/p/${workspace.slug}/carrinho`) }}>Adicionar à sacola <span>＋</span></button>}{contact && <a href={contact} target="_blank" rel="noreferrer" className="secondary-button plain-link">Conversar no WhatsApp ↗</a>}</div>{!contact && product.price === null && <p className="field-help">Este profissional ainda não informou um WhatsApp para combinar o preço.</p>}<small>Pagamento confirmado diretamente pelo profissional. Produto digital ou agendamento liberado após confirmação.</small></div></div></section>
}

export function StoreCart() {
  const { workspace, products, cart, changeQuantity } = useStore()
  const rows = cart.map((item) => ({ item, product: products.find((product) => product.id === item.id) })).filter((row): row is { item: typeof row.item; product: Product } => Boolean(row.product))
  const total = rows.reduce((sum, row) => sum + (row.product.price ?? 0) * row.item.quantity, 0)
  return <section className="store-section narrow"><Link className="back-link" to={`/p/${workspace.slug}`}>← Continuar explorando</Link><p className="eyebrow">Sua seleção</p><h1>Minha sacola</h1>{rows.length ? <><div className="cart-list">{rows.map(({ item, product }) => <div className="cart-row" key={item.id}><div><strong>{product.name}</strong><small>{label[product.kind]}</small></div><div className="quantity-control" role="group" aria-label={`Quantidade de ${product.name}`}><button aria-label={item.quantity === 1 ? `Remover ${product.name} da sacola` : `Diminuir quantidade de ${product.name}`} onClick={() => changeQuantity(item.id, item.quantity - 1)}>−</button><output aria-live="polite">{item.quantity}</output><button aria-label={`Aumentar quantidade de ${product.name}`} disabled={item.quantity >= 99} onClick={() => changeQuantity(item.id, item.quantity + 1)}>＋</button></div><strong>{currency.format((product.price ?? 0) * item.quantity)}</strong></div>)}</div><div className="cart-total"><span>Total</span><strong aria-live="polite">{currency.format(total)}</strong></div><Link className="primary-button plain-link" to={`/p/${workspace.slug}/finalizar`}>Continuar para o pedido <span>→</span></Link></> : <div className="panel empty-panel"><h2>Sua sacola está vazia</h2><p>Escolha um serviço ou produto para começar.</p><Link className="primary-button plain-link" to={`/p/${workspace.slug}`}>Ver catálogo <span>→</span></Link></div>}</section>
}

export function StoreCheckout() {
  const { workspace, products, cart, clearCart } = useStore()
  const [lastReceipt, setLastReceipt] = useState<OrderReceipt | null>(() => loadOrderReceipt(workspace.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [customerConsent, setCustomerConsent] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const submitting = useRef(false)
  const rows = cart.map((item) => ({ item, product: products.find((product) => product.id === item.id) })).filter((row): row is { item: typeof row.item; product: Product } => Boolean(row.product))
  const receipt = rows.length ? null : lastReceipt
  const total = rows.reduce((sum, row) => sum + (row.product.price ?? 0) * row.item.quantity, 0)
  const pixCode = useMemo(() => {
    if (!receipt || !workspace.pix_key || receipt.total <= 0) return null
    try {
      if (isPixCopyPaste(workspace.pix_key)) return buildPixFromStaticBase(workspace.pix_key, receipt.total)
      if (workspace.pix_receiver && workspace.pix_city) return buildPixCopyPaste({ key: workspace.pix_key, receiver: workspace.pix_receiver, city: workspace.pix_city, amount: receipt.total })
      return null
    }
    catch { return null }
  }, [workspace.pix_key, workspace.pix_receiver, workspace.pix_city, receipt])
  const pixReceiver = useMemo(() => {
    if (workspace.pix_key && isPixCopyPaste(workspace.pix_key)) {
      try { return readStaticPixReceiver(workspace.pix_key) } catch { return '' }
    }
    return workspace.pix_receiver ?? ''
  }, [workspace.pix_key, workspace.pix_receiver])
  const contact = receipt ? whatsappLink(workspace.whatsapp_number, `Olá! Registrei o pedido ${receipt.reference} na página ${workspace.name}:\n${receipt.items.map((item) => `• ${item.quantity}x ${item.name} — ${currency.format(item.line_total)}`).join('\n')}\nTotal: ${currency.format(receipt.total)}. Fiz o pagamento Pix e aguardo sua conferência no banco para combinar a entrega ou o agendamento.`) : null

  async function registerOrder() {
    if (submitting.current) return
    if (!appConfig.turnstileSiteKey || !captchaToken) { setError('O checkout precisa da verificação Cloudflare Turnstile.'); return }
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await createPendingOrder(workspace.id, rows.map(({ item }) => ({ product_id: item.id, quantity: item.quantity })), Math.round(total * 100) / 100, captchaToken, { name: customerName, phone: customerPhone, note: customerNote, consent: customerConsent })
      rememberOrderReceipt(workspace.id, saved)
      setLastReceipt(saved)
      finishOrderAttempt(workspace.id)
      clearCart()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pedido. Tente novamente.')
      if (appConfig.turnstileSiteKey) { setCaptchaToken(''); setCaptchaReset((value) => value + 1) }
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  async function copy(text: string, what: string) { try { await navigator.clipboard.writeText(text); setMessage({ text: `${what} copiado.`, error: false }) } catch { setMessage({ text: 'Não foi possível copiar automaticamente. Selecione e copie o texto acima.', error: true }) } }
  if (!rows.length && !receipt) return <section className="store-section narrow"><h1>Sacola vazia</h1><Link to={`/p/${workspace.slug}`}>Voltar para a vitrine</Link></section>
  return <section className="store-section narrow">
    {!receipt && <Link className="back-link" to={`/p/${workspace.slug}/carrinho`}>← Voltar à sacola</Link>}
    <p className="eyebrow">Pagamento direto com o profissional</p>
    <h1>{receipt ? `Pedido ${receipt.reference}` : 'Combinar pedido'}</h1>
    <p className="checkout-intro">{receipt ? 'Pedido registrado como pendente. Confira os dados Pix no banco, pague e envie a referência ao profissional pelo WhatsApp para conferência.' : 'Registre a seleção para receber uma referência e os dados de pagamento.'}</p>
    <div className="checkout-grid">
      <div className="panel">
        <h2>Pix manual</h2>
        {receipt ? <>
          <p>Confira o nome do recebedor e o valor no aplicativo do seu banco. O profissional confirma o pagamento antes de liberar o produto ou agendamento.</p>
          <div className="checkout-payee"><span>Recebedor</span><strong>{pixReceiver || 'A confirmar com o profissional'}</strong><span>Total</span><strong>{currency.format(receipt.total)}</strong></div>
          {pixCode ? <><label>Pix copia e cola com o valor do pedido<textarea readOnly rows={5} value={pixCode} /></label><button className="primary-button" onClick={() => void copy(pixCode, 'Código Pix')}>Copiar Pix <span aria-hidden="true">▣</span></button></> : workspace.pix_key && !isPixCopyPaste(workspace.pix_key) ? <><label>Chave Pix<input readOnly value={workspace.pix_key} /></label><button className="primary-button" onClick={() => void copy(workspace.pix_key!, 'Chave Pix')}>Copiar chave <span aria-hidden="true">▣</span></button><p className="field-help">A chave Pix não inclui o valor. Informe o total mostrado acima no aplicativo do banco.</p></> : <p className="field-help">O Pix automático não está disponível. Combine o pagamento diretamente com o profissional.</p>}
          {message && <p className={message.error ? 'form-error' : 'form-success'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
        </> : <><p>Informe como o profissional poderá retornar e depois confira a verificação de segurança.</p><div className="checkout-customer-form"><label>Seu nome<input required minLength={2} maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Seu nome" /></label><label>WhatsApp com DDD<input required inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="5511999999999" /></label><label>Observação (opcional)<textarea rows={3} maxLength={500} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Ex.: prefiro atendimento à noite" /></label><label className="check-row"><input type="checkbox" checked={customerConsent} onChange={(event) => setCustomerConsent(event.target.checked)} /> Autorizo o profissional a usar estes dados para responder a este pedido.</label></div>{appConfig.turnstileSiteKey ? <div className="checkout-security-card"><strong>Verificação de segurança</strong><small>Protege a criação do pedido contra automações abusivas.</small><TurnstileWidget siteKey={appConfig.turnstileSiteKey} action="checkout" onToken={setCaptchaToken} resetSignal={captchaReset} /></div> : <p className="form-error" role="alert">O checkout ficará disponível depois que o Cloudflare Turnstile for configurado neste ambiente.</p>}</>}
      </div>
      <div className="panel">
        <h2>Resumo</h2>
        <div className="simple-list">{receipt ? receipt.items.map((item, index) => <div key={index}><strong>{item.quantity}× {item.name}</strong><span>{currency.format(item.line_total)}</span></div>) : rows.map(({ item, product }) => <div key={item.id}><strong>{item.quantity}× {product.name}</strong><span>{currency.format((product.price ?? 0) * item.quantity)}</span></div>)}</div>
        <div className="cart-total"><span>Total</span><strong>{currency.format(receipt?.total ?? total)}</strong></div>
        {receipt ? <><p className="form-success" role="status">Referência {receipt.reference} registrada. Aguardando confirmação manual do profissional.</p>{contact ? <a className="primary-button plain-link" href={contact} target="_blank" rel="noreferrer">Enviar pedido no WhatsApp <span aria-hidden="true">↗</span></a> : <><button className="secondary-button" type="button" onClick={() => void copy(receipt.reference, 'Referência do pedido')}>Copiar referência</button><p className="field-help">O WhatsApp ainda não foi configurado. Guarde esta referência e combine a entrega pelo canal informado pelo profissional.</p></>}</> : <button className="primary-button" type="button" disabled={busy || !customerConsent || !appConfig.turnstileSiteKey || Boolean(!captchaToken)} onClick={() => void registerOrder()}>{busy ? 'Registrando…' : !appConfig.turnstileSiteKey ? 'Checkout indisponível' : !customerConsent ? 'Autorize o contato' : !captchaToken ? 'Conclua a verificação' : 'Registrar pedido pendente'} <span aria-hidden="true">→</span></button>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="field-help">Após pagar, envie a referência pelo WhatsApp. O pedido fica pendente até o profissional conferir o crédito no banco. Os dados informados são usados somente para responder este pedido.</p>
      </div>
    </div>
  </section>
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketingFrame } from '../components/MarketingFrame'

type DemoStep = 'conteudo' | 'vitrine' | 'pedido'
type Niche = 'fitness' | 'outros'
type Format = 'story' | 'post'

const examples = {
  fitness: {
    brand: 'Marina Treina', audience: 'alunos iniciantes com 3 treinos por semana',
    subject: 'como montar uma rotina de treino possível', product: 'Manual de treino para iniciantes',
    service: 'Avaliação individual', price: 'R$ 49,90', amount: 49.9,
    story: ['Você não precisa começar treinando todos os dias.', 'Três sessões bem planejadas já criam uma rotina sustentável.', 'Quer um ponto de partida? Me chame para uma avaliação.'],
    post: 'Comece com uma frequência que cabe na sua semana. Para quem está iniciando, três treinos planejados podem ser mais sustentáveis do que uma meta difícil de manter. Ajuste cargas e exercícios com orientação profissional.',
  },
  outros: {
    brand: 'Ateliê da Bia', audience: 'pessoas que querem aprender maquiagem para o dia a dia',
    subject: 'uma rotina simples de maquiagem', product: 'Guia de maquiagem essencial',
    service: 'Consultoria individual', price: 'R$ 39,90', amount: 39.9,
    story: ['Uma maquiagem rápida também pode ter intenção.', 'Escolha um produto-chave e construa o visual ao redor dele.', 'Quer meu passo a passo? Conheça o guia na vitrine.'],
    post: 'Menos produtos, mais clareza: comece com uma rotina que faça sentido para o seu tempo e estilo. O segredo é descobrir o que você realmente usa antes de comprar mais itens.',
  },
} as const

const steps: { id: DemoStep; number: string; label: string }[] = [
  { id: 'conteudo', number: '01', label: 'Conteúdo' },
  { id: 'vitrine', number: '02', label: 'Vitrine' },
  { id: 'pedido', number: '03', label: 'Pedido e Pix' },
]

export function DemoPage() {
  useEffect(() => { document.title = 'Demonstração interativa | Impulso' }, [])
  const [step, setStep] = useState<DemoStep>('conteudo')
  const [niche, setNiche] = useState<Niche>('fitness')
  const [format, setFormat] = useState<Format>('story')
  const [approved, setApproved] = useState(false)
  const [cartQuantity, setCartQuantity] = useState(0)
  const [orderStatus, setOrderStatus] = useState<'none' | 'pending' | 'confirmed'>('none')
  const [orderView, setOrderView] = useState<'customer' | 'admin'>('customer')
  const example = examples[niche]
  const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(example.amount * cartQuantity)

  function resetDemo(nextNiche: Niche = niche) {
    setNiche(nextNiche)
    setStep('conteudo')
    setFormat('story')
    setApproved(false)
    setCartQuantity(0)
    setOrderStatus('none')
    setOrderView('customer')
  }

  return <MarketingFrame>
    <section className="demo-intro">
      <p className="eyebrow">Conheça por dentro</p>
      <h1>Uma demonstração do caminho completo.</h1>
      <p>Monte uma ideia, adicione um produto, crie um pedido fictício e confira o pagamento no painel demonstrativo. Nada aqui usa Gemini, grava pedidos reais ou movimenta dinheiro.</p>
      <div className="demo-niche-switch" role="group" aria-label="Escolha um exemplo de negócio">
        <button type="button" className={niche === 'fitness' ? 'selected' : ''} aria-pressed={niche === 'fitness'} onClick={() => resetDemo('fitness')}>Personal trainer</button>
        <button type="button" className={niche === 'outros' ? 'selected' : ''} aria-pressed={niche === 'outros'} onClick={() => resetDemo('outros')}>Outro nicho</button>
      </div>
    </section>

    <section className="demo-stage" aria-label="Demonstração interativa">
      <div className="demo-steps" role="tablist" aria-label="Etapas da demonstração">
        {steps.map((item) => <button key={item.id} id={`demo-tab-${item.id}`} type="button" role="tab" aria-controls="demo-panel" aria-selected={step === item.id} className={step === item.id ? 'active' : ''} onClick={() => setStep(item.id)}><span>{item.number}</span>{item.label}</button>)}
      </div>
      <div className="demo-window" role="tabpanel" id="demo-panel" aria-labelledby={`demo-tab-${step}`}>
        <div className="demo-window-bar"><span><i /><i /><i /></span><strong>{step === 'conteudo' ? 'Painel do criador · Conteúdo' : step === 'vitrine' ? `${example.brand} · Vitrine` : orderView === 'customer' ? 'Cliente · Finalização' : 'Painel do criador · Pedidos'}</strong><small>Simulação local</small></div>
        {step === 'conteudo' && <div className="demo-content-grid">
          <div className="demo-panel"><span className="demo-kicker">Seu contexto</span><h2>Uma ideia que parte do seu público</h2><div className="demo-field"><small>Público</small><strong>{example.audience}</strong></div><div className="demo-field"><small>Objetivo do conteúdo</small><strong>{example.subject}</strong></div><div className="demo-format" role="group" aria-label="Formato do exemplo"><button type="button" className={format === 'story' ? 'selected' : ''} aria-pressed={format === 'story'} onClick={() => { setFormat('story'); setApproved(false) }}>Story</button><button type="button" className={format === 'post' ? 'selected' : ''} aria-pressed={format === 'post'} onClick={() => { setFormat('post'); setApproved(false) }}>Post</button></div><p className="demo-note">No painel real, você configura o contexto, gera ou escreve a ideia e revisa o texto antes de aprovar. Aqui o texto é um exemplo fixo, não uma geração de IA.</p></div>
          <div className="demo-preview"><span className={`demo-badge ${approved ? 'approved' : ''}`}>{approved ? 'Exemplo aprovado nesta simulação' : 'Exemplo de rascunho · aguardando revisão'}</span><h3>{example.subject}</h3>{format === 'story' ? <ol>{example.story.map((line) => <li key={line}>{line}</li>)}</ol> : <p>{example.post}</p>}<div className="demo-preview-actions"><button type="button" className={approved ? 'secondary-button' : 'primary-button'} onClick={() => setApproved(!approved)}>{approved ? 'Voltar para revisão' : 'Aprovar exemplo'} <span aria-hidden="true">✓</span></button><button type="button" className="secondary-button" onClick={() => setStep('vitrine')}>Conhecer a vitrine →</button></div><div className="demo-preview-foot"><span>✦ {format === 'story' ? 'Roteiro de story' : 'Legenda de post'}</span><span>{approved ? 'Pronto para uso manual' : 'Revise antes de usar'}</span></div></div>
        </div>}
        {step === 'vitrine' && <><div className="demo-store-grid"><div className="demo-store-hero"><span className="demo-kicker">Sua marca, seu endereço</span><h2>{example.brand}</h2><p>Um espaço para apresentar seu trabalho e oferecer produtos ou serviços ao seu público.</p><span className="demo-address">impulso.exemplo/p/{niche === 'fitness' ? 'marina-treina' : 'atelie-da-bia'}</span></div><div className="demo-product"><div className="demo-product-art"><span>{niche === 'fitness' ? 'Treino' : 'Beleza'}</span><b>O próximo passo começa aqui.</b></div><small>Produto digital</small><h3>{example.product}</h3><strong>{example.price}</strong><button type="button" className="demo-visual-button" disabled={orderStatus !== 'none' || cartQuantity >= 9} onClick={() => setCartQuantity((value) => Math.min(9, value + 1))}>{orderStatus !== 'none' ? 'Pedido já registrado' : 'Adicionar à sacola →'}</button></div><div className="demo-product secondary"><div className="demo-product-art"><span>Atendimento</span><b>Orientação feita para você.</b></div><small>Serviço</small><h3>{example.service}</h3><strong>Valor definido pelo profissional</strong><span className="demo-visual-button muted">Contato pelo WhatsApp no site real</span></div></div><div className="demo-cart-bar"><span><strong>Sacola demonstrativa</strong><small>{cartQuantity ? `${cartQuantity} × ${example.product} · ${total}` : 'Adicione o manual para continuar'}</small></span><button type="button" className="primary-button" disabled={!cartQuantity} onClick={() => { setStep('pedido'); setOrderView('customer') }}>Ver sacola e pedido <span aria-hidden="true">→</span></button></div></>}
        {step === 'pedido' && <div className="demo-order-area">
          <div className="demo-mode-switch" role="group" aria-label="Visão do pedido"><button type="button" className={orderView === 'customer' ? 'active' : ''} aria-pressed={orderView === 'customer'} onClick={() => setOrderView('customer')}>Visão do cliente</button><button type="button" className={orderView === 'admin' ? 'active' : ''} aria-pressed={orderView === 'admin'} onClick={() => setOrderView('admin')}>Painel do personal</button></div>
          {orderView === 'customer' ? <div className="demo-order-grid"><div className="demo-panel"><span className="demo-kicker">Sua sacola</span><h2>{orderStatus === 'none' ? 'Finalize um pedido de exemplo' : 'Pedido demonstrativo registrado'}</h2>{cartQuantity ? <><div className="demo-order-row"><span>{example.product}</span><strong>{example.price}</strong></div><div className="demo-order-row"><span>Quantidade</span><span className="demo-qty"><button type="button" aria-label="Diminuir quantidade" disabled={orderStatus !== 'none'} onClick={() => setCartQuantity((value) => Math.max(0, value - 1))}>−</button><strong>{cartQuantity}</strong><button type="button" aria-label="Aumentar quantidade" disabled={orderStatus !== 'none' || cartQuantity >= 9} onClick={() => setCartQuantity((value) => Math.min(9, value + 1))}>＋</button></span></div><div className="demo-order-row total"><span>Total</span><strong>{total}</strong></div>{orderStatus === 'none' ? <button type="button" className="primary-button" onClick={() => setOrderStatus('pending')}>Registrar pedido fictício <span aria-hidden="true">→</span></button> : <><div className="demo-reference">DEMO-001 · {orderStatus === 'pending' ? 'Aguardando confirmação' : 'Pagamento marcado como confirmado'}</div><p className="demo-note">No site real, o cliente receberia um Pix copia e cola com valor e enviaria esta referência pelo WhatsApp após pagar. Aqui nenhum código de pagamento é gerado.</p><button type="button" className="secondary-button" onClick={() => setOrderView('admin')}>Acompanhar no painel →</button></>}</> : <><p className="demo-note">Sua sacola está vazia. Escolha um produto na vitrine para continuar.</p><button type="button" className="secondary-button" onClick={() => setStep('vitrine')}>Ir para a vitrine →</button></>}</div><div className="demo-timeline"><div><b>1</b><span><strong>Pedido pendente</strong><small>O cliente recebe a referência e os dados Pix no pedido real.</small></span></div><div><b>2</b><span><strong>Conferência no extrato</strong><small>O profissional confere o crédito antes de confirmar.</small></span></div><div><b>3</b><span><strong>Entrega combinada</strong><small>Manual, produto ou atendimento são alinhados pelo WhatsApp.</small></span></div><p>Esta simulação não cobra Pix nem verifica pagamento bancário.</p></div></div> : <div className="demo-admin-order"><span className="demo-kicker">Pedidos recebidos</span><h2>Painel de {example.brand}</h2>{orderStatus === 'none' ? <p>Quando o cliente registrar o pedido demonstrativo, ele aparecerá aqui. Volte à visão do cliente para criar um.</p> : <div className="demo-admin-order-card"><div><small>Referência DEMO-001</small><strong>{example.product}</strong><span>{cartQuantity} unidade(s) · {total}</span></div><div><span className={`demo-badge ${orderStatus === 'confirmed' ? 'approved' : ''}`}>{orderStatus === 'pending' ? 'Aguardando pagamento' : 'Pagamento confirmado na simulação'}</span>{orderStatus === 'pending' ? <button type="button" className="primary-button" onClick={() => setOrderStatus('confirmed')}>Simular confirmação manual <span aria-hidden="true">✓</span></button> : <p>Próximo passo real: combinar entrega ou atendimento com o cliente pelo WhatsApp.</p>}</div></div>}<p className="demo-note">No produto real, confirme somente depois de conferir o crédito e o valor no extrato bancário. Este botão altera apenas a demonstração.</p></div>}
        </div>}
      </div>
      <div className="demo-stage-foot"><p>Os dados desta simulação ficam apenas na página atual.</p><div><button type="button" className="secondary-button" onClick={() => resetDemo()}>Reiniciar demonstração</button><Link to="/" className="secondary-button plain-link">Ver recursos</Link><Link to="/admin/login" className="primary-button plain-link">Criar meu espaço <span>→</span></Link></div></div>
    </section>
  </MarketingFrame>
}

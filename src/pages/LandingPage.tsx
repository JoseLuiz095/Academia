import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketingFrame } from '../components/MarketingFrame'
import { supabase } from '../lib/supabase'
import type { Workspace } from '../types'
import { DemoExperience } from './DemoPage'

const features = [
  { number: '01', icon: '✦', title: 'Ideias de conteúdo com o seu contexto', text: 'Descreva público, tom de voz, objetivos e preferências. Prepare o prompt, escreva manualmente ou gere uma ideia com Gemini quando a integração estiver configurada. Você revisa e aprova antes de usar.' },
  { number: '02', icon: '▣', title: 'Uma vitrine para a sua marca', text: 'Apresente serviços, manuais digitais e produtos físicos em uma página pública com seu nome e endereço próprio dentro do Impulso. Publique a loja apenas se ela fizer sentido para o seu negócio.' },
  { number: '03', icon: '◇', title: 'Pedidos e Pix sem complicar', text: 'O cliente monta o pedido e recebe uma referência. Um Pix copia e cola estático ou chave Pix pode gerar o código com o valor. Você confere o crédito no banco e confirma no painel.' },
  { number: '04', icon: '↗', title: 'Conversa direta no WhatsApp', text: 'O cliente abre uma conversa com o profissional. Ideias aprovadas também podem virar uma mensagem de teste para envio manual. Não há disparo automático nesta versão.' },
]

const faqs = [
  { question: 'Preciso vender produtos para usar o Impulso?', answer: 'Não. Criadores de outros nichos podem usar apenas a organização e a geração de ideias de conteúdo, sem publicar a vitrine.' },
  { question: 'O Pix é confirmado automaticamente?', answer: 'Não. O cliente paga pelo banco e envia a referência do pedido. O profissional confere o crédito no extrato antes de marcar o pedido como confirmado.' },
  { question: 'O manual digital é liberado dentro da plataforma?', answer: 'Ainda não. Nesta primeira versão, a entrega é combinada pelo WhatsApp após a confirmação manual. Download protegido na plataforma é uma evolução planejada.' },
  { question: 'Posso usar minha marca e meu domínio?', answer: 'Cada conta já pode ter seu nome e uma página como /p/minha-marca. Domínio próprio de cada empresa ainda não está disponível.' },
]

type PlatformPlan = { code: 'starter' | 'creator' | 'pro'; name: string; monthly_price_cents: number; product_limit: number; ai_daily_limit: number }
const planOrder = ['starter', 'creator', 'pro']
const planDescriptions: Record<PlatformPlan['code'], string> = {
  starter: 'Para começar a organizar sua marca.',
  creator: 'Para publicar, vender e manter constância.',
  pro: 'Para uma rotina comercial mais completa.',
}
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function LandingPage() {
  const [creators, setCreators] = useState<Workspace[]>([])
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState(false)
  useEffect(() => { document.title = 'Impulso | Conteúdo, vitrine e pedidos com a sua marca' }, [])
  useEffect(() => {
    if (!supabase) { setPlansError(true); setPlansLoading(false); return }
    let active = true
    void supabase.from('platform_plans').select('code,name,monthly_price_cents,product_limit,ai_daily_limit').eq('enabled', true).then(({ data, error }) => {
      if (!active) return
      if (error) setPlansError(true)
      else setPlans(((data ?? []) as PlatformPlan[]).sort((a, b) => planOrder.indexOf(a.code) - planOrder.indexOf(b.code)))
      setPlansLoading(false)
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.from('workspaces').select('id,name,slug,niche,description,published').eq('published', true).limit(6).then(({ data }) => { if (active) setCreators((data ?? []) as Workspace[]) })
    return () => { active = false }
  }, [])

  return <MarketingFrame>
    <section className="landing-hero commercial-hero">
      <div className="commercial-hero-copy">
        <p className="eyebrow">Conteúdo, vitrine e relacionamento em um lugar</p>
        <h1>Sua ideia vira presença. Sua presença vira oportunidade.</h1>
        <p>O Impulso ajuda profissionais a planejar posts e stories com contexto, mostrar o que vendem e organizar pedidos. Começa simples para personal trainers e acompanha criadores de outros nichos.</p>
        <div className="landing-actions"><Link className="primary-button plain-link" to="/admin/login">Solicitar meu espaço <span aria-hidden="true">→</span></Link><a className="secondary-button plain-link" href="#demonstracao">Ver demonstração</a></div>
        <div className="commercial-hero-proof"><span>✦ Ideias revisadas por você</span><span>▣ Vitrine opcional</span><span>◇ Pix direto com o profissional</span></div>
      </div>
      <div className="commercial-scene" aria-label="Prévia ilustrativa do painel, da vitrine e dos pedidos">
        <div className="commercial-scene-bar"><span className="brand-mark">I</span><strong>Seu espaço no Impulso</strong><small>Visão ilustrativa</small></div>
        <div className="commercial-scene-body"><div className="commercial-scene-idea"><small>✦ CONTEÚDO EM REVISÃO</small><strong>Uma ideia feita para o seu público</strong><p>Gancho, roteiro e chamada para ação organizados para você adaptar e aprovar.</p><span>Story · aguardando revisão</span></div><div className="commercial-scene-bottom"><div><small>▣ SUA VITRINE</small><strong>Produtos e serviços</strong><span>Compartilhe seu link</span></div><div><small>◇ NOVO PEDIDO</small><strong>Pagamento pendente</strong><span>Confirme no extrato</span></div></div></div>
      </div>
    </section>

    <section className="commercial-ribbon" aria-label="Resumo da plataforma"><span>01 · Conheça seu público</span><span>02 · Crie e revise</span><span>03 · Apresente sua oferta</span><span>04 · Acompanhe o pedido</span></section>

    <section id="funcionalidades" className="commercial-section commercial-features"><div className="commercial-section-heading"><p className="eyebrow">O que você encontra aqui</p><h2>As ferramentas essenciais, conectadas ao seu trabalho.</h2><p>O conteúdo atrai; sua página apresenta; o pedido organiza a conversa. Use apenas as partes de que você precisa.</p></div><div className="commercial-feature-grid">{features.map((feature) => <article key={feature.number}><div className="commercial-feature-top"><span>{feature.icon}</span><small>{feature.number}</small></div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>

    <section className="commercial-split"><div><p className="eyebrow">Para quem foi pensado</p><h2>Uma base. Marcas e rotinas diferentes.</h2><p>O personal pode configurar seu perfil de alunos, equipamentos e tipo de treino para orientar o conteúdo. Já um criador de outro ramo usa o mesmo fluxo de planejamento com seu próprio público e tom de voz.</p><a className="secondary-link" href="#demonstracao">Compare dois exemplos na demonstração →</a></div><div className="commercial-audience-cards"><article><span>🏋</span><strong>Personal trainer</strong><p>Ideias de treino, vitrine de avaliações, manuais e produtos.</p></article><article><span>✳</span><strong>Criador de outro nicho</strong><p>Posts e stories com contexto; a loja fica opcional.</p></article></div></section>

    <section id="como-funciona" className="landing-steps commercial-process"><div className="commercial-section-heading"><p className="eyebrow">Na prática</p><h2>Do primeiro rascunho ao atendimento.</h2><p>Um fluxo enxuto para você controlar cada etapa.</p></div><div><article><span>01</span><h3>Crie seu espaço</h3><p>Defina nome, público, tom e, se quiser, seus produtos e WhatsApp.</p></article><article><span>02</span><h3>Prepare o conteúdo</h3><p>Escreva ou gere uma ideia. Revise e aprove antes de compartilhar.</p></article><article><span>03</span><h3>Receba o pedido</h3><p>O cliente vê o Pix com valor e envia a referência pelo WhatsApp.</p></article><article><span>04</span><h3>Confirme e entregue</h3><p>Confira o pagamento no banco e combine a entrega diretamente.</p></article></div></section>

    <section className="commercial-demo-callout"><div><p className="eyebrow">Veja antes de criar uma conta</p><h2>Passe pelas telas como se fosse seu negócio.</h2><p>Alterne entre personal trainer e outro nicho. Veja exemplos de conteúdo, vitrine e pedido, sem dados reais ou cobrança.</p><a className="primary-button plain-link" href="#demonstracao">Abrir demonstração <span aria-hidden="true">↓</span></a></div><div className="commercial-demo-art"><span>✦ Ideia</span><span>▣ Vitrine</span><span>◇ Pedido</span></div></section>

    <section id="demonstracao" className="commercial-inline-demo" aria-labelledby="demonstracao-titulo"><div className="commercial-inline-heading"><p className="eyebrow">Demonstração interativa</p><h2 id="demonstracao-titulo">Veja o fluxo completo na própria página.</h2><p>Escolha um nicho e percorra conteúdo, vitrine, pedido e confirmação manual. A simulação é local e não usa sua conta, Gemini ou dinheiro real.</p></div><DemoExperience /></section>

    <section id="planos" className="commercial-section commercial-pricing"><div className="commercial-section-heading"><p className="eyebrow">Planos simples para começar</p><h2>Escolha o nível de apoio que combina com sua fase.</h2><p>Solicite seu espaço e aguarde a aprovação. Após a liberação, você terá 14 dias de teste. A mensalidade é solicitada depois pelo painel e o Pix é confirmado manualmente pelo Admin Master; não há cobrança automática.</p></div>{plansLoading ? <p className="empty-copy">Carregando planos…</p> : plansError ? <p className="form-error" role="alert">Não foi possível consultar os planos agora. Tente novamente mais tarde.</p> : plans.length ? <div className="commercial-plan-grid">{plans.map((plan) => <article className={`commercial-plan-card ${plan.code === 'creator' ? 'featured' : ''}`} key={plan.code}>{plan.code === 'creator' && <span className="plan-recommended">Em destaque</span>}<span className="commercial-plan-label">{plan.name}</span><strong>{currency.format(plan.monthly_price_cents / 100)}<small>/mês</small></strong><p>{planDescriptions[plan.code]}</p><ul><li>✓ Até {plan.product_limit} produtos ou serviços</li><li>✓ Até {plan.ai_daily_limit} ideias com IA por dia</li><li>✓ Vitrine e atendimento pelo WhatsApp</li></ul><Link className={plan.code === 'creator' ? 'primary-button plain-link' : 'secondary-button plain-link'} to="/admin/login">Solicitar espaço <span>→</span></Link></article>)}</div> : <p className="empty-copy">Nenhum plano está disponível para novas solicitações no momento.</p>}<p className="commercial-smallprint">Preços e limites atuais dos planos disponíveis. A escolha do plano será analisada junto com a solicitação do espaço; não há disparos automáticos no WhatsApp.</p></section>

    <section className="commercial-section commercial-clarity"><div className="commercial-section-heading"><p className="eyebrow">Transparência</p><h2>O que já funciona — e o que vem depois.</h2></div><div className="commercial-clarity-grid"><article><span className="commercial-state ready">Disponível agora</span><ul><li>Painel do criador e vitrine pública por marca</li><li>Perfil de conteúdo, prompt e revisão de ideias</li><li>Catálogo, sacola, referência de pedido e Pix manual</li><li>Planos, status e aviso de vencimento no painel</li></ul></article><article><span className="commercial-state later">Próximas evoluções</span><ul><li>Entrega protegida de manuais dentro da plataforma</li><li>Domínio próprio por empresa</li><li>Envio automático de mensagens, sujeito à integração apropriada</li><li>Cobrança automática e renovação da assinatura SaaS</li></ul></article></div><p className="commercial-smallprint">A geração com Gemini depende da chave configurada no servidor. Sem ela, o criador ainda pode preparar o prompt e salvar ideias manualmente.</p></section>

    <section className="commercial-section commercial-faq"><div className="commercial-section-heading"><p className="eyebrow">Dúvidas comuns</p><h2>Sem surpresas no caminho.</h2></div><div className="commercial-faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>

    {creators.length > 0 && <section className="landing-creators"><p className="eyebrow">Espaços publicados</p><h2>Conheça alguns criadores</h2><div className="store-grid">{creators.map((creator) => <Link key={creator.id} to={`/p/${creator.slug}`} className="store-card plain-link"><span className="store-card-icon">✦</span><strong>{creator.name}</strong><small>{creator.description || creator.niche}</small><span>Visitar página →</span></Link>)}</div></section>}

    <section className="commercial-final"><p className="eyebrow">Seu próximo passo</p><h2>Comece pela sua ideia. O resto cresce com você.</h2><p>Crie o espaço com sua marca e use conteúdo ou vitrine no ritmo do seu negócio.</p><div><Link className="primary-button plain-link" to="/admin/login">Criar meu espaço <span aria-hidden="true">→</span></Link><a className="secondary-button plain-link" href="#planos">Conhecer planos</a></div></section>
  </MarketingFrame>
}

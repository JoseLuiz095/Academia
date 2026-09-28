import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

type Plan = {
  code: 'starter' | 'creator' | 'pro'
  name: string
  price: string
  description: string
  features: string[]
  accent?: boolean
}

const plans: Plan[] = [
  { code: 'starter', name: 'Essencial', price: 'R$ 29/mês', description: 'Para começar a organizar sua presença.', features: ['Perfil público da marca', 'Até 5 produtos ou serviços', 'Ideias de conteúdo com revisão manual', 'Pedidos e Pix direto'] },
  { code: 'creator', name: 'Criador', price: 'R$ 59/mês', description: 'O equilíbrio para vender e publicar com consistência.', features: ['Até 30 produtos ou serviços', 'Mais ideias de conteúdo com IA', 'Vitrine personalizada', 'Pedidos, Pix e atendimento no WhatsApp'], accent: true },
  { code: 'pro', name: 'Crescimento', price: 'R$ 99/mês', description: 'Para quem já tem uma rotina comercial ativa.', features: ['Até 100 produtos ou serviços', 'Prioridade para recursos de IA', 'Personalização avançada da vitrine', 'Suporte e evolução do espaço'] },
]

function getDaysRemaining(date: string | null | undefined) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

export function AdminPlans() {
  const { workspace } = useAuth()
  const currentCode = workspace?.plan_code ?? 'starter'
  const currentPlan = plans.find((plan) => plan.code === currentCode) ?? plans[0]
  const daysRemaining = getDaysRemaining(workspace?.subscription_ends_at)
  const isTrial = workspace?.subscription_status === 'trial'
  const statusLabel = daysRemaining !== null && daysRemaining <= 0 ? 'Vencido' : isTrial ? 'Período de teste' : 'Ativo'
  const renewalDate = workspace?.subscription_ends_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(workspace.subscription_ends_at)) : 'A definir'
  const subject = encodeURIComponent(`Plano do espaço ${workspace?.name ?? ''}`)

  return <>
    <div className="page-intro"><div><p className="eyebrow">Conta e crescimento</p><h1>Plano e assinatura</h1><p className="intro-description">Veja o que está ativo no seu espaço e escolha o próximo passo com clareza.</p></div><Link className="secondary-button plain-link" to="/admin/configuracoes">Ajustar minha vitrine →</Link></div>
    <section className={`subscription-overview ${daysRemaining !== null && daysRemaining <= 0 ? 'is-expired' : ''}`}><div><span className="subscription-label">Plano atual</span><h2>{currentPlan.name}</h2><p>{currentPlan.description}</p></div><div className="subscription-status"><span className="status-pill">{statusLabel}</span><strong>{renewalDate}</strong><small>{daysRemaining !== null && daysRemaining > 0 ? `Faltam ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} para o vencimento` : daysRemaining !== null ? 'Regularize para continuar' : 'Vencimento ainda não definido'}</small></div></section>
    <section className="plan-note"><span>✓</span><div><strong>Pagamento simples e transparente</strong><p>Nesta fase, a assinatura é combinada manualmente com o administrador. Não há cobrança automática, cartão salvo ou renovação silenciosa.</p></div><a className="secondary-button plain-link" href={`mailto:contatojoseluizacma@gmail.com?subject=${subject}`}>Falar sobre meu plano</a></section>
    <section className="plans-section"><div className="section-heading-inline"><div><p className="eyebrow">Escolha seu ritmo</p><h2>Planos pensados para cada fase</h2></div><small>Valores de lançamento · ajuste antes da produção</small></div><div className="admin-plan-grid">{plans.map((plan) => <article className={`admin-plan-card ${plan.accent ? 'featured' : ''} ${plan.code === currentCode ? 'current' : ''}`} key={plan.code}>{plan.accent && <span className="plan-recommended">Mais escolhido</span>}<div className="admin-plan-card-head"><div><small>{plan.code === currentCode ? 'Seu plano' : 'Plano'}</small><h3>{plan.name}</h3></div>{plan.code === currentCode && <span className="current-mark">Ativo</span>}</div><strong className="plan-price">{plan.price}</strong><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><a className={plan.code === currentCode ? 'secondary-button plain-link' : 'primary-button plain-link'} href={`mailto:contatojoseluizacma@gmail.com?subject=${subject} - ${plan.name}`}>{plan.code === currentCode ? 'Plano atual' : `Quero o ${plan.name}`} <span>→</span></a></article>)}</div></section>
    <section className="panel plan-next-steps"><div><span className="panel-kicker">Próximos passos</span><h2>Deixe sua operação pronta para crescer</h2><p>Enquanto a cobrança continua manual, você já pode configurar a vitrine, publicar produtos e testar o fluxo completo com seus clientes.</p></div><div className="form-actions form-actions-start"><Link className="secondary-button plain-link" to="/admin/produtos">Organizar catálogo →</Link><Link className="secondary-button plain-link" to="/admin/primeiros-passos">Ver checklist →</Link></div></section>
  </>
}

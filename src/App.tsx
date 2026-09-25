import { useMemo, useState } from 'react'
import { isSupabaseConfigured } from './lib/supabase'

type View = 'overview' | 'content' | 'products' | 'clients' | 'whatsapp'

type Idea = {
  title: string
  format: 'Story' | 'Post'
  tag: string
  status: 'Aprovado' | 'Em revisão' | 'Rascunho'
  color: string
}

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visão geral', icon: '⌂' },
  { id: 'content', label: 'Conteúdo IA', icon: '✦' },
  { id: 'products', label: 'Produtos', icon: '▣' },
  { id: 'clients', label: 'Clientes', icon: '◌' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '◔' },
]

const ideas: Idea[] = [
  { title: 'Treino de pernas sem complicação', format: 'Story', tag: 'Engajamento', status: 'Aprovado', color: 'mint' },
  { title: '3 erros que travam seu resultado', format: 'Post', tag: 'Educação', status: 'Em revisão', color: 'lilac' },
  { title: 'Avaliação individual de outubro', format: 'Story', tag: 'Oferta', status: 'Rascunho', color: 'peach' },
]

const clients = [
  { initials: 'MA', name: 'Marina Alves', detail: 'Plano Hipertrofia · ativo', tone: 'rose' },
  { initials: 'RC', name: 'Rafael Costa', detail: 'Avaliação pendente', tone: 'blue' },
  { initials: 'LS', name: 'Lucas Santos', detail: 'Manual comprado hoje', tone: 'green' },
]

function App() {
  const [activeView, setActiveView] = useState<View>('overview')
  const [showIdeaComposer, setShowIdeaComposer] = useState(false)
  const [toast, setToast] = useState('')

  const activeLabel = useMemo(
    () => navItems.find((item) => item.id === activeView)?.label ?? 'Visão geral',
    [activeView],
  )

  function handleAction(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">A</div>
          <div>
            <strong>academia</strong>
            <span>para quem transforma</span>
          </div>
        </div>

        <div className="workspace-switcher">
          <div className="avatar avatar-orange">PC</div>
          <div className="workspace-copy">
            <strong>Personal Carlos</strong>
            <span>Workspace principal</span>
          </div>
          <span className="chevron">⌄</span>
        </div>

        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-heading">Workspace</p>
          {navItems.map((item) => (
            <button
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'content' && <span className="nav-count">3</span>}
            </button>
          ))}
          <p className="nav-heading nav-heading-spaced">Gestão</p>
          <button className="nav-item" onClick={() => handleAction('Agenda disponível na próxima etapa.') }>
            <span className="nav-icon">□</span>
            <span>Agenda</span>
          </button>
          <button className="nav-item" onClick={() => handleAction('Configurações disponíveis na próxima etapa.') }>
            <span className="nav-icon">⚙</span>
            <span>Configurações</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="help-card">
            <div className="help-icon">?</div>
            <strong>Precisa de ajuda?</strong>
            <span>Veja como deixar seu espaço pronto.</span>
            <button onClick={() => handleAction('Guia de primeiros passos em breve.')}>Abrir guia <span>→</span></button>
          </div>
          <div className="user-profile">
            <div className="avatar avatar-dark">CS</div>
            <div className="workspace-copy"><strong>Carlos Silva</strong><span>Administrador</span></div>
            <span className="more">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark">A</div><strong>academia</strong></div>
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activeLabel}</strong></div>
          <div className="topbar-actions">
            <span className={`connection-status ${isSupabaseConfigured ? 'online' : ''}`}>
              <i /> {isSupabaseConfigured ? 'Conectado' : 'Modo demonstração'}
            </span>
            <button className="icon-button" aria-label="Notificações" onClick={() => handleAction('Você está em dia!')}>
              ♧<span className="notification-dot" />
            </button>
            <button className="top-avatar" aria-label="Abrir perfil">CS</button>
          </div>
        </header>

        <div className="content-wrap">
          {activeView === 'overview' && (
            <Overview onCompose={() => setShowIdeaComposer(true)} onAction={handleAction} />
          )}
          {activeView === 'content' && <ContentView onCompose={() => setShowIdeaComposer(true)} onAction={handleAction} />}
          {activeView === 'products' && <ProductsView onAction={handleAction} />}
          {activeView === 'clients' && <ClientsView onAction={handleAction} />}
          {activeView === 'whatsapp' && <WhatsAppView onAction={handleAction} />}
        </div>
      </main>

      {showIdeaComposer && <IdeaComposer onClose={() => setShowIdeaComposer(false)} onGenerate={() => { setShowIdeaComposer(false); handleAction('Ideias geradas em modo demonstração.') }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function PageIntro({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-description">{description}</p></div>
      {action && <button className="primary-button" onClick={onAction}>{action}<span>＋</span></button>}
    </div>
  )
}

function Overview({ onCompose, onAction }: { onCompose: () => void; onAction: (message: string) => void }) {
  return <>
    <PageIntro eyebrow="Quarta-feira, 25 de setembro" title="Bom dia, Carlos" description="Aqui está o que está acontecendo no seu espaço hoje." />
    <div className="setup-banner">
      <div className="setup-illustration"><div className="sun" /><div className="setup-person">✦</div></div>
      <div className="setup-copy"><span className="setup-label">Seu espaço está quase pronto</span><strong>Complete seu perfil para começar a vender</strong><p>Adicione seus produtos e conecte o WhatsApp para transformar seguidores em clientes.</p><button onClick={() => onAction('Fluxo de configuração iniciado.')}>Continuar configuração <span>→</span></button></div>
      <div className="progress-ring"><strong>72%</strong><span>pronto</span></div>
    </div>
    <section className="metric-grid">
      <MetricCard label="Receita este mês" value="R$ 2.840" change="+18,4%" hint="vs. mês anterior" icon="↗" tone="orange" />
      <MetricCard label="Clientes ativos" value="128" change="+12" hint="nos últimos 30 dias" icon="◌" tone="blue" />
      <MetricCard label="Conteúdos aprovados" value="24" change="+8" hint="este mês" icon="✦" tone="purple" />
      <MetricCard label="Conversão da página" value="8,4%" change="+2,1%" hint="vs. mês anterior" icon="◎" tone="green" />
    </section>
    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span className="panel-kicker">Visão financeira</span><h2>Receita ao longo do tempo</h2></div><button className="select-button" onClick={() => onAction('Filtro alterado para últimos 30 dias.')}>Últimos 30 dias <span>⌄</span></button></div>
        <div className="chart-summary"><strong>R$ 8.426,00</strong><span className="positive-pill">↗ 24,8%</span><span>vs. período anterior</span></div>
        <div className="chart"><div className="chart-y"><span>3k</span><span>2k</span><span>1k</span><span>0</span></div><div className="chart-area"><div className="grid-line line-1" /><div className="grid-line line-2" /><div className="grid-line line-3" /><svg viewBox="0 0 620 190" role="img" aria-label="Gráfico de receita crescente"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ef7d47" stopOpacity=".22" /><stop offset="100%" stopColor="#ef7d47" stopOpacity="0" /></linearGradient></defs><path d="M0 158 C36 149 48 135 74 142 S112 146 142 121 S188 135 214 108 S257 117 284 96 S319 102 347 78 S386 90 410 67 S449 77 476 52 S527 65 547 37 S586 52 620 21 L620 190 L0 190 Z" fill="url(#chartFill)" /><path d="M0 158 C36 149 48 135 74 142 S112 146 142 121 S188 135 214 108 S257 117 284 96 S319 102 347 78 S386 90 410 67 S449 77 476 52 S527 65 547 37 S586 52 620 21" fill="none" stroke="#ed7b45" strokeWidth="3" strokeLinecap="round" /></svg><div className="chart-x"><span>01 set</span><span>08 set</span><span>15 set</span><span>22 set</span><span>30 set</span></div></div></div>
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">Acompanhe de perto</span><h2>Atividade recente</h2></div><button className="text-button" onClick={() => onAction('Mostrando todas as atividades.')}>Ver tudo</button></div><div className="activity-list"><Activity icon="↗" tone="orange" title="Nova compra realizada" description="Lucas Santos comprou Manual Hipertrofia" time="há 12 min" /><Activity icon="◌" tone="blue" title="Novo cliente" description="Marina Alves entrou no seu espaço" time="há 38 min" /><Activity icon="✦" tone="purple" title="Conteúdo aprovado" description="“Treino de pernas sem complicação”" time="há 1h" /><Activity icon="◷" tone="green" title="Avaliação agendada" description="Rafael Costa · amanhã, 08:00" time="há 2h" /></div></section>
    </div>
    <section className="panel content-panel"><div className="panel-heading"><div><span className="panel-kicker">Seu conteúdo</span><h2>Ideias prontas para publicar</h2></div><button className="text-button" onClick={() => onCompose()}>Ver conteúdos <span>→</span></button></div><div className="idea-grid">{ideas.map((idea) => <IdeaCard key={idea.title} idea={idea} onAction={onAction} />)}<button className="new-idea-card" onClick={onCompose}><span className="new-idea-icon">✦</span><strong>Gerar nova ideia</strong><span>Conte ao Academia o que você quer comunicar.</span><b>＋</b></button></div></section>
  </>
}

function MetricCard({ label, value, change, hint, icon, tone }: { label: string; value: string; change: string; hint: string; icon: string; tone: string }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><div className="metric-foot"><span className="positive-pill">{change}</span><span>{hint}</span></div></div> }
function Activity({ icon, tone, title, description, time }: { icon: string; tone: string; title: string; description: string; time: string }) { return <div className="activity-row"><div className={`activity-icon ${tone}`}>{icon}</div><div><strong>{title}</strong><p>{description}</p></div><span className="activity-time">{time}</span></div> }
function IdeaCard({ idea, onAction }: { idea: Idea; onAction: (message: string) => void }) { return <article className="idea-card"><div className={`idea-visual ${idea.color}`}><span>{idea.format}</span><strong>{idea.title.split(' ').slice(0, 3).join(' ')}</strong><small>academia<span>•</span>carlos</small><i>✦</i></div><div className="idea-card-body"><div className="idea-meta"><span className={`status status-${idea.status.toLowerCase().replace(' ', '-')}`}>{idea.status}</span><span>{idea.format}</span></div><strong>{idea.title}</strong><span className="idea-tag">{idea.tag}</span><button onClick={() => onAction(`Abrindo ${idea.title}.`)}>Abrir ideia <span>→</span></button></div></article> }

function ContentView({ onCompose, onAction }: { onCompose: () => void; onAction: (message: string) => void }) { return <><PageIntro eyebrow="Conteúdo que conversa" title="Suas ideias de conteúdo" description="Crie, revise e organize o que você quer dizer para o seu público." action="Gerar nova ideia" onAction={onCompose} /><div className="content-toolbar"><div className="filter-tabs"><button className="selected">Todas <span>12</span></button><button>Aprovadas <span>5</span></button><button>Em revisão <span>3</span></button><button>Rascunhos <span>4</span></button></div><button className="select-button">Mais recentes ⌄</button></div><div className="content-list">{ideas.concat([{ title: 'O que comer antes do treino?', format: 'Post', tag: 'Nutrição', status: 'Aprovado', color: 'blue' }]).map((idea) => <IdeaCard key={idea.title} idea={idea} onAction={onAction} />)}</div></> }
function ProductsView({ onAction }: { onAction: (message: string) => void }) { return <><PageIntro eyebrow="Sua vitrine" title="Produtos e serviços" description="Tenha tudo que você oferece organizado em um só lugar." action="Adicionar produto" onAction={() => onAction('Cadastro de produto disponível na próxima etapa.')} /><div className="product-summary"><div><span>Itens publicados</span><strong>6</strong></div><div><span>Vendas este mês</span><strong>34</strong></div><div><span>Receita pendente</span><strong>R$ 680</strong></div><div className="product-tip"><span>Pix copia e cola ativo</span><strong>Pronto para receber</strong><button onClick={() => onAction('Configuração do Pix aberta.')}>Configurar →</button></div></div><div className="product-grid"><ProductCard type="DIGITAL" title="Manual Hipertrofia" description="Plano completo para evoluir com consistência." price="R$ 49,90" sold="18 vendas" tone="orange" /><ProductCard type="SERVIÇO" title="Avaliação individual" description="Atendimento personalizado presencial ou online." price="A partir de R$ 120" sold="9 agendamentos" tone="blue" /><ProductCard type="DIGITAL" title="Treino em casa" description="Foco, praticidade e resultado sem academia." price="R$ 29,90" sold="7 vendas" tone="purple" /></div></> }
function ProductCard({ type, title, description, price, sold, tone }: { type: string; title: string; description: string; price: string; sold: string; tone: string }) { return <article className="product-card"><div className={`product-cover ${tone}`}><span>{type}</span><strong>{title.split(' ').map((word) => <span key={word}>{word}</span>)}</strong><i>✦</i></div><div className="product-body"><strong>{title}</strong><p>{description}</p><div><b>{price}</b><span>{sold}</span></div></div></article> }
function ClientsView({ onAction }: { onAction: (message: string) => void }) { return <><PageIntro eyebrow="Relacionamento" title="Seus clientes" description="Acompanhe quem escolheu treinar e crescer com você." action="Adicionar cliente" onAction={() => onAction('Convite de cliente disponível na próxima etapa.')} /><div className="client-stat-row"><MetricCard label="Total de clientes" value="128" change="+12" hint="este mês" icon="◌" tone="blue" /><MetricCard label="Ativos agora" value="96" change="75%" hint="da sua base" icon="●" tone="green" /><MetricCard label="Avaliações pendentes" value="8" change="atenção" hint="para esta semana" icon="!" tone="orange" /></div><section className="panel table-panel"><div className="panel-heading"><div><span className="panel-kicker">Base de clientes</span><h2>Últimas pessoas adicionadas</h2></div><button className="select-button">Filtrar ⌄</button></div><div className="client-table">{clients.map((client) => <div className="client-row" key={client.name}><div className={`avatar avatar-${client.tone}`}>{client.initials}</div><div><strong>{client.name}</strong><span>{client.detail}</span></div><button onClick={() => onAction(`Abrindo perfil de ${client.name}.`)}>Ver perfil <span>→</span></button></div>)}</div></section></> }
function WhatsAppView({ onAction }: { onAction: (message: string) => void }) { return <><PageIntro eyebrow="Comunicação direta" title="WhatsApp" description="Leve suas ideias e ofertas até as pessoas certas, com consentimento." action="Criar campanha" onAction={() => onAction('Criador de campanha disponível na próxima etapa.')} /><div className="whatsapp-hero"><div className="whatsapp-symbol">◔</div><div><span className="setup-label">Conexão necessária</span><h2>Conecte o WhatsApp Business</h2><p>Envie ideias de treino, novidades e ofertas para sua base com uma comunicação que parece sua.</p><button className="primary-button" onClick={() => onAction('Conexão WhatsApp disponível na próxima etapa.')}>Conectar número <span>→</span></button></div><div className="whatsapp-points"><span>✓ Opt-in e opt-out</span><span>✓ Histórico de mensagens</span><span>✓ Templates aprovados</span></div></div><div className="campaign-preview"><div><span className="panel-kicker">Próximo passo</span><h2>Campanhas aprovadas</h2><p>Suas mensagens aparecerão aqui antes do envio.</p></div><div className="empty-state"><span>✦</span><strong>Nenhuma campanha ainda</strong><small>Comece gerando uma ideia de conteúdo.</small></div></div></> }

function IdeaComposer({ onClose, onGenerate }: { onClose: () => void; onGenerate: () => void }) { const [format, setFormat] = useState('Story'); return <div className="modal-backdrop" onMouseDown={onClose}><div className="composer" onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={onClose}>×</button><div className="composer-header"><div className="composer-spark">✦</div><div><span className="eyebrow">Assistente Academia</span><h2>O que você quer comunicar?</h2><p>Descreva uma intenção simples e transforme em conteúdo pronto para revisar.</p></div></div><label>Objetivo da ideia<textarea placeholder="Ex.: Quero incentivar meus alunos a não pularem o treino de pernas." /></label><label>Formato<div className="format-options">{['Story', 'Post', 'Mensagem'].map((option) => <button className={format === option ? 'chosen' : ''} key={option} onClick={() => setFormat(option)}>{option}<span>{option === 'Story' ? 'vertical e direto' : option === 'Post' ? 'educativo e salvável' : 'para WhatsApp'}</span></button>)}</div></label><div className="composer-foot"><span>Você revisa antes de publicar ou enviar.</span><button className="primary-button" onClick={onGenerate}>Gerar ideia <span>✦</span></button></div></div></div> }

export default App

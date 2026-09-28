import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function MarketingFrame({ children }: { children: ReactNode }) {
  return <div className="landing-shell">
    <header className="landing-header">
      <Link to="/" className="store-logo plain-link" aria-label="Impulso, início"><span className="brand-mark">I</span><strong>impulso</strong></Link>
      <nav aria-label="Navegação principal">
        <a href="/#funcionalidades">Recursos</a>
        <a href="/#planos">Planos</a>
        <a href="/#demonstracao">Demonstração</a>
        <Link to="/admin/login">Entrar</Link>
        <Link className="primary-button" to="/admin/login">Criar meu espaço <span aria-hidden="true">→</span></Link>
      </nav>
    </header>
    <main>{children}</main>
    <footer className="store-footer"><span>impulso · conteúdo e vendas com a sua marca</span><span>Pagamento e atendimento direto com cada profissional.</span></footer>
  </div>
}

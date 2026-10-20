import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[impulso] erro inesperado na interface', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <main className="app-fatal-error" role="alert"><div className="app-fatal-card"><span className="eyebrow">Impulso · recuperação</span><h1>Algo saiu do lugar</h1><p>Não foi possível concluir esta tela. Seus dados salvos no servidor continuam protegidos.</p><div className="form-actions form-actions-start"><button type="button" className="primary-button" onClick={() => window.location.reload()}>Tentar novamente <span>↻</span></button><a className="secondary-button plain-link" href="/">Voltar ao início</a></div></div></main>
  }
}

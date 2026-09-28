import { useEffect, useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

type Turn = { role: 'user' | 'assistant'; text: string }

export function AdminAssistant() {
  const { workspace } = useAuth()
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setTurns([]); setQuestion(''); setError('') }, [workspace?.id])

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!supabase || !workspace || busy || text.length < 8 || text.length > 500) return
    setBusy(true); setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('ask-niche-assistant', {
        body: { workspaceId: workspace.id, action: 'chat', text, history: turns.slice(-4) },
      })
      if (invokeError) {
        if (invokeError instanceof FunctionsHttpError && invokeError.context.status === 429) setError('Limite diário de IA atingido. Tente novamente amanhã.')
        else if (invokeError instanceof FunctionsHttpError && invokeError.context.status === 400) setError('Salve seu perfil de conteúdo e confira a pergunta.')
        else setError('Não foi possível consultar o assistente agora.')
        return
      }
      if (typeof data?.answer !== 'string') throw new Error('Resposta inválida')
      setTurns((previous) => [...previous, { role: 'user', text }, { role: 'assistant', text: data.answer }].slice(-10) as Turn[])
      setQuestion('')
    } catch { setError('A conversa foi interrompida. Tente novamente.') }
    finally { setBusy(false) }
  }

  return <section className="panel editor-panel" aria-labelledby="niche-assistant-title">
    <div className="panel-heading"><div><span className="panel-kicker">Ajuda contextual</span><h2 id="niche-assistant-title">Assistente do seu nicho</h2></div></div>
    <p className="field-help">Pergunte sobre conteúdo e comunicação do seu negócio. O assistente usa o perfil salvo, não consulta tendências ao vivo e não publica nem envia nada. Conversa temporária nesta página; até 20 tentativas de IA por dia, compartilhadas com a geração de ideias.</p>
    {turns.length > 0 && <div className="simple-list" aria-live="polite">{turns.map((turn, index) => <div className="idea-list-row" key={index}><div><strong>{turn.role === 'user' ? 'Você' : 'Assistente'}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{turn.text}</p></div></div>)}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="form-grid" onSubmit={(event) => void ask(event)}><label>Sua pergunta<textarea rows={3} maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ex.: Como explicar meu serviço para iniciantes sem prometer resultados?" /></label><p className="field-help">{question.trim().length}/500 caracteres · mínimo de 8</p><div className="form-actions form-actions-start"><button className="primary-button" disabled={busy || question.trim().length < 8}>{busy ? 'Pensando…' : 'Perguntar'} <span>→</span></button>{turns.length > 0 && <button type="button" className="secondary-button" onClick={() => setTurns([])}>Limpar conversa</button>}</div></form>
  </section>
}

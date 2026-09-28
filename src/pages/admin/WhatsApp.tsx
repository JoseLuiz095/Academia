import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { whatsappLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { ContentIdea } from '../../types'

export function AdminWhatsApp() {
  const { workspace } = useAuth()
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [selected, setSelected] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !workspace) { setLoading(false); return }
    let active = true
    setLoading(true)
    setIdeas([])
    setSelected('')
    setError('')
    void supabase.from('content_ideas').select('id,workspace_id,format,title,hook,body,cta,status,source,created_at').eq('workspace_id', workspace.id).eq('status', 'approved').order('created_at', { ascending: false }).then(({ data, error: loadError }) => {
      if (!active) return
      setLoading(false)
      if (loadError) setError('Não foi possível carregar as ideias aprovadas. Atualize a página e tente novamente.')
      else setIdeas((data ?? []) as ContentIdea[])
    })
    return () => { active = false }
  }, [workspace?.id])

  const idea = ideas.find((item) => item.id === selected)
  const text = idea ? `${idea.title}\n\n${idea.body || ''}${idea.cta ? `\n\n${idea.cta}` : ''}\n\n${workspace?.name || ''}` : ''
  const digits = testPhone.replace(/\D/g, '')
  const validPhone = /^55\d{10,11}$/.test(digits)
  const link = idea && validPhone ? whatsappLink(digits, text) : null

  async function copyMessage() {
    if (!idea) return
    try { await navigator.clipboard.writeText(text); setMessage('Mensagem copiada. Revise antes de colar e enviar.') }
    catch { setMessage('Não foi possível copiar automaticamente. Selecione o texto da prévia e copie manualmente.') }
  }

  return <>
    <div className="page-intro"><div><p className="eyebrow">Comunicação direta</p><h1>WhatsApp</h1><p className="intro-description">Prepare e confira uma mensagem aprovada. O envio depende de você no WhatsApp.</p></div></div>
    <div className="whatsapp-hero"><div className="whatsapp-symbol">◔</div><div><span className="setup-label">Atendimento manual</span><h2>Conversa pelo seu número</h2><p>Cadastre seu número nas configurações para que clientes abram uma conversa pela vitrine. Nesta página, você pode abrir uma mensagem de teste preenchida para um contato escolhido. Abrir o WhatsApp não envia a mensagem.</p><Link to="/admin/configuracoes" className="text-button plain-link">Configurar número da vitrine →</Link></div><div className="whatsapp-points"><span>1. Revise e aprove a ideia</span><span>2. Confira a prévia e o número</span><span>3. Envie manualmente, se quiser</span></div></div>
    <section className="panel editor-panel"><div className="panel-heading"><div><span className="panel-kicker">Prévia individual</span><h2>Testar conteúdo aprovado</h2></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="empty-copy">Carregando ideias aprovadas…</p> : !error && ideas.length === 0 ? <p className="empty-copy">Ainda não há ideias aprovadas. <Link to="/admin/conteudo">Crie e revise uma ideia</Link> antes do teste.</p> : null}
      <div className="form-grid"><label>Ideia aprovada<select value={selected} disabled={loading || !!error || ideas.length === 0} onChange={(event) => { setSelected(event.target.value); setMessage('') }}><option value="">Selecione uma ideia</option>{ideas.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Número de teste com DDI 55 e DDD<input type="tel" inputMode="tel" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="5511999999999" /></label><p className="field-help">Digite 55 + DDD + número. Use um contato próprio ou autorizado. Este teste abre uma conversa em outra aba.</p>{testPhone && !validPhone && <p className="form-error" role="alert">Confira o número: use 55, DDD e 10 ou 11 dígitos nacionais.</p>}{idea && <label>Prévia da mensagem<textarea rows={7} readOnly value={text} onFocus={(event) => event.target.select()} /></label>}{message && <p className="form-success" role="status">{message}</p>}<div className="form-actions form-actions-start"><button type="button" className="secondary-button" disabled={!idea} onClick={() => void copyMessage()}>Copiar mensagem</button>{link ? <a className="primary-button plain-link" href={link} target="_blank" rel="noopener noreferrer">Abrir prévia no WhatsApp <span>↗</span></a> : <button type="button" className="primary-button" disabled>Selecione ideia e número válido</button>}</div><p className="field-help">Depois de abrir, confira destinatário e texto no WhatsApp. Só o botão de envio do próprio WhatsApp envia a mensagem. Não há disparo automático neste painel.</p></div>
    </section>
  </>
}

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
  useEffect(() => {
    if (!supabase || !workspace) return
    let active = true
    void supabase.from('content_ideas').select('id,workspace_id,format,title,hook,body,cta,status,source,created_at').eq('workspace_id', workspace.id).eq('status', 'approved').order('created_at', { ascending: false }).then(({ data }) => { if (active) setIdeas((data ?? []) as ContentIdea[]) })
    return () => { active = false }
  }, [workspace?.id])
  const idea = ideas.find((item) => item.id === selected)
  const text = idea ? `${idea.title}\n\n${idea.body || ''}${idea.cta ? `\n\n${idea.cta}` : ''}\n\n${workspace?.name || ''}` : ''
  const link = whatsappLink(testPhone, text)
  return <><div className="page-intro"><div><p className="eyebrow">Comunicação direta</p><h1>WhatsApp</h1><p className="intro-description">Teste uma mensagem aprovada antes de configurar disparos pela API oficial.</p></div></div><div className="whatsapp-hero"><div className="whatsapp-symbol">◔</div><div><span className="setup-label">Etapa inicial</span><h2>Atendimento direto com seu número</h2><p>Na vitrine, o cliente abre uma conversa com seu WhatsApp Business para combinar o pedido. Aqui você pode testar uma ideia aprovada em um número de sua escolha.</p><Link to="/admin/configuracoes" className="text-button plain-link">Configurar número →</Link></div><div className="whatsapp-points"><span>✓ Revisão antes do envio</span><span>✓ Sem disparo automático</span><span>✓ API oficial na próxima etapa</span></div></div><section className="panel editor-panel"><div className="panel-heading"><div><span className="panel-kicker">Prévia individual</span><h2>Testar conteúdo aprovado</h2></div></div><div className="form-grid"><label>Ideia aprovada<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Selecione uma ideia</option>{ideas.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Número de teste com DDI e DDD<input type="tel" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="5511999999999" /></label>{idea && <label>Mensagem<textarea rows={7} readOnly value={text} /></label>}{message && <p className="form-success" role="status">{message}</p>}<div className="form-actions"><button className="secondary-button" disabled={!idea} onClick={() => void navigator.clipboard.writeText(text).then(() => setMessage('Mensagem copiada.')).catch(() => setMessage('Não foi possível copiar. Selecione o texto acima.'))}>Copiar mensagem</button>{link ? <a className="primary-button plain-link" href={link} target="_blank" rel="noreferrer">Abrir WhatsApp <span>↗</span></a> : <button className="primary-button" disabled>Informe um número válido</button>}</div></div></section></>
}

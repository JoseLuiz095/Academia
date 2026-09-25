import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ContentIdea, ContentProfile } from '../../types'

const emptyProfile: Omit<ContentProfile, 'workspace_id'> = {
  tone: 'direto, acolhedor e motivador', audience: '', goals: '', guidelines: '', forbidden_topics: '',
  preferred_equipment: '', training_methods: '', weekly_frequency: '',
}

export function AdminContent() {
  const { workspace, user } = useAuth()
  const [profile, setProfile] = useState(emptyProfile)
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [brief, setBrief] = useState('')
  const [format, setFormat] = useState<ContentIdea['format']>('story')
  const [preparedPrompt, setPreparedPrompt] = useState('')
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaBody, setIdeaBody] = useState('')
  const [editing, setEditing] = useState<ContentIdea | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    if (!supabase || !workspace) return
    const [profileResult, ideasResult] = await Promise.all([
      supabase.from('content_profiles').select('workspace_id,tone,audience,goals,guidelines,forbidden_topics,preferred_equipment,training_methods,weekly_frequency').eq('workspace_id', workspace.id).maybeSingle(),
      supabase.from('content_ideas').select('id,workspace_id,format,title,hook,body,cta,status,source,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
    ])
    if (profileResult.data) setProfile(profileResult.data as ContentProfile)
    setIdeas((ideasResult.data ?? []) as ContentIdea[])
    setError(profileResult.error?.message ?? ideasResult.error?.message ?? '')
  }
  useEffect(() => { void load() }, [workspace?.id])

  const prompt = useMemo(() => [
    'Você é um assistente de conteúdo para um profissional. Crie UMA ideia de conteúdo original, clara e adequada ao público descrito.',
    `Formato: ${format}.`, `Objetivo específico: ${brief.trim()}.`,
    `Público: ${profile.audience || 'não informado'}.`, `Tom de voz: ${profile.tone}.`,
    `Objetivos gerais: ${profile.goals || 'não informados'}.`,
    `Equipamentos preferidos: ${profile.preferred_equipment || 'não informados'}.`,
    `Método/tipo de treino: ${profile.training_methods || 'não informado'}.`,
    `Frequência semanal típica: ${profile.weekly_frequency || 'não informada'}.`,
    `Diretrizes adicionais: ${profile.guidelines || 'nenhuma'}.`,
    `Temas proibidos: ${profile.forbidden_topics || 'nenhum informado'}.`,
    'Responda em português do Brasil com: título, gancho, roteiro/legenda e CTA. Evite promessas de resultado, diagnóstico ou orientação clínica. A ideia será revisada pelo profissional antes de ser publicada ou enviada.',
  ].join('\n'), [brief, format, profile])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace) return
    setBusy(true); setError(''); setMessage('')
    const { error: saveError } = await supabase.from('content_profiles').upsert({ ...profile, workspace_id: workspace.id, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' })
    setBusy(false)
    if (saveError) setError(saveError.message)
    else setMessage('Perfil de conteúdo salvo.')
  }

  async function saveIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace) return
    setBusy(true); setError(''); setMessage('')
    const { error: saveError } = await supabase.from('content_ideas').insert({ workspace_id: workspace.id, format, title: ideaTitle.trim(), body: ideaBody.trim(), status: 'draft', source: 'manual', created_by: user?.id })
    setBusy(false)
    if (saveError) { setError(saveError.message); return }
    setIdeaTitle(''); setIdeaBody(''); setMessage('Ideia salva como rascunho.'); await load()
  }

  async function approve(idea: ContentIdea) {
    if (!supabase || !workspace) return
    const { error: updateError } = await supabase.from('content_ideas').update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', idea.id).eq('workspace_id', workspace.id)
    if (updateError) setError(updateError.message)
    else { setMessage('Ideia aprovada.'); await load() }
  }

  async function saveEdited(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace || !editing) return
    if (!editing.title.trim() || !editing.body?.trim()) { setError('Título e roteiro são obrigatórios.'); return }
    setBusy(true); setError(''); setMessage('')
    const { error: updateError } = await supabase.from('content_ideas').update({
      title: editing.title.trim(), hook: editing.hook?.trim() || null,
      body: editing.body.trim(), cta: editing.cta?.trim() || null,
      status: editing.source === 'ai' ? 'review' : 'draft', updated_at: new Date().toISOString(),
    }).eq('id', editing.id).eq('workspace_id', workspace.id)
    setBusy(false)
    if (updateError) { setError(updateError.message); return }
    setEditing(null); setMessage('Ideia revisada e salva.'); await load()
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setMessage('Prompt copiado. Cole no Gemini e revise o resultado antes de usar.') }
    catch { setPreparedPrompt(prompt); setMessage('Selecione e copie o prompt abaixo.') }
  }

  async function generateWithGemini() {
    if (!supabase || !workspace || brief.trim().length < 8) return
    setBusy(true); setError(''); setMessage('')
    const { error: invokeError } = await supabase.functions.invoke('generate-content-idea', { body: { workspaceId: workspace.id, brief: brief.trim(), format } })
    setBusy(false)
    if (invokeError) {
      let detail = invokeError.message
      try {
        const context = (invokeError as Error & { context?: Response }).context
        if (context) detail = (await context.json()).error || detail
      } catch { /* Mantém a mensagem original. */ }
      setError(detail)
      return
    }
    setMessage('Ideia gerada e salva para revisão. Aprove somente depois de conferir o texto.')
    await load()
  }

  return <><div className="page-intro"><div><p className="eyebrow">Sua voz</p><h1>Conteúdo IA</h1><p className="intro-description">Configure o contexto do seu público, prepare um prompt e revise cada ideia.</p></div></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <section className="panel editor-panel"><div className="panel-heading"><div><span className="panel-kicker">Base para a IA</span><h2>Como você se comunica</h2></div></div><form className="form-grid" onSubmit={(event) => void saveProfile(event)}><div className="form-row"><label>Público-alvo<textarea rows={2} value={profile.audience ?? ''} onChange={(event) => setProfile({ ...profile, audience: event.target.value })} placeholder="Ex.: Iniciantes de 25 a 45 anos com pouco tempo" /></label><label>Tom de voz<input value={profile.tone} onChange={(event) => setProfile({ ...profile, tone: event.target.value })} placeholder="Próximo, técnico e simples" /></label></div><div className="form-row"><label>Objetivos de conteúdo<input value={profile.goals ?? ''} onChange={(event) => setProfile({ ...profile, goals: event.target.value })} placeholder="Educar, engajar e apresentar avaliações" /></label><label>Equipamentos preferidos<input value={profile.preferred_equipment ?? ''} onChange={(event) => setProfile({ ...profile, preferred_equipment: event.target.value })} placeholder="Halteres, leg press, elásticos" /></label></div><div className="form-row"><label>Método ou tipo de treino<input value={profile.training_methods ?? ''} onChange={(event) => setProfile({ ...profile, training_methods: event.target.value })} placeholder="Musculação para iniciantes" /></label><label>Frequência semanal típica<input value={profile.weekly_frequency ?? ''} onChange={(event) => setProfile({ ...profile, weekly_frequency: event.target.value })} placeholder="3 a 4 vezes por semana" /></label></div><label>Instruções adicionais<textarea rows={2} value={profile.guidelines ?? ''} onChange={(event) => setProfile({ ...profile, guidelines: event.target.value })} placeholder="Termos que você usa, abordagem, exemplos preferidos" /></label><label>Temas a evitar<textarea rows={2} value={profile.forbidden_topics ?? ''} onChange={(event) => setProfile({ ...profile, forbidden_topics: event.target.value })} placeholder="Promessas de resultado, temas clínicos etc." /></label><button disabled={busy} className="primary-button">{busy ? 'Salvando…' : 'Salvar perfil'} <span>→</span></button></form></section>
    <div className="dashboard-grid content-workflow"><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Briefing</span><h2>Gerar com Gemini</h2></div></div><p className="empty-copy">O Gemini usa as configurações acima e salva o resultado para sua revisão. Limite inicial: 20 ideias por dia por espaço.</p><div className="form-grid"><label>O que você quer comunicar?<textarea rows={4} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Ex.: Incentivar meus alunos a manterem a rotina de treino na semana" /></label><label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as ContentIdea['format'])}><option value="story">Story</option><option value="post">Post</option><option value="message">Mensagem</option></select></label><div className="form-actions form-actions-start"><button className="primary-button" disabled={busy || brief.trim().length < 8} onClick={() => void generateWithGemini()}>{busy ? 'Gerando…' : 'Gerar ideia'} <span>✦</span></button><button className="secondary-button" disabled={!brief.trim()} onClick={() => { setPreparedPrompt(prompt); void copyPrompt() }}>Copiar prompt</button></div>{preparedPrompt && <label>Prompt preparado<textarea rows={9} readOnly value={preparedPrompt} /></label>}</div></section><section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Revisão humana</span><h2>Salvar uma ideia</h2></div></div><p className="empty-copy">Cole aqui a ideia revisada, criada por você ou com ajuda do Gemini.</p><form className="form-grid" onSubmit={(event) => void saveIdea(event)}><label>Título<input required value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Ex.: 3 maneiras de manter a rotina" /></label><label>Roteiro ou legenda<textarea required rows={7} value={ideaBody} onChange={(event) => setIdeaBody(event.target.value)} /></label><button disabled={busy} className="primary-button">Salvar rascunho <span>＋</span></button></form></section></div>
    <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Biblioteca</span><h2>Ideias salvas</h2></div><span>{ideas.length} ideias</span></div>{ideas.length ? <div className="simple-list">{ideas.map((idea) => <div key={idea.id} className="idea-list-row">{editing?.id === idea.id ? <form className="form-grid idea-edit-form" onSubmit={(event) => void saveEdited(event)}><label>Título<input required value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label>Gancho<input value={editing.hook ?? ''} onChange={(event) => setEditing({ ...editing, hook: event.target.value })} /></label><label>Roteiro ou legenda<textarea required rows={5} value={editing.body ?? ''} onChange={(event) => setEditing({ ...editing, body: event.target.value })} /></label><label>Chamada para ação<input value={editing.cta ?? ''} onChange={(event) => setEditing({ ...editing, cta: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-button" disabled={busy}>Salvar revisão <span>→</span></button></div></form> : <><div><strong>{idea.title}</strong><small>{idea.format} · {idea.status === 'approved' ? 'Aprovada' : idea.status === 'review' ? 'Em revisão' : 'Rascunho'} · {idea.source === 'ai' ? 'IA' : 'Manual'}</small>{idea.hook && <p><b>Gancho:</b> {idea.hook}</p>}<p>{idea.body}</p>{idea.cta && <p><b>CTA:</b> {idea.cta}</p>}</div>{idea.status !== 'approved' && <div className="idea-actions"><button className="secondary-button" onClick={() => setEditing({ ...idea })}>Editar</button><button className="secondary-button" onClick={() => void approve(idea)}>Aprovar</button></div>}</>}</div>)}</div> : <p className="empty-copy">Nenhuma ideia salva ainda.</p>}</section>
  </>
}

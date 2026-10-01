import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { useAuth } from '../../contexts/AuthContext'
import { readFunctionError } from '../../lib/functionErrors'
import { supabase } from '../../lib/supabase'
import type { ContentIdea, ContentProfile } from '../../types'
import { AdminAssistant } from './Assistant'

type Reminder = { id: string; workspace_id: string; title: string; body: string; scheduled_for: string; status: string; channel: string; created_at: string }
type IdeaWithSources = ContentIdea & { trend_sources?: unknown; trend_checked_at?: string | null }

function sourcesFor(idea: IdeaWithSources): { title: string; url: string }[] {
  if (!Array.isArray(idea.trend_sources)) return []
  return idea.trend_sources.filter((source): source is { title: string; url: string } => {
    if (!source || typeof source !== 'object' || typeof source.title !== 'string' || typeof source.url !== 'string') return false
    try { return source.title.trim().length > 0 && new URL(source.url).protocol === 'https:' }
    catch { return false }
  })
}

function IdeaSources({ idea }: { idea: IdeaWithSources }) {
  const sources = sourcesFor(idea)
  if (!sources.length) return idea.trend_checked_at ? <p className="field-help">Nenhuma fonte verificável foi registrada. Não apresente esta ideia como tendência atual.</p> : null
  const checkedAt = idea.trend_checked_at ? new Date(idea.trend_checked_at) : null
  return <div><p className="field-help">Fontes registradas{checkedAt && Number.isFinite(checkedAt.getTime()) ? ` · pesquisa em ${checkedAt.toLocaleString('pt-BR')}` : ''}. Confira se sustentam as afirmações do texto:</p><ul>{sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></div>
}

const emptyProfile: Omit<ContentProfile, 'workspace_id'> = {
  tone: 'direto, acolhedor e motivador', audience: '', goals: '', guidelines: '', forbidden_topics: '',
  preferred_equipment: '', training_methods: '', weekly_frequency: '',
}

export function AdminContent() {
  const { workspace, user } = useAuth()
  const [profile, setProfile] = useState(emptyProfile)
  const [profileSaved, setProfileSaved] = useState(false)
  const [savedProfile, setSavedProfile] = useState<typeof emptyProfile | null>(null)
  const [ideas, setIdeas] = useState<IdeaWithSources[]>([])
  const [brief, setBrief] = useState('')
  const [trendContext, setTrendContext] = useState('')
  const [trendMode, setTrendMode] = useState(false)
  const [format, setFormat] = useState<ContentIdea['format']>('story')
  const [preparedPrompt, setPreparedPrompt] = useState('')
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaBody, setIdeaBody] = useState('')
  const [editing, setEditing] = useState<ContentIdea | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [reminderIdeaId, setReminderIdeaId] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [reminderChannel, setReminderChannel] = useState<'internal' | 'whatsapp'>('internal')
  const [reminderError, setReminderError] = useState('')
  const [libraryFilter, setLibraryFilter] = useState<'all' | ContentIdea['status']>('all')
  const [librarySearch, setLibrarySearch] = useState('')

  async function load() {
    if (!supabase || !workspace) return
    const [profileResult, ideasResult, remindersResult] = await Promise.all([
      supabase.from('content_profiles').select('workspace_id,tone,audience,goals,guidelines,forbidden_topics,preferred_equipment,training_methods,weekly_frequency').eq('workspace_id', workspace.id).maybeSingle(),
      supabase.from('content_ideas').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('content_reminders').select('id,workspace_id,title,body,scheduled_for,status,channel,created_at').eq('workspace_id', workspace.id).order('scheduled_for', { ascending: true }),
    ])
    setProfile(profileResult.data ? profileResult.data as ContentProfile : emptyProfile)
    setSavedProfile(profileResult.data ? profileResult.data as ContentProfile : null)
    setProfileSaved(Boolean(profileResult.data))
    setIdeas((ideasResult.data ?? []) as IdeaWithSources[])
    setReminders((remindersResult.data ?? []) as Reminder[])
    if (profileResult.error || ideasResult.error) setError('Não foi possível carregar o perfil ou as ideias. Atualize a página e tente novamente.')
    setReminderError(remindersResult.error ? 'Os lembretes ainda não estão disponíveis neste espaço. A tabela e sua política de acesso precisam ser criadas.' : '')
  }
  useEffect(() => { void load() }, [workspace?.id])
  const profileReady = profileSaved && JSON.stringify(profile) === JSON.stringify(savedProfile)
  const trendBrief = trendContext.trim() ? `${brief.trim()}\nContexto observado pelo criador (não verificado): ${trendContext.trim()}` : brief.trim()
  const filteredIdeas = useMemo(() => {
    const query = librarySearch.trim().toLocaleLowerCase('pt-BR')
    return ideas.filter((idea) => {
      const matchesStatus = libraryFilter === 'all' || idea.status === libraryFilter
      const haystack = `${idea.title} ${idea.hook ?? ''} ${idea.body ?? ''} ${idea.cta ?? ''}`.toLocaleLowerCase('pt-BR')
      return matchesStatus && (!query || haystack.includes(query))
    })
  }, [ideas, libraryFilter, librarySearch])

  const quickBriefs = [
    { label: 'Dica prática', brief: 'Ensinar uma dica prática que o meu público consiga aplicar hoje', format: 'story' as const },
    { label: 'Bastidores', brief: 'Mostrar bastidores do meu trabalho e criar proximidade com o público', format: 'story' as const },
    { label: 'Mito ou verdade', brief: 'Desmistificar uma dúvida frequente do meu público com clareza', format: 'post' as const },
    { label: 'Oferta com contexto', brief: 'Apresentar um produto ou serviço sem parecer uma venda agressiva', format: 'post' as const },
  ]

  const prompt = useMemo(() => [
    `Você é um assistente de conteúdo para um criador do nicho ${workspace?.niche || 'informado no perfil'}. Crie UMA ideia original, clara e adequada ao público descrito. Recuse pedidos fora desse nicho.`,
    `Formato: ${format}.`, `Objetivo específico: ${brief.trim()}.`,
    `Tema ou sinal informado pelo lojista, ainda não verificado: ${trendContext.trim() || 'nenhum'}. Não afirme tendência atual sem fonte conectada.`,
    `Público: ${profile.audience || 'não informado'}.`, `Tom de voz: ${profile.tone}.`,
    `Objetivos gerais: ${profile.goals || 'não informados'}.`,
    `Equipamentos, se o nicho for atividade física: ${profile.preferred_equipment || 'não informados'}.`,
    `Método/tipo de treino, se aplicável: ${profile.training_methods || 'não informado'}.`,
    `Frequência semanal típica, se aplicável: ${profile.weekly_frequency || 'não informada'}.`,
    `Diretrizes adicionais: ${profile.guidelines || 'nenhuma'}.`,
    `Temas proibidos: ${profile.forbidden_topics || 'nenhum informado'}.`,
    'Para story, detalhe 3 a 5 telas com visual, texto e interação. Para post, detalhe formato visual, estrutura, legenda e acessibilidade. Responda com título, gancho, roteiro/legenda e CTA. Evite promessas de resultado, diagnóstico ou orientação clínica. A ideia será revisada pelo profissional antes de ser publicada ou enviada.',
  ].join('\n'), [brief, format, profile, trendContext, workspace?.niche])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace) return
    setBusy(true); setError(''); setMessage('')
    const { error: saveError } = await supabase.from('content_profiles').upsert({ ...profile, workspace_id: workspace.id, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' })
    setBusy(false)
    if (saveError) setError('Não foi possível salvar o perfil. Confira sua conexão e tente novamente.')
    else { setProfileSaved(true); setSavedProfile(profile); setMessage('Perfil salvo. A próxima ideia gerada usará essas informações.') }
  }

  async function saveIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace) return
    setBusy(true); setError(''); setMessage('')
    const { error: saveError } = await supabase.from('content_ideas').insert({ workspace_id: workspace.id, format, title: ideaTitle.trim(), body: ideaBody.trim(), status: 'draft', source: 'manual', created_by: user?.id })
    setBusy(false)
    if (saveError) { setError('Não foi possível salvar o rascunho. Tente novamente.'); return }
    setIdeaTitle(''); setIdeaBody(''); setMessage('Ideia salva como rascunho.'); await load()
  }

  async function saveEdited(approve = false) {
    if (!supabase || !workspace || !editing) return
    if (!editing.title.trim() || !editing.body?.trim()) { setError('Título e roteiro são obrigatórios.'); return }
    if (approve && !reviewed) { setError('Confirme a revisão do texto antes de aprovar.'); return }
    setBusy(true); setError(''); setMessage('')
    const { error: updateError } = await supabase.from('content_ideas').update({
      title: editing.title.trim(), hook: editing.hook?.trim() || null,
      body: editing.body.trim(), cta: editing.cta?.trim() || null,
      status: approve ? 'approved' : editing.source === 'ai' ? 'review' : 'draft',
      approved_at: approve ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }).eq('id', editing.id).eq('workspace_id', workspace.id)
    setBusy(false)
    if (updateError) { setError('Não foi possível salvar a ideia. Tente novamente.'); return }
    setEditing(null); setReviewed(false); setMessage(approve ? 'Ideia aprovada. Ela está disponível para teste manual no WhatsApp; nenhum envio foi feito.' : 'Revisão salva. A ideia ainda precisa de aprovação explícita.'); await load()
  }

  async function copyPrompt() {
    setPreparedPrompt(prompt)
    try { await navigator.clipboard.writeText(prompt); setMessage('Prompt copiado. Cole em uma ferramenta de IA e revise o resultado antes de salvar.') }
    catch { setPreparedPrompt(prompt); setMessage('Selecione e copie o prompt abaixo.') }
  }

  async function copyIdea(idea: ContentIdea) {
    const text = [idea.title, idea.hook && `Gancho: ${idea.hook}`, idea.body, idea.cta && `CTA: ${idea.cta}`].filter(Boolean).join('\n\n')
    try { await navigator.clipboard.writeText(text); setMessage('Ideia copiada. Você pode colar no Instagram ou no WhatsApp.') }
    catch { setError('Não foi possível copiar automaticamente. Abra a revisão e copie o texto manualmente.') }
  }

  async function generateWithGemini() {
    if (!supabase || !workspace || !profileReady || brief.trim().length < 8 || brief.trim().length > 500 || (trendMode && trendBrief.length > 500)) return
    setBusy(true); setError(''); setMessage('')
    try {
      const { error: invokeError } = trendMode
        ? await supabase.functions.invoke('generate-content-idea', { body: { workspaceId: workspace.id, brief: trendBrief, format, trendMode: true } })
        : await supabase.functions.invoke('ask-niche-assistant', { body: { workspaceId: workspace.id, action: 'idea', text: brief.trim(), format, trendContext: trendContext.trim() } })
      if (invokeError) {
        let detail = 'Não foi possível gerar a ideia agora.'
        if (invokeError instanceof FunctionsHttpError) {
          const status = invokeError.context.status
          const serverMessage = await readFunctionError(invokeError)
          if (status === 429) detail = 'O limite diário de IA do seu plano foi atingido. Tente amanhã.'
          else if (status === 401) detail = 'Sua sessão expirou. Entre novamente e tente mais tarde.'
          else if (status === 403) detail = 'O acesso ou a assinatura deste espaço precisa ser regularizado.'
          else if (serverMessage) detail = serverMessage
          else if (status >= 500) detail = 'O serviço de IA está indisponível ou não foi configurado no servidor.'
          else if (status === 400 || status === 422) detail = 'Salve o perfil e confira se o objetivo está dentro do nicho. Uma tendência sem fontes verificáveis não deve ser apresentada como atual.'
        } else if (invokeError instanceof FunctionsFetchError || invokeError instanceof FunctionsRelayError) {
          detail = 'Não foi possível conectar ao serviço de IA. Confira sua conexão e tente novamente.'
        }
        setError(`${detail} Você também pode copiar o prompt abaixo e criar um rascunho manualmente.`)
        setPreparedPrompt(prompt)
        return
      }
      setMessage(trendMode ? 'Ideia salva em revisão. Confira as fontes registradas e cada afirmação sobre tendências antes de aprovar; nada foi publicado ou enviado.' : 'Ideia gerada e salva em revisão. Confira o texto antes de aprovar; nada foi publicado ou enviado.')
      await load()
    } catch {
      setPreparedPrompt(prompt)
      setError('A geração foi interrompida. Confira sua conexão ou copie o prompt abaixo e salve a ideia manualmente.')
    } finally {
      setBusy(false)
    }
  }

  async function scheduleReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace) return
    const idea = ideas.find((item) => item.id === reminderIdeaId && item.status === 'approved')
    const when = new Date(scheduledFor)
    if (!idea || !scheduledFor || !Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) {
      setReminderError('Selecione uma ideia aprovada e um horário futuro.'); return
    }
    const body = `${idea.body ?? ''}${idea.cta ? `\n\n${idea.cta}` : ''}`.trim()
    if (idea.title.trim().length < 3 || idea.title.trim().length > 180 || body.length < 3 || body.length > 4000) {
      setReminderError('O título deve ter até 180 caracteres e o texto do lembrete, de 3 a 4000. Ajuste a ideia antes de agendar.'); return
    }
    setBusy(true); setReminderError(''); setMessage('')
    const { error: saveError } = await supabase.from('content_reminders').insert({
      workspace_id: workspace.id, title: idea.title.trim(), body,
      scheduled_for: when.toISOString(), status: 'pending', channel: reminderChannel,
    })
    setBusy(false)
    if (saveError) { setReminderError('Não foi possível agendar. Verifique se a tabela de lembretes e as permissões estão disponíveis.'); return }
    setReminderIdeaId(''); setScheduledFor(''); setMessage('Lembrete registrado para a data escolhida. A publicação ou envio continua manual.'); await load()
  }

  async function updateReminder(id: string, status: 'done' | 'cancelled') {
    if (!supabase || !workspace) return
    setBusy(true); setReminderError('')
    const { data, error: updateError } = await supabase.from('content_reminders').update({ status }).eq('id', id).eq('workspace_id', workspace.id).eq('status', 'pending').select('id').maybeSingle()
    setBusy(false)
    if (updateError || !data) setReminderError('Não foi possível atualizar o lembrete. Recarregue a página e tente novamente.')
    else await load()
  }

  return <><div className="page-intro"><div><p className="eyebrow">Sua voz</p><h1>Conteúdo IA</h1><p className="intro-description">Descreva seu público, gere ou escreva uma ideia e aprove somente após revisar. Gerar ou aprovar não publica nem envia mensagens.</p></div></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <section className="panel editor-panel"><div className="panel-heading"><div><span className="panel-kicker">Base para a IA</span><h2>Como você se comunica</h2></div></div><form className="form-grid" onSubmit={(event) => void saveProfile(event)}><div className="form-row"><label>Público-alvo<textarea rows={2} value={profile.audience ?? ''} onChange={(event) => setProfile({ ...profile, audience: event.target.value })} placeholder="Ex.: Iniciantes de 25 a 45 anos com pouco tempo" /></label><label>Tom de voz<input value={profile.tone} onChange={(event) => setProfile({ ...profile, tone: event.target.value })} placeholder="Próximo, técnico e simples" /></label></div><div className="form-row"><label>Objetivos de conteúdo<input value={profile.goals ?? ''} onChange={(event) => setProfile({ ...profile, goals: event.target.value })} placeholder="Educar, engajar e apresentar avaliações" /></label><label>Equipamentos preferidos<input value={profile.preferred_equipment ?? ''} onChange={(event) => setProfile({ ...profile, preferred_equipment: event.target.value })} placeholder="Halteres, leg press, elásticos" /></label></div><div className="form-row"><label>Método ou tipo de treino<input value={profile.training_methods ?? ''} onChange={(event) => setProfile({ ...profile, training_methods: event.target.value })} placeholder="Musculação para iniciantes" /></label><label>Frequência semanal típica<input value={profile.weekly_frequency ?? ''} onChange={(event) => setProfile({ ...profile, weekly_frequency: event.target.value })} placeholder="3 a 4 vezes por semana" /></label></div><label>Instruções adicionais<textarea rows={2} value={profile.guidelines ?? ''} onChange={(event) => setProfile({ ...profile, guidelines: event.target.value })} placeholder="Termos que você usa, abordagem, exemplos preferidos" /></label><label>Temas a evitar<textarea rows={2} value={profile.forbidden_topics ?? ''} onChange={(event) => setProfile({ ...profile, forbidden_topics: event.target.value })} placeholder="Promessas de resultado, temas clínicos etc." /></label><button disabled={busy} className="primary-button">{busy ? 'Salvando…' : 'Salvar perfil'} <span>→</span></button></form></section>
    <div className="dashboard-grid content-workflow">
      <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Briefing</span><h2>Gerar com Gemini</h2></div></div>
        <p className="empty-copy">Salve o perfil antes de gerar. Stories recebem roteiro por tela; posts recebem estrutura visual e legenda. A ideia entra em revisão. Geração e chat compartilham o limite diário de IA do seu plano.</p>
        <div className="form-grid">
          <div className="quick-prompts" aria-label="Atalhos de briefing"><span>Comece por um atalho</span>{quickBriefs.map((item) => <button type="button" key={item.label} className="prompt-chip" onClick={() => { setBrief(item.brief); setFormat(item.format) }}>{item.label}</button>)}</div>
          <label>O que você quer comunicar?<textarea rows={4} maxLength={500} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Ex.: Incentivar iniciantes a manter uma rotina possível" /></label>
          <p className="field-help">{brief.trim().length}/500 caracteres · mínimo de 8 para gerar</p>
          <label>Tema ou sinal que você observou (opcional)<textarea rows={2} maxLength={500} value={trendContext} onChange={(event) => setTrendContext(event.target.value)} placeholder="Ex.: meus clientes perguntaram sobre treinos curtos" /></label>
          <p className="field-help">Isso é contexto fornecido por você, não uma tendência atual verificada. Confira fontes e dados antes de fazer essa afirmação publicamente.</p>
          <label className="check-row"><input type="checkbox" checked={trendMode} onChange={(event) => setTrendMode(event.target.checked)} /> Pesquisar tendência atual</label>
          {trendMode && <p className="field-help">A pesquisa usa fontes do Google e salva a ideia em revisão. Confira os links e as afirmações antes de aprovar. Pedido e contexto juntos: {trendBrief.length}/500 caracteres.</p>}
          <label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as ContentIdea['format'])}><option value="story">Story</option><option value="post">Post</option></select></label>
          {!profileReady && <p className="field-help">Salve o perfil acima para liberar a geração com IA.</p>}
          <div className="form-actions form-actions-start"><button type="button" className="primary-button" disabled={busy || !profileReady || brief.trim().length < 8 || brief.trim().length > 500 || (trendMode && trendBrief.length > 500)} onClick={() => void generateWithGemini()}>{busy ? 'Gerando…' : trendMode ? 'Pesquisar e gerar ideia' : 'Gerar ideia'} <span>✦</span></button><button type="button" className="secondary-button" disabled={!brief.trim()} onClick={() => void copyPrompt()}>Copiar prompt</button></div>
          {preparedPrompt && <label>Prompt para uso manual<textarea rows={9} readOnly value={preparedPrompt} onFocus={(event) => event.target.select()} /></label>}
        </div>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="panel-kicker">Alternativa manual</span><h2>Salvar uma ideia</h2></div></div><p className="empty-copy">Escreva ou cole uma ideia revisada. Ela será salva como rascunho, sem publicação nem envio.</p><form className="form-grid" onSubmit={(event) => void saveIdea(event)}><label>Título<input required value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Ex.: 3 maneiras de manter a rotina" /></label><label>Roteiro ou legenda<textarea required rows={7} value={ideaBody} onChange={(event) => setIdeaBody(event.target.value)} /></label><button disabled={busy} className="primary-button">Salvar rascunho <span>＋</span></button></form></section>
    </div>
    <section className="panel">
      <div className="panel-heading"><div><span className="panel-kicker">Biblioteca</span><h2>Ideias salvas</h2></div><span>{ideas.length} ideias</span></div>
      <p className="field-help">Revise título, roteiro, fontes e chamada para ação. Somente ideias aprovadas aparecem no teste manual do WhatsApp.</p>
      <div className="library-toolbar"><input aria-label="Buscar ideias" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Buscar por título ou tema" /><div className="filter-tabs" role="tablist" aria-label="Filtrar ideias">{(['all', 'review', 'approved', 'draft'] as const).map((filter) => <button type="button" key={filter} className={libraryFilter === filter ? 'active' : ''} onClick={() => setLibraryFilter(filter)}>{filter === 'all' ? 'Todas' : filter === 'review' ? 'Em revisão' : filter === 'approved' ? 'Aprovadas' : 'Rascunhos'}</button>)}</div></div>
      {ideas.length ? filteredIdeas.length ? <div className="simple-list">{filteredIdeas.map((idea) => <div key={idea.id} className="idea-list-row">
        {editing?.id === idea.id ? <form className="form-grid idea-edit-form" onSubmit={(event) => { event.preventDefault(); void saveEdited() }}>
          <label>Título<input required value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
          <label>Gancho<input value={editing.hook ?? ''} onChange={(event) => setEditing({ ...editing, hook: event.target.value })} /></label>
          <label>Roteiro ou legenda<textarea required rows={5} value={editing.body ?? ''} onChange={(event) => setEditing({ ...editing, body: event.target.value })} /></label>
          <label>Chamada para ação<input value={editing.cta ?? ''} onChange={(event) => setEditing({ ...editing, cta: event.target.value })} /></label>
          <IdeaSources idea={idea} />
          <label className="check-row"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> Revisei o texto, as fontes disponíveis e confirmo que posso usá-lo com meus contatos.</label>
          <p className="field-help">Aprovar apenas libera a ideia para teste manual; não publica nem envia a mensagem.</p>
          <div className="form-actions"><button type="button" className="secondary-button" onClick={() => { setEditing(null); setReviewed(false) }}>Cancelar</button><button className="secondary-button" disabled={busy} type="submit">Salvar revisão</button><button className="primary-button" disabled={busy || !reviewed || !editing.title.trim() || !editing.body?.trim()} type="button" onClick={() => void saveEdited(true)}>Aprovar ideia <span>→</span></button></div>
        </form> : <>
          <div><strong>{idea.title}</strong><small>{idea.format} · {idea.status === 'approved' ? 'Aprovada' : idea.status === 'review' ? 'Em revisão' : 'Rascunho'} · {idea.source === 'ai' ? 'IA' : 'Manual'}</small>{idea.hook && <p><b>Gancho:</b> {idea.hook}</p>}<p>{idea.body}</p>{idea.cta && <p><b>CTA:</b> {idea.cta}</p>}<IdeaSources idea={idea} /></div>
          <div className="idea-actions"><button type="button" className="secondary-button" onClick={() => void copyIdea(idea)}>Copiar conteúdo</button>{idea.status !== 'approved' && <button className="secondary-button" onClick={() => { setEditing({ ...idea }); setReviewed(false); setError(''); setMessage('') }}>Revisar ideia</button>}</div>
        </>}
      </div>)}</div> : <p className="empty-copy">Nenhuma ideia corresponde ao filtro atual.</p> : <p className="empty-copy">Nenhuma ideia salva ainda.</p>}
    </section>
    <section className="panel editor-panel" aria-labelledby="reminders-title"><div className="panel-heading"><div><span className="panel-kicker">Planejamento</span><h2 id="reminders-title">Lembretes de conteúdo</h2></div></div>
      <p className="field-help">Escolha uma ideia aprovada e uma data. O lembrete fica registrado no painel; não há notificação, publicação ou envio automático.</p>
      {reminderError && <p className="form-error" role="alert">{reminderError}</p>}
      <form className="form-grid" onSubmit={(event) => void scheduleReminder(event)}>
        <label>Ideia aprovada<select required value={reminderIdeaId} onChange={(event) => setReminderIdeaId(event.target.value)}><option value="">Selecione uma ideia</option>{ideas.filter((idea) => idea.status === 'approved').map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select></label>
        <div className="form-row"><label>Data e hora<input required type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label><label>Canal<select value={reminderChannel} onChange={(event) => setReminderChannel(event.target.value as 'internal' | 'whatsapp')}><option value="internal">No painel</option><option value="whatsapp">WhatsApp manual</option></select></label></div>
        <button disabled={busy || !reminderIdeaId || !scheduledFor} className="primary-button">Agendar lembrete <span>→</span></button>
      </form>
      {reminders.length > 0 && <div className="simple-list">{reminders.map((reminder) => <div key={reminder.id} className="idea-list-row"><div><strong>{reminder.title}</strong><small>{reminder.channel === 'internal' ? 'No painel' : 'WhatsApp manual'} · {new Date(reminder.scheduled_for).toLocaleString('pt-BR')} · {reminder.status === 'pending' ? 'Pendente' : reminder.status === 'done' ? 'Concluído' : 'Cancelado'}</small><p>{reminder.body}</p></div>{reminder.status === 'pending' && <div className="idea-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void updateReminder(reminder.id, 'done')}>Marcar como concluído</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void updateReminder(reminder.id, 'cancelled')}>Cancelar</button></div>}</div>)}</div>}
    </section>
    <AdminAssistant />
  </>
}

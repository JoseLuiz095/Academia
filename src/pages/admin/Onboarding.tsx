import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeSlug } from '../../lib/format'
import { supabase } from '../../lib/supabase'

export function AdminOnboarding() {
  const { user, workspace, refresh } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [niche, setNiche] = useState('fitness')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user) return
    const safeSlug = normalizeSlug(slug || name)
    if (safeSlug.length < 3) { setError('Use um endereço com pelo menos 3 caracteres.'); return }
    setBusy(true); setError('')
    const { error: workspaceError } = await supabase.rpc('create_owner_workspace', {
      workspace_name: name.trim(), workspace_slug: safeSlug, workspace_niche: niche,
    })
    if (workspaceError) { setError(workspaceError.code === '23505' ? 'Você já possui um espaço ou este endereço está em uso.' : workspaceError.message); setBusy(false); return }
    await refresh()
    setBusy(false)
    navigate('/admin/configuracoes')
  }

  if (workspace) return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>Seu espaço está criado</h1><p className="intro-description">Siga esta ordem para compartilhar sua página com segurança.</p></div></div><div className="step-list"><Link to="/admin/configuracoes"><b>01</b><span><strong>Configure seu perfil público</strong><small>Descrição, WhatsApp, cidade e Pix.</small></span><em>→</em></Link><Link to="/admin/produtos"><b>02</b><span><strong>Cadastre seus produtos e serviços</strong><small>Manuais, avaliações, roupas ou acessórios.</small></span><em>→</em></Link><Link to="/admin/conteudo"><b>03</b><span><strong>Prepare seu conteúdo</strong><small>Defina público, tom e temas da sua comunicação.</small></span><em>→</em></Link><Link to="/admin/configuracoes"><b>04</b><span><strong>Publique a vitrine</strong><small>Compartilhe o link quando estiver pronta.</small></span><em>→</em></Link></div></>

  return <><div className="page-intro"><div><p className="eyebrow">Primeiros passos</p><h1>Crie seu espaço</h1><p className="intro-description">Você poderá mudar esses dados depois.</p></div></div><section className="panel form-panel"><form onSubmit={(event) => void create(event)} className="form-grid"><label>Nome público<input required minLength={3} maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(normalizeSlug(event.target.value)) }} placeholder="Ex.: Personal Carlos" /></label><label>Endereço da página<div className="input-prefix"><span>movencia/p/</span><input required minLength={3} value={slug} onChange={(event) => setSlug(normalizeSlug(event.target.value))} placeholder="personal-carlos" /></div></label><label>Área de atuação<select value={niche} onChange={(event) => setNiche(event.target.value)}><option value="fitness">Fitness e treinamento</option><option value="wellness">Bem-estar</option><option value="creator">Outro criador</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<button disabled={busy} className="primary-button">{busy ? 'Criando…' : 'Criar espaço'} <span>→</span></button></form></section></>
}

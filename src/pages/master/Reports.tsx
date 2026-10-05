import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Report = { id: string; workspace_id: string; product_id: string | null; reporter_name: string; reporter_email: string; reason: string; details: string | null; status: 'pending' | 'reviewing' | 'resolved' | 'dismissed'; reviewer_note: string | null; created_at: string; workspace?: { name: string; slug: string }[] | null }
const statusLabel: Record<Report['status'], string> = { pending: 'Pendente', reviewing: 'Em análise', resolved: 'Resolvida', dismissed: 'Arquivada' }

export function MasterReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [status, setStatus] = useState<'all' | Report['status']>('pending')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    if (!supabase) return
    const query = supabase.from('public_store_reports').select('id,workspace_id,product_id,reporter_name,reporter_email,reason,details,status,reviewer_note,created_at,workspace:workspaces(name,slug)').order('created_at', { ascending: false }).limit(100)
    const result = status === 'all' ? await query : await query.eq('status', status)
    if (result.error) setError('Não foi possível carregar as denúncias.')
    else { setReports((result.data ?? []) as Report[]); setError('') }
  }
  useEffect(() => { void load() }, [status])

  async function review(report: Report, decision: 'reviewing' | 'resolved' | 'dismissed') {
    if (!supabase || busy) return
    setBusy(report.id); setError('')
    const result = await supabase.rpc('review_public_store_report', { target_report_id: report.id, decision, note: notes[report.id] ?? '' })
    if (result.error) setError(result.error.message)
    else await load()
    setBusy(null)
  }

  return <><div className="page-intro"><div><p className="eyebrow">Admin Master</p><h1>Denúncias de vitrines</h1><p className="intro-description">Analise relatos sobre documentos profissionais, dietas, fichas e informações comerciais. A denúncia gera revisão humana; o sistema não encerra uma página automaticamente.</p></div><button className="secondary-button" onClick={() => void load()}>Atualizar ↻</button></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="orders-toolbar"><div className="filter-tabs" role="tablist" aria-label="Filtrar denúncias">{(['pending', 'reviewing', 'resolved', 'dismissed', 'all'] as const).map((item) => <button type="button" key={item} className={status === item ? 'active' : ''} onClick={() => setStatus(item)}>{item === 'all' ? 'Todas' : statusLabel[item]}</button>)}</div></div>{reports.length ? <div className="reports-list">{reports.map((report) => <article className="panel report-card" key={report.id}><div className="panel-heading"><div><span className="panel-kicker">{statusLabel[report.status]} · {new Date(report.created_at).toLocaleString('pt-BR')}</span><h2>{report.workspace?.[0]?.name ?? report.workspace_id}</h2></div><span className="status-pill">{report.reason}</span></div><p className="field-help">Página: /p/{report.workspace?.[0]?.slug ?? 'indisponível'} · Relator: {report.reporter_name} · {report.reporter_email}</p>{report.details && <p className="report-details">{report.details}</p>}<label>Nota da análise<textarea rows={2} value={notes[report.id] ?? report.reviewer_note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Descreva o encaminhamento ou resultado." /></label><div className="form-actions form-actions-start"><button className="secondary-button" disabled={busy === report.id} onClick={() => void review(report, 'dismissed')}>Arquivar</button><button className="secondary-button" disabled={busy === report.id} onClick={() => void review(report, 'reviewing')}>Marcar em análise</button><button className="primary-button" disabled={busy === report.id} onClick={() => void review(report, 'resolved')}>{busy === report.id ? 'Salvando…' : 'Resolver revisão'} <span>✓</span></button></div></article>)}</div> : <section className="panel empty-panel"><span>✓</span><h2>Nenhuma denúncia neste filtro</h2><p>As denúncias enviadas pelas vitrines aparecerão aqui para análise humana.</p></section>}</>
}

import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { currency } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Product } from '../../types'

type Draft = { id?: string; kind: Product['kind']; name: string; description: string; price: string; image_url: string; imageFile: File | null; service_area: string; published: boolean }
const blankDraft: Draft = { kind: 'digital', name: '', description: '', price: '', image_url: '', imageFile: null, service_area: '', published: false }
const kindLabel: Record<Product['kind'], string> = { digital: 'Manual digital', service: 'Serviço', physical: 'Produto físico' }

export function AdminProducts() {
  const { workspace, user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!supabase || !workspace) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('products')
      .select('id,workspace_id,kind,name,description,price,currency,published,image_url,service_area,created_at')
      .eq('workspace_id', workspace.id).order('created_at', { ascending: false })
    setProducts((data ?? []) as Product[])
    setError(queryError?.message ?? '')
    setLoading(false)
  }
  useEffect(() => { void load() }, [workspace?.id])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace || !draft) return
    const numericPrice = draft.price.trim() ? Number(draft.price.replace(',', '.')) : null
    if (numericPrice !== null && (!Number.isFinite(numericPrice) || numericPrice < 0)) { setError('Informe um preço válido.'); return }
    if (draft.published && numericPrice === null) { setError('Informe o preço antes de publicar.'); return }
    if (draft.image_url && !/^https:\/\//i.test(draft.image_url)) { setError('A imagem precisa usar um endereço HTTPS.'); return }
    if (draft.imageFile && (!draft.imageFile.type.startsWith('image/') || draft.imageFile.size > 5 * 1024 * 1024)) { setError('Escolha uma imagem de até 5 MB.'); return }
    setBusy(true); setError('')
    let uploadedPath = ''
    let imageUrl = draft.image_url.trim() || null
    if (draft.imageFile) {
      const extension = draft.imageFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      uploadedPath = `${workspace.id}/${crypto.randomUUID()}.${extension}`
      const upload = await supabase.storage.from('product-images').upload(uploadedPath, draft.imageFile, { contentType: draft.imageFile.type, cacheControl: '31536000', upsert: false })
      if (upload.error) { setBusy(false); setError('Não foi possível enviar a imagem. Confira o formato e tente novamente.'); return }
      imageUrl = supabase.storage.from('product-images').getPublicUrl(uploadedPath).data.publicUrl
    }
    const payload = {
      kind: draft.kind, name: draft.name.trim(), description: draft.description.trim() || null,
      price: numericPrice, image_url: imageUrl,
      service_area: draft.kind === 'service' ? draft.service_area.trim() || null : null,
      published: draft.published, updated_at: new Date().toISOString(),
    }
    const result = draft.id
      ? await supabase.from('products').update(payload).eq('id', draft.id).eq('workspace_id', workspace.id)
      : await supabase.from('products').insert({ ...payload, workspace_id: workspace.id, created_by: user?.id })
    setBusy(false)
    if (result.error) {
      if (uploadedPath) await supabase.storage.from('product-images').remove([uploadedPath])
      setError(result.error.message); return
    }
    setDraft(null)
    await load()
  }

  return <><div className="page-intro"><div><p className="eyebrow">Sua vitrine</p><h1>Produtos e serviços</h1><p className="intro-description">Cadastre avaliações, manuais, roupas, suplementos e acessórios.</p></div><button className="primary-button" onClick={() => { setDraft({ ...blankDraft }); setError('') }}>Adicionar produto <span>＋</span></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {draft && <section className="panel editor-panel"><div className="panel-heading"><div><span className="panel-kicker">Catálogo</span><h2>{draft.id ? 'Editar produto' : 'Novo produto'}</h2></div><button className="text-button" onClick={() => setDraft(null)}>Fechar</button></div><form className="form-grid" onSubmit={(event) => void save(event)}><div className="form-row"><label>Tipo<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Product['kind'] })}><option value="digital">Manual ou ficha digital</option><option value="service">Avaliação ou serviço</option><option value="physical">Produto físico</option></select></label><label>Preço (R$)<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="49,90" /></label></div><label>Nome<input required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Manual Hipertrofia" /></label><label>Descrição<textarea rows={3} maxLength={1000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Explique o que está incluso e para quem é indicado." /></label>{draft.kind === 'service' && <label>Locais de atendimento<input value={draft.service_area} onChange={(event) => setDraft({ ...draft, service_area: event.target.value })} placeholder="Online ou bairros/cidades atendidos" /></label>}<label>Imagem do produto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setDraft({ ...draft, imageFile: event.target.files?.[0] ?? null })} /><small className="field-help">PNG, JPG ou WebP até 5 MB. A imagem fica pública na vitrine.</small></label><label>Ou imagem por URL HTTPS<input type="url" value={draft.image_url} onChange={(event) => setDraft({ ...draft, image_url: event.target.value })} placeholder="https://..." /></label><label className="check-row"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> Publicar na vitrine</label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setDraft(null)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar produto'} <span>→</span></button></div></form></section>}
    {loading ? <p className="empty-copy">Carregando produtos…</p> : products.length ? <div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><div className={`product-cover ${product.kind === 'service' ? 'blue' : product.kind === 'physical' ? 'purple' : 'orange'}`}>{product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <><span>{kindLabel[product.kind]}</span><strong>{product.name}</strong><i>✦</i></>}</div><div className="product-body"><div className="product-status"><span>{product.published ? 'Publicado' : 'Rascunho'}</span><span>{kindLabel[product.kind]}</span></div><strong>{product.name}</strong><p>{product.description || 'Sem descrição'}</p><div><b>{product.price === null ? 'Preço a combinar' : currency.format(product.price)}</b><button className="text-button" onClick={() => { setDraft({ id: product.id, kind: product.kind, name: product.name, description: product.description ?? '', price: product.price?.toString() ?? '', image_url: product.image_url ?? '', imageFile: null, service_area: product.service_area ?? '', published: product.published }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Editar →</button></div></div></article>)}</div> : <section className="panel empty-panel"><span>▣</span><h2>Seu catálogo começa aqui</h2><p>Cadastre o primeiro serviço ou produto para montar sua vitrine.</p><button className="primary-button" onClick={() => setDraft({ ...blankDraft })}>Adicionar produto <span>＋</span></button></section>}
  </>
}

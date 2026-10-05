import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Product, Workspace } from '../types'

type CartEntry = { id: string; quantity: number }
type StoreState = {
  workspace: Workspace
  products: Product[]
  cart: CartEntry[]
  addToCart: (id: string) => void
  changeQuantity: (id: string, quantity: number) => void
  clearCart: () => void
}
const StoreContext = createContext<StoreState | null>(null)

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('Loja pública indisponível')
  return value
}

export function PublicLayout() {
  const { slug = '' } = useParams()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cartKey = `academia:cart:${slug}`
  const [cart, setCart] = useState<CartEntry[]>([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(cartKey) ?? '[]') as CartEntry[]
      setCart(Array.isArray(saved) ? saved.filter((item) => typeof item.id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0) : [])
    } catch { setCart([]) }
  }, [cartKey])

  useEffect(() => {
    if (!supabase) { setError('Configure o Supabase para abrir a vitrine.'); setLoading(false); return }
    let active = true
    setLoading(true)
    setError('')
    const client = supabase
    async function load() {
      const storeResult = await client.from('workspaces')
        .select('id,name,slug,niche,description,whatsapp_number,pix_key,pix_receiver,pix_city,service_cities,training_document_type,training_document_number,nutrition_document_type,nutrition_document_number,published,store_settings,approval_status')
        .eq('slug', slug).eq('published', true).maybeSingle()
      if (!active) return
      if (storeResult.error || !storeResult.data) {
        setError('Esta página ainda não está publicada ou não existe.')
        setLoading(false)
        return
      }
      const current = storeResult.data as Workspace
      const productResult = await client.from('products')
        .select('id,workspace_id,kind,name,description,price,currency,published,image_url,service_area,category,level,access_mode,access_days,content')
        .eq('workspace_id', current.id).eq('published', true)
      if (!active) return
      setWorkspace(current)
      setProducts((productResult.data ?? []) as Product[])
      if (productResult.error) setError('Não foi possível carregar os produtos agora.')
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [slug])

  const safeCart = useMemo(() => cart.filter((entry) => products.some((product) => product.id === entry.id && product.price !== null)), [cart, products])

  function saveCart(next: CartEntry[]) {
    setCart(next)
    localStorage.setItem(cartKey, JSON.stringify(next))
  }
  function addToCart(id: string) {
    const product = products.find((item) => item.id === id)
    if (!product || product.price === null) return
    const existing = safeCart.find((item) => item.id === id)
    saveCart(existing ? safeCart.map((item) => item.id === id ? { ...item, quantity: Math.min(item.quantity + 1, 99) } : item) : [...safeCart, { id, quantity: 1 }])
  }
  function changeQuantity(id: string, quantity: number) { saveCart(safeCart.map((item) => item.id === id ? { ...item, quantity: Math.min(quantity, 99) } : item).filter((item) => item.quantity > 0)) }
  function clearCart() { saveCart([]) }

  if (loading || (workspace && workspace.slug !== slug)) return <div className="loading-page">Carregando vitrine…</div>
  if (!workspace) return <div className="loading-page"><div><h1>Espaço indisponível</h1><p>{error}</p><Link to="/">Voltar ao início</Link></div></div>
  const totalItems = safeCart.reduce((total, item) => total + item.quantity, 0)
  const settings = workspace.store_settings ?? {}
  const themeVars = { '--store-primary': settings.primary_color ?? '#ed7b45', '--store-accent': settings.accent_color ?? '#5f9c78' } as CSSProperties
  return <StoreContext.Provider value={{ workspace, products, cart: safeCart, addToCart, changeQuantity, clearCart }}>
    <div className={`store-shell store-theme-${settings.theme ?? 'sage'}`} style={themeVars}>
      <header className="store-topbar"><Link className="store-logo plain-link" to={`/p/${slug}`}><span className="brand-mark">I</span><span><strong>{workspace.name}</strong><small>por impulso</small></span></Link><nav aria-label="Navegação da loja"><Link to={`/p/${slug}`}>Início</Link><Link to={`/p/${slug}/acesso`}>Acesso do cliente</Link><Link to={`/p/${slug}/carrinho`} aria-label={`Sacola, ${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`}>Sacola <span className="cart-badge" aria-hidden="true">{totalItems}</span></Link></nav></header>
      {error && <p className="form-error">{error}</p>}
      <main><div className="professional-disclosure"><strong>Responsabilidade profissional</strong>{products.some((product) => product.category === 'workout') && workspace.training_document_number && <span>Treinos: {workspace.training_document_type ?? 'Registro profissional'} {workspace.training_document_number}</span>}{products.some((product) => product.category === 'diet') && workspace.nutrition_document_number && <span>Nutrição: {workspace.nutrition_document_type ?? 'Registro profissional'} {workspace.nutrition_document_number}</span>}<Link to={`/p/${slug}/denunciar`}>Encontrou uma irregularidade? Denuncie para análise</Link></div><Outlet /></main>
      <footer className="store-footer"><span>{workspace.name} · feito com impulso</span><span>Pagamento e atendimento combinados diretamente com o profissional. <Link to={`/p/${slug}/denunciar`}>Denunciar página</Link></span></footer>
    </div>
  </StoreContext.Provider>
}

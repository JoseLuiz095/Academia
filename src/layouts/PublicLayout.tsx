import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
        .select('id,name,slug,niche,description,whatsapp_number,pix_key,pix_receiver,pix_city,service_cities,published,store_settings')
        .eq('slug', slug).eq('published', true).maybeSingle()
      if (!active) return
      if (storeResult.error || !storeResult.data) {
        setError('Esta página ainda não está publicada ou não existe.')
        setLoading(false)
        return
      }
      const current = storeResult.data as Workspace
      const productResult = await client.from('products')
        .select('id,workspace_id,kind,name,description,price,currency,published,image_url,service_area')
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
  return <StoreContext.Provider value={{ workspace, products, cart: safeCart, addToCart, changeQuantity, clearCart }}>
    <div className={`store-shell store-theme-${workspace.store_settings?.theme ?? 'sage'}`}>
      <header className="store-topbar"><Link className="store-logo plain-link" to={`/p/${slug}`}><span className="brand-mark">I</span><span><strong>{workspace.name}</strong><small>por impulso</small></span></Link><nav><Link to={`/p/${slug}`}>Início</Link><Link to={`/p/${slug}/carrinho`}>Sacola <span className="cart-badge">{totalItems}</span></Link></nav></header>
      {error && <p className="form-error">{error}</p>}
      <main><Outlet /></main>
      <footer className="store-footer"><span>{workspace.name} · feito com impulso</span><span>Pagamento e atendimento combinados diretamente com o profissional.</span></footer>
    </div>
  </StoreContext.Provider>
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DietPlate } from '../../components/DietPlate'
import { EvaluationPicker } from '../../components/EvaluationPicker'
import { ExerciseVideo } from '../../components/ExerciseVideo'
import { WorkoutTimer } from '../../components/WorkoutTimer'
import { useStore } from '../../layouts/PublicLayout'
import { currency, whatsappLink } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { AppointmentSelection, MotionPreset, MotionType, MuscleGroup, Product, ProductContentItem } from '../../types'

const label: Record<Product['kind'], string> = { service: 'Serviço', digital: 'Manual digital', physical: 'Produto físico' }
const categoryLabel: Record<NonNullable<Product['category']>, string> = { workout: 'Ficha de treino', diet: 'Dieta', service: 'Serviço', physical: 'Produto físico', other: 'Conteúdo digital' }
const levelLabel: Record<NonNullable<Product['level']>, string> = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado', all: 'Todos os níveis' }

function ProductCover({ product }: { product: Product }) {
  return <div className={`store-product-cover ${product.kind}`} aria-hidden="true">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <><span>{label[product.kind]}</span><strong>{product.name}</strong><i>✦</i></>}</div>
}

const presetLabels: Record<MotionPreset, string> = { auto: 'Automático', squat: 'Agachamento', lunge: 'Afundo', pushup: 'Empurrar', row: 'Puxada / remada', deadlift: 'Levantamento', press: 'Desenvolvimento', plank: 'Prancha', strength: 'Força geral' }
const muscleLabels: Record<MuscleGroup, string> = { chest: 'Peitoral', back: 'Costas', shoulders: 'Ombros', arms: 'Braços', core: 'Core', glutes: 'Glúteos', quadriceps: 'Quadríceps', hamstrings: 'Posteriores', calves: 'Panturrilhas' }
const defaultMuscles: Record<Exclude<MotionPreset, 'auto'>, MuscleGroup[]> = { squat: ['quadriceps', 'glutes', 'core'], lunge: ['quadriceps', 'glutes', 'hamstrings'], pushup: ['chest', 'shoulders', 'arms', 'core'], row: ['back', 'arms', 'core'], deadlift: ['hamstrings', 'glutes', 'back', 'core'], press: ['shoulders', 'arms', 'core'], plank: ['core', 'shoulders'], strength: ['core', 'arms'] }

function inferPreset(title: string): Exclude<MotionPreset, 'auto'> {
  const value = title.toLocaleLowerCase('pt-BR')
  if (/agach|squat/.test(value)) return 'squat'; if (/afundo|passada|lunge/.test(value)) return 'lunge'; if (/flex|supino|push|peito/.test(value)) return 'pushup'; if (/remada|puxada|row/.test(value)) return 'row'; if (/terra|deadlift|levantamento/.test(value)) return 'deadlift'; if (/desenvolvimento|shoulder|militar/.test(value)) return 'press'; if (/prancha|plank/.test(value)) return 'plank'; return 'strength'
}

function BuiltInMotion({ item, compact = false }: { item: ProductContentItem; compact?: boolean }) {
  const selectedPreset = item.motion_preset && item.motion_preset !== 'auto' ? item.motion_preset : inferPreset(item.title)
  const focused = item.muscle_focus?.length ? item.muscle_focus : defaultMuscles[selectedPreset]
  const isActive = (muscle: MuscleGroup) => focused.includes(muscle) ? 'active' : ''
  const activated = focused.map((muscle) => muscleLabels[muscle]).join(' · ')
  return <div className={`motion-frame embedded-motion preset-${selectedPreset} ${compact ? 'compact' : ''}`} role="img" aria-label={`${item.title}. Ativação: ${activated}`}><svg viewBox="0 0 240 190" aria-hidden="true"><g className="motion-grid"><path d="M20 158 H220" /><path d="M35 35 V158 M205 35 V158" /></g><g className="mesh-silhouette"><circle cx="120" cy="27" r="14" /><path d="M120 42 C104 46 97 68 101 87 L108 104 L93 148 M120 42 C136 46 143 68 139 87 L132 104 L147 148 M101 61 L61 94 L77 133 M139 61 L179 94 L163 133" /></g><g className="muscle-layer"><ellipse className={`muscle muscle-chest ${isActive('chest')}`} cx="120" cy="61" rx="24" ry="13" /><ellipse className={`muscle muscle-back ${isActive('back')}`} cx="120" cy="67" rx="25" ry="18" /><ellipse className={`muscle muscle-shoulders ${isActive('shoulders')}`} cx="96" cy="55" rx="9" ry="14" /><ellipse className={`muscle muscle-shoulders ${isActive('shoulders')}`} cx="144" cy="55" rx="9" ry="14" /><ellipse className={`muscle muscle-arms ${isActive('arms')}`} cx="68" cy="91" rx="8" ry="19" transform="rotate(-28 68 91)" /><ellipse className={`muscle muscle-arms ${isActive('arms')}`} cx="172" cy="91" rx="8" ry="19" transform="rotate(28 172 91)" /><ellipse className={`muscle muscle-core ${isActive('core')}`} cx="120" cy="80" rx="12" ry="22" /><ellipse className={`muscle muscle-glutes ${isActive('glutes')}`} cx="110" cy="103" rx="12" ry="10" /><ellipse className={`muscle muscle-glutes ${isActive('glutes')}`} cx="130" cy="103" rx="12" ry="10" /><ellipse className={`muscle muscle-quadriceps ${isActive('quadriceps')}`} cx="105" cy="123" rx="10" ry="20" transform="rotate(7 105 123)" /><ellipse className={`muscle muscle-quadriceps ${isActive('quadriceps')}`} cx="135" cy="123" rx="10" ry="20" transform="rotate(-7 135 123)" /><ellipse className={`muscle muscle-hamstrings ${isActive('hamstrings')}`} cx="106" cy="128" rx="8" ry="19" /><ellipse className={`muscle muscle-hamstrings ${isActive('hamstrings')}`} cx="134" cy="128" rx="8" ry="19" /><ellipse className={`muscle muscle-calves ${isActive('calves')}`} cx="101" cy="151" rx="7" ry="14" /><ellipse className={`muscle muscle-calves ${isActive('calves')}`} cx="139" cy="151" rx="7" ry="14" /></g></svg><div className="motion-caption"><strong>{presetLabels[selectedPreset]}</strong><span>Ativação: {activated}</span></div></div>
}

export function MotionVisual({ item, compact = false, showEmbedded = true, diet = false }: { item: ProductContentItem; compact?: boolean; showEmbedded?: boolean; diet?: boolean }) {
  const type: MotionType = item.motion_type ?? 'none'
  const selectedPreset = item.motion_preset && item.motion_preset !== 'auto' ? item.motion_preset : inferPreset(item.title)
  const activated = (item.muscle_focus?.length ? item.muscle_focus : defaultMuscles[selectedPreset]).map((muscle) => muscleLabels[muscle]).join(' · ')
  if (diet) return <DietPlate parts={item.diet_parts} compact={compact} />
  if (item.motion_url && type === 'sequence') return <div className={`model-motion-stack exercise-sequence-stack ${compact ? 'compact' : ''}`}><div className={`motion-frame exercise-sequence-preview ${compact ? 'compact' : ''}`}><span className="motion-badge">Movimento 2D</span><div className="sequence-stage"><img className="sequence-start" src={item.motion_url} alt={item.motion_label || item.title} loading="lazy" /><img className="sequence-peak" src={item.motion_poster || item.motion_url} alt="" aria-hidden="true" loading="lazy" /></div><div className="sequence-legend"><span>Posição inicial</span><span>Movimento final</span></div></div><p className="model-muscle-caption">Ativação: {activated}</p></div>
  if (item.motion_url && type === 'video') return <div className={`model-motion-stack ${compact ? 'compact' : ''}`}><ExerciseVideo compact={compact} autoPlay title={item.title} src={item.motion_url} controls={!compact} badge="HD 3D" /><p className="model-muscle-caption">Ativação: {activated}</p></div>
  if (item.motion_url && type === 'gif') return <div className={`motion-frame ${compact ? 'compact' : ''}`}><img src={item.motion_url} alt={item.motion_label || item.title} loading="lazy" /></div>
  if (showEmbedded && (type === 'embedded' || type === 'none')) return <BuiltInMotion item={item} compact={compact} />
  if (item.image_url) return <div className={`motion-frame motion-image ${compact ? 'compact' : ''}`}><img src={item.image_url} alt={item.motion_label || item.title} loading="lazy" /></div>
  return <div className="content-preview-icon">{item.icon || '✦'}</div>
}

function ContentTag({ item, index, isWorkout, isDiet }: { item: ProductContentItem; index: number; isWorkout: boolean; isDiet: boolean }) {
  return <article className={`content-motion-card ${isDiet ? 'diet-content-card' : ''}`}><MotionVisual item={item} compact showEmbedded={isWorkout} diet={isDiet} /><div><span className="panel-kicker">Etapa {String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong>{item.meta && <small>{item.meta}</small>}<p>{item.details || 'Detalhes liberados no portal após a confirmação do pedido.'}</p></div></article>
}

export function StoreHomeEnhanced() {
  const { workspace, products } = useStore()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | Product['kind']>('all')
  const settings = workspace.store_settings ?? {}
  const contact = settings.show_whatsapp !== false && whatsappLink(workspace.whatsapp_number, `Olá! Vim pela página ${workspace.name} e gostaria de saber mais.`)
  const filteredProducts = products.filter((product) => { const normalized = query.trim().toLocaleLowerCase('pt-BR'); return (kind === 'all' || product.kind === kind) && (!normalized || `${product.name} ${product.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalized)) })
  const heroLines = (settings.hero_title || 'um próximo passo feito para você.').split('\n')
  return <><section className="store-hero"><div><p className="eyebrow">Bem-vindo ao meu espaço</p><h1>{workspace.name}</h1><p>{settings.tagline || workspace.description || 'Conteúdo, serviços e produtos para acompanhar você na sua jornada.'}</p><div className="store-hero-actions"><a className="primary-button plain-link" href="#catalogo">{settings.cta_label || 'Conhecer produtos'} <span>↓</span></a>{contact && <a className="secondary-button plain-link" href={contact} target="_blank" rel="noreferrer">Falar no WhatsApp ↗</a>}{settings.show_service_area !== false && workspace.service_cities && <small>◎ {workspace.service_cities}</small>}</div><div className="store-trust-row"><span>✓ Atendimento humano</span>{settings.show_pix !== false && <span>✓ Pagamento Pix direto</span>}<span>✓ Entrega combinada</span></div></div><div className="store-hero-art"><span>seu espaço</span><strong>{heroLines.map((line, index) => <span key={`${line}-${index}`}>{index > 0 && <br />}{line}</span>)}</strong><i>✦</i><small>{settings.show_ai_badge !== false ? 'conteúdo com contexto' : 'seu próximo passo'}</small></div></section><section id="catalogo" className="store-section"><div className="store-section-heading"><div><p className="eyebrow">Escolha seu próximo passo</p><h2>Produtos e serviços</h2><p>Uma seleção criada para ajudar você a avançar com clareza.</p></div><span>{filteredProducts.length} de {products.length} {products.length === 1 ? 'opção' : 'opções'}</span></div>{products.length ? <><div className="store-catalog-tools"><input aria-label="Buscar no catálogo" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no catálogo" /><select aria-label="Filtrar por tipo" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">Todos os tipos</option><option value="service">Serviços</option><option value="digital">Manuais digitais</option><option value="physical">Produtos físicos</option></select></div>{filteredProducts.length ? <div className="store-grid">{filteredProducts.map((product) => <Link className="store-product-card plain-link" to={`/p/${workspace.slug}/produto/${product.id}`} key={product.id}><ProductCover product={product} /><div><small>{product.category ? categoryLabel[product.category] : label[product.kind]}</small><h3>{product.name}</h3><p>{product.description || 'Saiba mais sobre esta opção.'}</p><strong>{product.price === null ? 'Preço a combinar' : currency.format(product.price)}</strong><span>{product.price === null ? 'Ver como funciona' : 'Conhecer opção'} →</span></div></Link>)}</div> : <section className="panel empty-panel"><h2>Nenhum resultado</h2><p>Tente outro termo ou limpe os filtros.</p></section>}</> : <section className="panel empty-panel"><h2>Novidades em breve</h2><p>Este profissional ainda está preparando o catálogo.</p>{contact && <a className="secondary-button plain-link" href={contact} target="_blank" rel="noreferrer">Falar com o profissional ↗</a>}</section>}</section></>
}

function appointmentStorageKey(workspaceId: string, productId: string) { return `impulso:appointment:${workspaceId}:${productId}` }

function StoreProductView({ product }: { product: Product }) {
  const { workspace, addToCart } = useStore(); const navigate = useNavigate(); const [appointment, setAppointment] = useState<AppointmentSelection | null>(() => { try { const saved = sessionStorage.getItem(appointmentStorageKey(workspace.id, product.id)); return saved ? JSON.parse(saved) as AppointmentSelection : null } catch { return null } }); const [appointmentError, setAppointmentError] = useState('')
  function selectAppointment(next: AppointmentSelection | null) { setAppointment(next); setAppointmentError(''); try { const key = appointmentStorageKey(workspace.id, product.id); if (next) sessionStorage.setItem(key, JSON.stringify(next)); else sessionStorage.removeItem(key) } catch { /* O checkout ainda poderá seguir com o estado da página. */ } }
  const contact = whatsappLink(workspace.whatsapp_number, `Olá! Tenho interesse em ${product.name} da página ${workspace.name}.`); const contentItems = product.content?.items ?? []; const hasRepDbContent = contentItems.some((item) => item.exercise_library_id?.startsWith('repdb:')); const hasOpenExerciseContent = contentItems.some((item) => item.exercise_library_id?.startsWith('open:')); const hasVitalContent = contentItems.some((item) => item.exercise_library_id?.startsWith('vital:'))
  function addProduct() { if (product.booking_enabled && !appointment) { setAppointmentError('Escolha um horário disponível antes de continuar.'); return }; addToCart(product.id); navigate(`/p/${workspace.slug}/carrinho`) }
  return <section className="store-section"><Link className="back-link" to={`/p/${workspace.slug}`}>← Voltar à vitrine</Link><div className="store-detail"><ProductCover product={product} /><div><p className="eyebrow">{product.category ? categoryLabel[product.category] : label[product.kind]}{product.kind === 'digital' && product.level && product.level !== 'all' ? ` · ${levelLabel[product.level]}` : ''}</p><h1>{product.name}</h1><p>{product.description || 'Converse com o profissional para saber mais.'}</p>{product.service_area && <div className="detail-note">◎ Atendimento: {product.service_area}</div>}{product.booking_enabled && <EvaluationPicker product={product} selected={appointment} onSelect={selectAppointment} />}{appointmentError && <p className="form-error" role="alert">{appointmentError}</p>}<strong className="store-price">{product.price === null ? 'Preço a combinar' : currency.format(product.price)}</strong><div className="detail-actions">{product.price !== null && <button className="primary-button" onClick={addProduct}>Adicionar à sacola <span>＋</span></button>}{contact && <a href={contact} target="_blank" rel="noreferrer" className="secondary-button plain-link">Conversar no WhatsApp ↗</a>}</div>{!contact && product.price === null && <p className="field-help">Este profissional ainda não informou um WhatsApp para combinar o preço.</p>}<small>Pagamento confirmado diretamente pelo profissional. {product.booking_enabled ? 'O horário só será efetivado depois da conferência do Pix e da aprovação do profissional.' : product.access_mode === 'portal' || product.access_mode === 'both' ? 'Após a confirmação, o conteúdo é liberado em um portal protegido e vinculado ao primeiro dispositivo.' : 'A entrega é combinada pelo WhatsApp após a confirmação.'}</small></div></div>{product.kind === 'digital' && contentItems.length > 0 && <section className="product-content-preview"><div className="panel-heading"><div><span className="panel-kicker">Prévia do conteúdo</span><h2>Veja como o conteúdo é apresentado</h2></div><span className="content-lock-badge">Conteúdo completo após confirmação</span></div>{product.content?.intro && <p className="product-content-intro">{product.content.intro}</p>}<div className="content-motion-grid">{contentItems.map((item, index) => <ContentTag item={item} index={index} isWorkout={product.category === 'workout'} isDiet={product.category === 'diet'} key={`${item.title}-${index}`} />)}</div>{hasRepDbContent && <p className="exercise-source-credit">Ilustrações e dados de exercícios por <a href="https://repdb.co" target="_blank" rel="noreferrer">RepDB ↗</a>.</p>}{hasOpenExerciseContent && <p className="exercise-source-credit">Ilustrações abertas por <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">Free Exercise DB ↗</a>.</p>}{hasVitalContent && <p className="exercise-source-credit">Animações HD 3D por <a href="https://vitalanimations.com" target="_blank" rel="noreferrer">Vital Animations ↗</a>.</p>}</section>}</section>
}

export function StoreProductEnhanced() {
  const { id } = useParams(); const { workspace, products } = useStore(); const product = products.find((item) => item.id === id)
  if (!product) return <section className="store-section"><h1>Produto indisponível</h1><Link to={`/p/${workspace.slug}`}>Voltar para a vitrine</Link></section>
  return <StoreProductView product={product} />
}

function getDeviceId() {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('impulso_device_id='))
  if (cookie) return decodeURIComponent(cookie.slice('impulso_device_id='.length))
  const storageKey = 'impulso:device-id'
  const stored = localStorage.getItem(storageKey)
  if (stored) return stored
  const created = crypto.randomUUID()
  localStorage.setItem(storageKey, created)
  document.cookie = `impulso_device_id=${encodeURIComponent(created)}; Max-Age=31536000; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  return created
}

type ProtectedAccess = { products: Product[]; order_reference: string; expires_at: string }

export function StoreAccessEnhanced() {
  const { workspace } = useStore()
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '')
  const [deviceId] = useState(getDeviceId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [access, setAccess] = useState<ProtectedAccess | null>(null)

  async function openAccess(event?: FormEvent) {
    event?.preventDefault()
    if (!supabase || token.trim().length !== 48) { setError('Cole o link ou código de acesso recebido do profissional.'); return }
    setLoading(true); setError('')
    const result = await supabase.functions.invoke('access-product', { body: { token: token.trim().toLowerCase(), device_id: deviceId } })
    const products = (Array.isArray(result.data?.products) ? result.data.products : result.data?.product ? [result.data.product] : []) as Product[]
    if (result.error || !products.length) setError(result.error?.message || 'Não foi possível abrir este conteúdo.')
    else setAccess({ products, order_reference: String(result.data.order_reference), expires_at: String(result.data.expires_at) })
    setLoading(false)
  }

  const accessProducts = access?.products ?? []
  const allItems = accessProducts.flatMap((product) => product.content?.items ?? [])
  const hasRepDbContent = allItems.some((item) => item.exercise_library_id?.startsWith('repdb:'))
  const hasOpenExerciseContent = allItems.some((item) => item.exercise_library_id?.startsWith('open:'))
  const hasVitalContent = allItems.some((item) => item.exercise_library_id?.startsWith('vital:'))

  return <section className="store-section access-page"><Link className="back-link" to={`/p/${workspace.slug}`}>← Voltar à vitrine</Link>{!access ? <><p className="eyebrow">Área do cliente</p><h1>Acesse seu conteúdo</h1><p className="checkout-intro">Use o link recebido após a confirmação do pagamento. Ele reúne os conteúdos digitais deste pedido e fica vinculado ao primeiro dispositivo usado.</p><form className="panel access-form" onSubmit={(event) => void openAccess(event)}><label>Código de acesso<input autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Cole o código de 48 caracteres" /></label><button className="primary-button" disabled={loading}>{loading ? 'Validando…' : 'Abrir meu conteúdo'} <span>→</span></button>{error && <p className="form-error" role="alert">{error}</p>}</form><div className="access-safety-note"><strong>Proteção por dispositivo</strong><span>O token é validado no servidor, expira e fica vinculado ao primeiro dispositivo. Não compartilhe o link.</span></div></> : <><div className="page-intro"><div><p className="eyebrow">Conteúdo liberado · pedido {access.order_reference}</p><h1>{accessProducts.length > 1 ? 'Minha biblioteca' : accessProducts[0]?.name}</h1><p className="intro-description">{accessProducts.length} {accessProducts.length === 1 ? 'conteúdo liberado' : 'conteúdos liberados'} até {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(access.expires_at))}, neste dispositivo.</p></div><button className="secondary-button" onClick={() => window.print()}>Imprimir / salvar PDF</button></div><div className="access-product-list">{accessProducts.map((product) => { const items = product.content?.items ?? []; return <section className="access-product-block" key={product.id}><div className="access-product-heading"><div><span className="panel-kicker">{product.category ? categoryLabel[product.category] : 'Conteúdo digital'}</span><h2>{product.name}</h2></div><span className="content-lock-badge">Liberado</span></div>{product.content?.intro && <section className="panel access-intro"><p>{product.content.intro}</p></section>}{product.category === 'workout' && <WorkoutTimer product={product} />}<div className="access-motion-grid">{items.length ? items.map((item, index) => <article className="panel access-content-card" key={`${product.id}-${item.title}-${index}`}><MotionVisual item={item} diet={product.category === 'diet'} showEmbedded={product.category === 'workout'} /><div><span className="panel-kicker">Etapa {String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3>{item.meta && <strong>{item.meta}</strong>}<p>{item.details || 'Siga a orientação combinada com o profissional.'}</p></div></article>) : <section className="panel empty-panel"><h3>Conteúdo em preparação</h3><p>O profissional liberou o acesso, mas ainda está finalizando os detalhes.</p></section>}</div></section> })}</div>{hasRepDbContent && <p className="exercise-source-credit">Ilustrações e dados de exercícios por <a href="https://repdb.co" target="_blank" rel="noreferrer">RepDB ↗</a>.</p>}{hasOpenExerciseContent && <p className="exercise-source-credit">Ilustrações abertas por <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">Free Exercise DB ↗</a>.</p>}{hasVitalContent && <p className="exercise-source-credit">Animações HD 3D por <a href="https://vitalanimations.com" target="_blank" rel="noreferrer">Vital Animations ↗</a>.</p>}{error && <p className="form-error" role="alert">{error}</p>}</>}</section>
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export function AdminSettings() {
  const { workspace, refresh } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [serviceCities, setServiceCities] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [pixReceiver, setPixReceiver] = useState('')
  const [pixCity, setPixCity] = useState('')
  const [published, setPublished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!workspace) return
    setName(workspace.name)
    setDescription(workspace.description ?? '')
    setServiceCities(workspace.service_cities ?? '')
    setWhatsappNumber(workspace.whatsapp_number ?? '')
    setPixKey(workspace.pix_key ?? '')
    setPixReceiver(workspace.pix_receiver ?? '')
    setPixCity(workspace.pix_city ?? '')
    setPublished(workspace.published)
  }, [workspace?.id])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace) return
    const digits = whatsappNumber.replace(/\D/g, '')
    if (digits && !/^55\d{10,11}$/.test(digits)) { setError('Use o WhatsApp com DDI 55 e DDD. Ex.: 5511999999999.'); return }
    setBusy(true); setError(''); setMessage('')
    const { error: updateError } = await supabase.from('workspaces').update({ name: name.trim(), description: description.trim() || null, service_cities: serviceCities.trim() || null, whatsapp_number: digits || null, pix_key: pixKey.trim() || null, pix_receiver: pixReceiver.trim() || null, pix_city: pixCity.trim() || null, published, updated_at: new Date().toISOString() }).eq('id', workspace.id)
    if (updateError) setError(updateError.message)
    else { await refresh(); setMessage('Configurações salvas.') }
    setBusy(false)
  }

  return <><div className="page-intro"><div><p className="eyebrow">Sua marca</p><h1>Configurações</h1><p className="intro-description">Tudo que aparece para seus clientes na vitrine pública.</p></div>{workspace?.published && <Link className="secondary-button plain-link" to={`/p/${workspace.slug}`} target="_blank">Abrir vitrine ↗</Link>}</div><section className="panel editor-panel"><form className="form-grid" onSubmit={(event) => void save(event)}><div className="form-row"><label>Nome público<input required minLength={3} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Endereço da página<input readOnly value={`/p/${workspace?.slug ?? ''}`} title="O endereço é definido na criação do espaço." /></label></div><label>Apresentação<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Conte quem você é e o que oferece." /></label><label>Cidades ou locais atendidos<input value={serviceCities} onChange={(event) => setServiceCities(event.target.value)} placeholder="Online, São Paulo e região" /></label><div className="form-row"><label>WhatsApp Business com DDI<input type="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="5511999999999" /></label><label>Chave Pix<input value={pixKey} onChange={(event) => setPixKey(event.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" /></label></div><div className="form-row"><label>Nome do recebedor Pix<input value={pixReceiver} onChange={(event) => setPixReceiver(event.target.value)} placeholder="Nome cadastrado no banco" /></label><label>Cidade do recebedor Pix<input value={pixCity} onChange={(event) => setPixCity(event.target.value)} placeholder="São Paulo" /></label></div><p className="field-help">Os dados Pix e o WhatsApp aparecem na vitrine publicada. O código Pix com valor será gerado no checkout quando chave, recebedor e cidade estiverem preenchidos. A confirmação do pagamento é manual.</p><label className="check-row"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publicar minha vitrine</label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar configurações'} <span>→</span></button></form></section></>
}

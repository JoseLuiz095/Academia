import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AppointmentSelection, EvaluationSlot, Product } from '../types'
import { AlertCard } from './AlertCard'

export function EvaluationPicker({ product, selected, onSelect }: { product: Product; selected: AppointmentSelection | null; onSelect: (slot: AppointmentSelection | null) => void }) {
  const [slots, setSlots] = useState<EvaluationSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('A agenda está temporariamente indisponível.'); setLoading(false); return }
      const start = new Date(); const end = new Date(); end.setDate(end.getDate() + 45)
      const result = await supabase.rpc('get_evaluation_slots', { target_product_id: product.id, from_date: start.toISOString().slice(0, 10), to_date: end.toISOString().slice(0, 10) })
      if (!active) return
      setSlots((result.data ?? []) as EvaluationSlot[])
      setError(result.error ? 'Não foi possível carregar os horários. Atualize a página e tente novamente.' : '')
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [product.id])
  const grouped = slots.reduce<Record<string, EvaluationSlot[]>>((groups, slot) => { (groups[slot.scheduled_date] ??= []).push(slot); return groups }, {})
  return <div className="appointment-picker"><div className="panel-heading"><div><span className="panel-kicker">Pré-agendamento</span><h2>Escolha um horário</h2></div><span className="appointment-badge">Não confirmado ainda</span></div><p className="field-help">Você escolhe uma opção, paga via Pix e envia o comprovante pelo WhatsApp. O profissional confirma o pagamento e aprova o horário manualmente.</p>{error && <AlertCard message={error} onDismiss={() => setError('')} />}{loading ? <p className="empty-copy">Carregando agenda…</p> : error ? <p className="form-error" role="alert">{error}</p> : Object.keys(grouped).length ? <div className="appointment-days">{Object.entries(grouped).map(([date, daySlots]) => <div className="appointment-day" key={date}><strong>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${date}T12:00:00`))}</strong><div className="appointment-slots">{daySlots.map((slot) => { const isSelected = selected?.availability_id === slot.availability_id && selected.scheduled_date === slot.scheduled_date && selected.scheduled_start === slot.scheduled_start; return <button type="button" className={isSelected ? 'appointment-slot selected' : 'appointment-slot'} key={`${slot.scheduled_date}-${slot.scheduled_start}-${slot.location}`} aria-pressed={isSelected} onClick={() => onSelect(isSelected ? null : { product_id: product.id, availability_id: slot.availability_id, scheduled_date: slot.scheduled_date, scheduled_start: slot.scheduled_start, scheduled_end: slot.scheduled_end, location: slot.location })}><span>{slot.scheduled_start.slice(0, 5)}</span><small>{slot.location}</small></button> })}</div></div>)}</div> : <div className="availability-empty">Nenhum horário disponível nos próximos dias. Fale com o profissional pelo WhatsApp.</div>}{selected && <p className="form-success" role="status">Pré-selecionado: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${selected.scheduled_date}T12:00:00`))} às {selected.scheduled_start.slice(0, 5)} · {selected.location}</p>}</div>
}

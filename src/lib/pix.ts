// BR Code estático para pagamento manual. O profissional confirma o crédito no banco.
function field(id: string, value: string) {
  if (value.length > 99) throw new Error(`Campo Pix ${id} muito longo.`)
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function safeText(value: string, max: number) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max)
}

function crc16(value: string) {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buildPixCopyPaste(input: { key: string; receiver: string; city: string; amount: number }) {
  const key = input.key.trim()
  const receiver = safeText(input.receiver, 25)
  const city = safeText(input.city, 15)
  if (!key || !receiver || !city) throw new Error('Complete chave, nome e cidade do recebedor Pix.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Valor Pix inválido.')
  const merchant = field('00', 'BR.GOV.BCB.PIX') + field('01', key)
  const payload = [
    field('00', '01'), field('26', merchant), field('52', '0000'), field('53', '986'),
    field('54', input.amount.toFixed(2)), field('58', 'BR'), field('59', receiver),
    field('60', city), field('62', field('05', '***')),
  ].join('') + '6304'
  return payload + crc16(payload)
}

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

type PixField = { id: string; value: string }

function parseFields(payload: string): PixField[] {
  const fields: PixField[] = []
  let cursor = 0
  while (cursor < payload.length) {
    const id = payload.slice(cursor, cursor + 2)
    const size = payload.slice(cursor + 2, cursor + 4)
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(size)) throw new Error('Pix copia e cola inválido.')
    const end = cursor + 4 + Number(size)
    if (end > payload.length) throw new Error('Pix copia e cola incompleto.')
    fields.push({ id, value: payload.slice(cursor + 4, end) })
    cursor = end
  }
  return fields
}

export function isPixCopyPaste(value: string) {
  return value.trim().startsWith('000201')
}

export function validateStaticPixBase(raw: string) {
  const value = raw.trim().replace(/[\r\n\t]/g, '')
  if (!isPixCopyPaste(value) || value.length > 1024 || !/^[\x20-\x7E]+$/.test(value)) throw new Error('Informe um Pix copia e cola estático válido.')
  const fields = parseFields(value)
  const merchant = fields.find((item) => item.id === '26')
  const nested = merchant ? parseFields(merchant.value) : []
  if (nested.find((item) => item.id === '25')) throw new Error('Pix dinâmico não permite ajustar o valor. Use um Pix estático ou uma chave Pix.')
  if (nested.find((item) => item.id === '00')?.value.toUpperCase() !== 'BR.GOV.BCB.PIX' || !nested.find((item) => item.id === '01')?.value) throw new Error('O código não contém uma chave Pix estática.')
  if (fields.find((item) => item.id === '53')?.value !== '986' || fields.find((item) => item.id === '58')?.value !== 'BR' || !fields.find((item) => item.id === '59')?.value || !fields.find((item) => item.id === '60')?.value) throw new Error('O código Pix está incompleto.')
  const checksum = fields.at(-1)
  if (checksum?.id !== '63' || !/^[0-9A-Fa-f]{4}$/.test(checksum.value) || crc16(value.slice(0, -4)).toUpperCase() !== checksum.value.toUpperCase()) throw new Error('O código Pix está com verificação inválida.')
  return value
}

export function buildPixFromStaticBase(raw: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Valor Pix inválido.')
  const fields = parseFields(validateStaticPixBase(raw)).filter((item) => item.id !== '54' && item.id !== '63')
  const insertAt = fields.findIndex((item) => item.id === '58')
  fields.splice(insertAt, 0, { id: '54', value: amount.toFixed(2) })
  const payload = fields.map((item) => field(item.id, item.value)).join('') + '6304'
  return payload + crc16(payload)
}

export function readStaticPixReceiver(raw: string) {
  return parseFields(validateStaticPixBase(raw)).find((item) => item.id === '59')?.value ?? ''
}

export function buildPixCopyPaste(input: { key: string; receiver: string; city: string; amount: number }) {
  const key = input.key.trim()
  const receiver = safeText(input.receiver, 25)
  const city = safeText(input.city, 15)
  if (!key || !receiver || !city) throw new Error('Complete chave, nome e cidade do recebedor Pix.')
  if (key.length > 77) throw new Error('Chave Pix muito longa.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Valor Pix inválido.')
  const merchant = field('00', 'BR.GOV.BCB.PIX') + field('01', key)
  const payload = [
    field('00', '01'), field('26', merchant), field('52', '0000'), field('53', '986'),
    field('54', input.amount.toFixed(2)), field('58', 'BR'), field('59', receiver),
    field('60', city), field('62', field('05', '***')),
  ].join('') + '6304'
  return payload + crc16(payload)
}

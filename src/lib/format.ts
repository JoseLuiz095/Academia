export const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function normalizeSlug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function whatsappLink(phone: string | null, message: string) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!/^\d{12,13}$/.test(digits)) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export function firstFireAt(triggerAt: Date, daysBefore: number | null | undefined): Date {
  const d = new Date(triggerAt.getTime())
  const n = daysBefore ?? 0
  if (n > 0) d.setUTCDate(d.getUTCDate() - n)
  return d
}

export function nextAnchor(anchor: Date, recurrence: Recurrence): Date | null {
  if (recurrence === 'none') return null
  const n = new Date(anchor.getTime())
  switch (recurrence) {
    case 'daily':
      n.setUTCDate(n.getUTCDate() + 1)
      return n
    case 'weekly':
      n.setUTCDate(n.getUTCDate() + 7)
      return n
    case 'monthly':
      n.setUTCMonth(n.getUTCMonth() + 1)
      return n
    case 'yearly':
      n.setUTCFullYear(n.getUTCFullYear() + 1)
      return n
    default:
      return null
  }
}

export function yearsSinceReference(referenceDate: string | Date, from: Date = new Date()): number {
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate
  const ms = from.getTime() - ref.getTime()
  return Math.max(0, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)))
}

export function buildNotificationBody(input: {
  kind: string
  title: string
  notes: string | null
  reference_date: string | null
  amount: number | null
}): string {
  if (input.kind === 'pet_memorial' && input.reference_date) {
    const y = yearsSinceReference(input.reference_date)
    const extra = input.notes?.trim() ? ` — ${input.notes.trim()}` : ''
    return `Hace ${y} año${y === 1 ? '' : 's'}${extra}`
  }
  if (input.kind === 'service_payment' && input.amount != null && input.amount > 0) {
    const money = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(input.amount)
    const extra = input.notes?.trim() ? ` — ${input.notes.trim()}` : ''
    return `${money}${extra}`
  }
  return (input.notes ?? '').trim()
}

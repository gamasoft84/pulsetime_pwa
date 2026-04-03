export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Parsea entrada de formulario; `null` si vacío o inválido. */
export function parseMoneyInput(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const s = String(raw).trim().replace(',', '.')
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return roundMoney(n)
}

export function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return roundMoney(n)
}

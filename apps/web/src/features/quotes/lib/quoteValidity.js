export function normalizeQuoteValidityDays(value, fallback = 15) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value)

  const text = String(value || '').trim().toLowerCase()
  if (!text) return fallback

  const numericValue = Number(text.match(/\d+/)?.[0])
  if (Number.isFinite(numericValue) && numericValue > 0) return numericValue

  if (text.includes('seven') || text.includes('week')) return 7
  if (text.includes('fifteen')) return 15
  if (text.includes('thirty') || text.includes('month')) return 30

  return fallback
}

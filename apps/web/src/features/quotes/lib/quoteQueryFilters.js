const LOCAL_FILTER_SPECIAL_KEYS = new Set(['search', 'date_from', 'date_to'])

function isEmptyFilterValue(value) {
  return value === undefined || value === null || value === ''
}

export function applyRemoteQuoteFilters(query, filters = {}) {
  let nextQuery = query

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (isEmptyFilterValue(value)) return

    if (key === 'search') {
      nextQuery = nextQuery.or(`quote_number.ilike.%${value}%,client_name.ilike.%${value}%,event_name.ilike.%${value}%`)
      return
    }

    if (key === 'date_from') {
      nextQuery = nextQuery.gte('created_at', value)
      return
    }

    if (key === 'date_to') {
      nextQuery = nextQuery.lte('created_at', value)
      return
    }

    if (Array.isArray(value)) {
      nextQuery = nextQuery.in(key, value)
      return
    }

    nextQuery = nextQuery.eq(key, value)
  })

  return nextQuery
}

export function getLocalQuoteSearchText(quote = {}) {
  return [
    quote.quote_number,
    quote.client_name,
    quote.event_name,
  ].filter(Boolean).join(' ').toLowerCase()
}

function matchesLocalDateRange(quote = {}, filters = {}) {
  const createdAt = String(quote.created_at || '')

  if (filters.date_from && createdAt < filters.date_from) return false
  if (filters.date_to && createdAt > filters.date_to) return false
  return true
}

function matchesLocalSearch(quote = {}, search = '') {
  if (!search) return true
  return getLocalQuoteSearchText(quote).includes(String(search).toLowerCase())
}

function matchesLocalFilterValue(quote = {}, key, value) {
  if (LOCAL_FILTER_SPECIAL_KEYS.has(key)) return true
  if (isEmptyFilterValue(value)) return true
  if (Array.isArray(value)) return value.includes(quote[key])
  return quote[key] === value
}

export function matchesActiveLocalQuoteFilters(quote = {}, filters = {}) {
  if (quote.deleted_at) return false
  if (!matchesLocalSearch(quote, filters.search)) return false
  if (!matchesLocalDateRange(quote, filters)) return false

  return Object.entries(filters || {}).every(([key, value]) => matchesLocalFilterValue(quote, key, value))
}

export function applyLocalQuoteFilters(quotes = [], filters = {}) {
  return quotes.filter(quote => matchesActiveLocalQuoteFilters(quote, filters))
}

export function buildQuoteApiPath(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (isEmptyFilterValue(value)) return

    if (key === 'filters') {
      Object.entries(value || {}).forEach(([filterKey, filterValue]) => {
        if (isEmptyFilterValue(filterValue)) return
        if (Array.isArray(filterValue)) {
          if (filterValue.length) searchParams.set(filterKey, filterValue.join(','))
          return
        }
        searchParams.set(filterKey, String(filterValue))
      })
      return
    }

    searchParams.set(key, String(value))
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

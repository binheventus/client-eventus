import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getQuoteUserContext, normalizeQuoteUserContext } from '../lib/quoteAuth'
import {
  buildAccessibleQuoteFilters,
  DEFAULT_QUOTE_LIST_FILTERS,
  getAutoLoadFilterKey,
  getTotalQuotePages,
  QUOTE_LIST_PAGE_SIZE,
} from '../lib/quoteList'
import { listQuotes } from './useQuotes'

export function useQuoteList({ pageSize = QUOTE_LIST_PAGE_SIZE } = {}) {
  const initialUserContext = useMemo(() => getQuoteUserContext(), [])
  const [userContext, setUserContext] = useState(initialUserContext)
  const [quotes, setQuotes] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(DEFAULT_QUOTE_LIST_FILTERS)
  const requestIdRef = useRef(0)

  const totalPages = useMemo(() => getTotalQuotePages(count, pageSize), [count, pageSize])
  const autoLoadFilterKey = useMemo(() => getAutoLoadFilterKey(filters), [filters])

  const fetchQuotes = useCallback(async ({ requestedPage, requestedFilters } = {}) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError('')

    try {
      const effectiveFilters = buildAccessibleQuoteFilters(requestedFilters)
      const result = await listQuotes({
        filters: effectiveFilters,
        page: requestedPage,
        pageSize,
      })

      if (requestId !== requestIdRef.current) return result

      setQuotes(result.quotes)
      setCount(result.count)
      if (result.current_user) {
        setUserContext(prev => normalizeQuoteUserContext(result.current_user, prev))
      }
      return result
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err?.message || 'Không tải được danh sách báo giá.')
      }
      return null
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    fetchQuotes({ requestedPage: page, requestedFilters: filters })
  }, [page, autoLoadFilterKey, fetchQuotes])

  const updateFilter = useCallback((key, value) => {
    setPage(1)
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const reload = useCallback(() => (
    fetchQuotes({ requestedPage: page, requestedFilters: filters })
  ), [fetchQuotes, filters, page])

  return {
    quotes,
    count,
    page,
    setPage,
    totalPages,
    loading,
    error,
    filters,
    updateFilter,
    reload,
    userContext,
  }
}

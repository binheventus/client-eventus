import { useCallback, useEffect, useState } from 'react'
import { fromQuoteTable, hasSupabaseConfig } from '../../../lib/supabase'

let servicesCache = null
let servicesPromise = null

export async function fetchActiveServices({ force = false } = {}) {
  if (!hasSupabaseConfig) throw new Error('Thiếu cấu hình Supabase.')
  if (servicesCache && !force) return servicesCache
  if (servicesPromise && !force) return servicesPromise

  servicesPromise = fromQuoteTable('services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .then(({ data, error }) => {
      if (error) throw error
      servicesCache = data || []
      return servicesCache
    })
    .finally(() => {
      servicesPromise = null
    })

  return servicesPromise
}

export function useServices() {
  const [services, setServices] = useState(() => servicesCache || [])
  const [loading, setLoading] = useState(() => !servicesCache)
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ force = false } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const rows = await fetchActiveServices({ force })
      setServices(rows)
      return rows
    } catch (err) {
      setError(err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!servicesCache) refetch()
  }, [refetch])

  return { services, loading, error, refetch }
}

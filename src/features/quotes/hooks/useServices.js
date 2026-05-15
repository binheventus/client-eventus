import { useCallback, useEffect, useState } from 'react'
import servicesData from '../../../data/pricing/services.json'

let servicesCache = null

export async function fetchActiveServices({ force = false } = {}) {
  if (servicesCache && !force) return servicesCache

  servicesCache = [...servicesData]
    .filter(row => row?.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
  return servicesCache
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

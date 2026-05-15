import { useCallback, useEffect, useMemo, useState } from 'react'
import { fromQuoteTable, hasSupabaseConfig } from '../../../lib/supabase'

let legalEntitiesCache = null
let legalEntitiesPromise = null

export async function fetchActiveLegalEntities({ force = false } = {}) {
  if (!hasSupabaseConfig) throw new Error('Thiếu cấu hình Supabase.')
  if (legalEntitiesCache && !force) return legalEntitiesCache
  if (legalEntitiesPromise && !force) return legalEntitiesPromise

  legalEntitiesPromise = fromQuoteTable('legalEntities')
    .select('*')
    .eq('is_active', true)
    .then(({ data, error }) => {
      if (error) throw error
      legalEntitiesCache = data || []
      return legalEntitiesCache
    })
    .finally(() => {
      legalEntitiesPromise = null
    })

  return legalEntitiesPromise
}

export function useLegalEntities() {
  const [legalEntities, setLegalEntities] = useState(() => legalEntitiesCache || [])
  const [loading, setLoading] = useState(() => !legalEntitiesCache)
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ force = false } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const rows = await fetchActiveLegalEntities({ force })
      setLegalEntities(rows)
      return rows
    } catch (err) {
      setError(err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const getDefaultEntity = useCallback(() => (
    legalEntities.find(row => row?.is_default) || legalEntities[0] || null
  ), [legalEntities])

  useEffect(() => {
    if (!legalEntitiesCache) refetch()
  }, [refetch])

  return useMemo(() => ({
    legalEntities,
    loading,
    error,
    refetch,
    getDefaultEntity,
  }), [legalEntities, loading, error, refetch, getDefaultEntity])
}

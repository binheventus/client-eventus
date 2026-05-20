import { useCallback, useEffect, useMemo, useState } from 'react'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'

let legalEntitiesCache = null

export async function fetchActiveLegalEntities({ force = false } = {}) {
  if (legalEntitiesCache && !force) return legalEntitiesCache

  legalEntitiesCache = [...legalEntitiesData]
    .filter(row => row?.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
  return legalEntitiesCache
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

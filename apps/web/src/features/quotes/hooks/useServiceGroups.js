import { useCallback, useEffect, useMemo, useState } from 'react'

let serviceGroupsCache = null

export async function fetchActiveServiceGroups({ force = false } = {}) {
  if (serviceGroupsCache && !force) return serviceGroupsCache

  serviceGroupsCache = []
  return serviceGroupsCache
}

export function useServiceGroups() {
  const [serviceGroups, setServiceGroups] = useState(() => serviceGroupsCache || [])
  const [loading, setLoading] = useState(() => !serviceGroupsCache)
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ force = false } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const rows = await fetchActiveServiceGroups({ force })
      setServiceGroups(rows)
      return rows
    } catch (err) {
      setError(err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!serviceGroupsCache) refetch()
  }, [refetch])

  const getGroupByCode = useCallback((groupCode = '') => {
    const code = String(groupCode || '').trim().toUpperCase()
    return serviceGroups.find(row => row.group_code === code) || null
  }, [serviceGroups])

  return useMemo(() => ({
    serviceGroups,
    loading,
    error,
    refetch,
    getGroupByCode,
  }), [serviceGroups, loading, error, refetch, getGroupByCode])
}

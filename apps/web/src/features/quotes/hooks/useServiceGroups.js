import { useCallback, useEffect, useMemo, useState } from 'react'
import serviceGroupsData from '../../../data/pricing/service_groups.json'

let serviceGroupsCache = null

function normalizeGroup(row = {}, index = 0) {
  const groupCode = String(row.group_code || '').trim().toUpperCase()
  return {
    ...row,
    group_code: groupCode,
    group_label: String(row.group_label || groupCode || 'Hạng mục').trim(),
    group_sort_order: Number(row.group_sort_order || index + 1),
    is_active: row.is_active !== false,
  }
}

export async function fetchActiveServiceGroups({ force = false } = {}) {
  if (serviceGroupsCache && !force) return serviceGroupsCache

  serviceGroupsCache = [...serviceGroupsData]
    .map(normalizeGroup)
    .filter(row => row.group_code && row.is_active !== false)
    .sort((a, b) => Number(a.group_sort_order || 99) - Number(b.group_sort_order || 99))
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

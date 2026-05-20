import { useCallback, useEffect, useMemo, useState } from 'react'
import customerTiersData from '../../../data/pricing/customer_tiers.json'

let customerTiersCache = null

export async function fetchCustomerTiers({ force = false } = {}) {
  if (customerTiersCache && !force) return customerTiersCache

  customerTiersCache = [...customerTiersData]
  return customerTiersCache
}

export function useCustomerTiers() {
  const [customerTiers, setCustomerTiers] = useState(() => customerTiersCache || [])
  const [loading, setLoading] = useState(() => !customerTiersCache)
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ force = false } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const rows = await fetchCustomerTiers({ force })
      setCustomerTiers(rows)
      return rows
    } catch (err) {
      setError(err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const getTierByCode = useCallback((tierCode) => (
    customerTiers.find(row => row?.tier_code === tierCode || row?.code === tierCode) || null
  ), [customerTiers])

  useEffect(() => {
    if (!customerTiersCache) refetch()
  }, [refetch])

  return useMemo(() => ({
    customerTiers,
    loading,
    error,
    refetch,
    getTierByCode,
  }), [customerTiers, loading, error, refetch, getTierByCode])
}

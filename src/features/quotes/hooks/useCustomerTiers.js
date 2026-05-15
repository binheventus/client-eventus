import { useCallback, useEffect, useMemo, useState } from 'react'
import { fromQuoteTable, hasSupabaseConfig } from '../../../lib/supabase'

let customerTiersCache = null
let customerTiersPromise = null

export async function fetchCustomerTiers({ force = false } = {}) {
  if (!hasSupabaseConfig) throw new Error('Thiếu cấu hình Supabase.')
  if (customerTiersCache && !force) return customerTiersCache
  if (customerTiersPromise && !force) return customerTiersPromise

  customerTiersPromise = fromQuoteTable('customerTiers')
    .select('*')
    .then(({ data, error }) => {
      if (error) throw error
      customerTiersCache = data || []
      return customerTiersCache
    })
    .finally(() => {
      customerTiersPromise = null
    })

  return customerTiersPromise
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

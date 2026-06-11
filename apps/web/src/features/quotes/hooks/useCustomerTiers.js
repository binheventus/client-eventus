import { useCallback, useMemo } from 'react'
import { fetchPricingContext } from '../lib/pricingContextClient'
import { usePricingContext } from './usePricingContext'

export async function fetchCustomerTiers({ force = false } = {}) {
  const context = await fetchPricingContext({ force })
  return context.customerTiers || []
}

export function useCustomerTiers() {
  const { pricingContext, loading, error, refetch } = usePricingContext()
  const customerTiers = pricingContext.customerTiers || []

  const getTierByCode = useCallback((tierCode) => (
    customerTiers.find(row => row?.tier_code === tierCode || row?.code === tierCode) || null
  ), [customerTiers])

  return useMemo(() => ({
    customerTiers,
    loading,
    error,
    refetch: async (options) => (await refetch(options)).customerTiers || [],
    getTierByCode,
  }), [customerTiers, loading, error, refetch, getTierByCode])
}

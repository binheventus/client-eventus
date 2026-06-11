import { useMemo } from 'react'
import { fetchPricingContext } from '../lib/pricingContextClient'
import { usePricingContext } from './usePricingContext'

export async function fetchActiveServices({ force = false } = {}) {
  const context = await fetchPricingContext({ force })
  return context.services || []
}

export function useServices() {
  const { pricingContext, loading, error, refetch } = usePricingContext()
  const services = pricingContext.services || []

  return useMemo(() => ({
    services,
    loading,
    error,
    refetch: async (options) => (await refetch(options)).services || [],
  }), [services, loading, error, refetch])
}

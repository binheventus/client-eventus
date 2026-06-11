import { useCallback, useMemo } from 'react'
import { fetchPricingContext } from '../lib/pricingContextClient'
import { usePricingContext } from './usePricingContext'

export async function fetchActiveLegalEntities({ force = false } = {}) {
  const context = await fetchPricingContext({ force })
  return context.legalEntities || []
}

export function useLegalEntities() {
  const { pricingContext, loading, error, refetch } = usePricingContext()
  const legalEntities = pricingContext.legalEntities || []

  const getDefaultEntity = useCallback(() => (
    legalEntities.find(row => row?.is_default) || legalEntities[0] || null
  ), [legalEntities])

  return useMemo(() => ({
    legalEntities,
    loading,
    error,
    refetch: async (options) => (await refetch(options)).legalEntities || [],
    getDefaultEntity,
  }), [legalEntities, loading, error, refetch, getDefaultEntity])
}

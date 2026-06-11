import { useMemo } from 'react'
import { fetchPricingContext } from '../lib/pricingContextClient'
import { usePricingContext } from './usePricingContext'

export async function fetchActiveEquipmentRules({ force = false } = {}) {
  const context = await fetchPricingContext({ force })
  return context.equipmentRules || []
}

export function useEquipmentRules() {
  const { pricingContext, loading, error, refetch } = usePricingContext()
  const equipmentRules = pricingContext.equipmentRules || []

  return useMemo(() => ({
    equipmentRules,
    loading,
    error,
    refetch: async (options) => (await refetch(options)).equipmentRules || [],
  }), [equipmentRules, loading, error, refetch])
}

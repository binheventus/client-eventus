import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPricingContext, getCachedPricingContext, getPricingWarning } from '../lib/pricingContextClient'

const EMPTY_PRICING_CONTEXT = {
  services: [],
  travel_fees: [],
  travelFees: [],
  customer_tiers: [],
  customerTiers: [],
  business_rules: [],
  businessRulesRows: [],
  businessRules: {},
  legal_entities: [],
  legalEntities: [],
  equipment_rules: [],
  equipmentRules: [],
  meta: {},
}

export function usePricingContext() {
  const [pricingContext, setPricingContext] = useState(() => getCachedPricingContext() || EMPTY_PRICING_CONTEXT)
  const [loading, setLoading] = useState(() => !getCachedPricingContext())
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ force = false } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const context = await fetchPricingContext({ force })
      setPricingContext(context)
      return context
    } catch (err) {
      setError(err)
      return EMPTY_PRICING_CONTEXT
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getCachedPricingContext()) refetch()
  }, [refetch])

  const warning = getPricingWarning(pricingContext.meta)

  return useMemo(() => ({
    pricingContext,
    pricingMeta: pricingContext.meta || {},
    pricingWarning: warning,
    loading,
    error,
    refetch,
  }), [pricingContext, warning, loading, error, refetch])
}

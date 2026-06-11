import { useCallback, useMemo } from 'react'
import { buildBusinessRulesMap, fetchPricingContext } from '../lib/pricingContextClient'
import { usePricingContext } from './usePricingContext'

export async function fetchBusinessRules({ force = false } = {}) {
  const context = await fetchPricingContext({ force })
  const rules = context.businessRulesRows || context.business_rules || []
  return {
    rules,
    rulesMap: context.businessRules || buildBusinessRulesMap(rules),
  }
}

export function useBusinessRules() {
  const { pricingContext, loading, error, refetch } = usePricingContext()
  const businessRules = pricingContext.businessRulesRows || pricingContext.business_rules || []
  const rulesMap = pricingContext.businessRules || {}

  const getRule = useCallback((ruleCode) => rulesMap?.[ruleCode] ?? null, [rulesMap])
  const getRulesByCategory = useCallback((category) => (
    businessRules.filter(row => row?.category === category || row?.rule_category === category)
  ), [businessRules])

  return useMemo(() => ({
    businessRules,
    rulesMap,
    loading,
    error,
    refetch: async (options) => {
      const context = await refetch(options)
      const rules = context.businessRulesRows || context.business_rules || []
      return {
        rules,
        rulesMap: context.businessRules || buildBusinessRulesMap(rules),
      }
    },
    getRule,
    getRulesByCategory,
  }), [businessRules, rulesMap, loading, error, refetch, getRule, getRulesByCategory])
}

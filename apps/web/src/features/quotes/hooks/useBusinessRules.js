import { useCallback, useEffect, useMemo, useState } from 'react'
import businessRulesData from '../../../data/pricing/business_rules.json'

let businessRulesCache = null
let businessRulesMapCache = null

function getRuleCode(row) {
  return row?.rule_code || row?.code || row?.key
}

function getRuleValue(row) {
  return row?.rule_value ?? row?.value ?? row?.config_value ?? null
}

function buildRulesMap(rows = []) {
  return rows.reduce((acc, row) => {
    const code = getRuleCode(row)
    if (code) acc[code] = getRuleValue(row)
    return acc
  }, {})
}

export async function fetchBusinessRules({ force = false } = {}) {
  if (businessRulesCache && !force) {
    return { rules: businessRulesCache, rulesMap: businessRulesMapCache }
  }

  businessRulesCache = [...businessRulesData]
  businessRulesMapCache = buildRulesMap(businessRulesCache)
  return { rules: businessRulesCache, rulesMap: businessRulesMapCache }
}

export function useBusinessRules() {
  const [businessRules, setBusinessRules] = useState(() => businessRulesCache || [])
  const [rulesMap, setRulesMap] = useState(() => businessRulesMapCache || {})
  const [loading, setLoading] = useState(() => !businessRulesCache)
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ force = false } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchBusinessRules({ force })
      setBusinessRules(result.rules)
      setRulesMap(result.rulesMap)
      return result
    } catch (err) {
      setError(err)
      return { rules: [], rulesMap: {} }
    } finally {
      setLoading(false)
    }
  }, [])

  const getRule = useCallback((ruleCode) => rulesMap?.[ruleCode] ?? null, [rulesMap])
  const getRulesByCategory = useCallback((category) => (
    businessRules.filter(row => row?.category === category || row?.rule_category === category)
  ), [businessRules])

  useEffect(() => {
    if (!businessRulesCache) refetch()
  }, [refetch])

  return useMemo(() => ({
    businessRules,
    rulesMap,
    loading,
    error,
    refetch,
    getRule,
    getRulesByCategory,
  }), [businessRules, rulesMap, loading, error, refetch, getRule, getRulesByCategory])
}

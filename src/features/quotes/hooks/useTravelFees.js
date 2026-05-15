import { useCallback, useEffect, useMemo, useState } from 'react'
import travelFeesData from '../../../data/pricing/travel_fees.json'

let travelFeesCache = null

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function rowLocationText(row) {
  return normalizeText([
    row?.location,
    row?.location_name,
    row?.province,
    row?.city,
    row?.area,
  ].filter(Boolean).join(' '))
}

function rowConditionText(row) {
  return normalizeText(row?.condition || row?.travel_condition || row?.distance_condition || row?.fee_condition)
}

export function findTravelFee(travelFees = [], location, condition) {
  const normalizedLocation = normalizeText(location)
  const normalizedCondition = normalizeText(condition)

  return (travelFees || []).find(row => {
    const locationText = rowLocationText(row)
    const conditionText = rowConditionText(row)
    const matchesLocation = !normalizedLocation || locationText.includes(normalizedLocation) || normalizedLocation.includes(locationText)
    const matchesCondition = !normalizedCondition || !conditionText || conditionText === normalizedCondition || conditionText.includes(normalizedCondition)
    return matchesLocation && matchesCondition
  }) || null
}

export async function fetchActiveTravelFees({ force = false } = {}) {
  if (travelFeesCache && !force) return travelFeesCache

  travelFeesCache = [...travelFeesData]
    .filter(row => row?.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
  return travelFeesCache
}

export function useTravelFees() {
  const [travelFees, setTravelFees] = useState(() => travelFeesCache || [])
  const [loading, setLoading] = useState(() => !travelFeesCache)
  const [error, setError] = useState(null)

  const refetch = useCallback(async ({ force = false } = {}) => {
    setLoading(true)
    setError(null)

    try {
      const rows = await fetchActiveTravelFees({ force })
      setTravelFees(rows)
      return rows
    } catch (err) {
      setError(err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const getTravelFee = useCallback((location, condition) => (
    findTravelFee(travelFees, location, condition)
  ), [travelFees])

  useEffect(() => {
    if (!travelFeesCache) refetch()
  }, [refetch])

  return useMemo(() => ({ travelFees, loading, error, refetch, getTravelFee }), [travelFees, loading, error, refetch, getTravelFee])
}

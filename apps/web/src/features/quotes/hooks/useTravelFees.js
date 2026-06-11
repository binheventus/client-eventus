import { useCallback, useMemo } from 'react'
import { fetchPricingContext } from '../lib/pricingContextClient'
import { usePricingContext } from './usePricingContext'

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
  const context = await fetchPricingContext({ force })
  return context.travelFees || []
}

export function useTravelFees() {
  const { pricingContext, loading, error, refetch } = usePricingContext()
  const travelFees = pricingContext.travelFees || []

  const getTravelFee = useCallback((location, condition) => (
    findTravelFee(travelFees, location, condition)
  ), [travelFees])

  return useMemo(() => ({
    travelFees,
    loading,
    error,
    refetch: async (options) => (await refetch(options)).travelFees || [],
    getTravelFee,
  }), [travelFees, loading, error, refetch, getTravelFee])
}

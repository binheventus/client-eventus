import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey)
export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null

export const quoteTables = {
  services: 'services',
  travelFees: 'travel_fees',
  customerTiers: 'customer_tiers',
  businessRules: 'business_rules',
  legalEntities: 'legal_entities',
  clients: 'clients',
  quotes: 'quotes',
  quoteItems: 'quote_items',
  quoteViews: 'quote_views',
  activeQuotes: 'active_quotes',
  trashedQuotes: 'trashed_quotes',
  auditLogs: 'audit_logs',
}

export function fromQuoteTable(tableKey) {
  if (!supabase) {
    throw new Error('Thiếu cấu hình Supabase.')
  }

  const tableName = quoteTables[tableKey] || tableKey
  return supabase.from(tableName)
}

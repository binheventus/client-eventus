export { default as QuoteListPage } from './pages/QuoteListPage'
export { default as QuoteCreatePage } from './pages/QuoteCreatePage'
export { default as QuoteDetailPage } from './pages/QuoteDetailPage'
export { default as QuotePublicPage } from './pages/QuotePublicPage'
export { default as QuoteTrashPage } from './pages/QuoteTrashPage'
export { default as ContractTemplatesPage } from './pages/ContractTemplatesPage'

export { default as QuoteChatInput } from './components/QuoteChatInput'
export { default as QuoteItemsTable } from './components/QuoteItemsTable'
export { default as QuotePreview } from './components/QuotePreview'
export { default as EntitySelector } from './components/EntitySelector'
export { default as ContractEditorModal } from './components/ContractEditorModal'

export {
  createQuote,
  getQuote,
  listQuotes,
  listTrashed,
  duplicateQuote,
  getPublicQuoteByToken,
  getQuoteAuditLogs,
  getQuoteViewStats,
  logQuoteView,
  permanentlyDeleteQuote,
  restoreQuote,
  softDeleteQuote,
  updateQuote,
  useQuotes,
} from './hooks/useQuotes'
export {
  createContractDraftFromQuote,
  deleteContractTemplate,
  getContractByQuoteId,
  listContractTemplates,
  saveContract,
  saveContractTemplate,
  useContractTemplates,
} from './hooks/useContracts'
export { fetchActiveServices, useServices } from './hooks/useServices'
export { fetchActiveTravelFees, findTravelFee, useTravelFees } from './hooks/useTravelFees'
export { fetchBusinessRules, useBusinessRules } from './hooks/useBusinessRules'
export { fetchActiveLegalEntities, useLegalEntities } from './hooks/useLegalEntities'
export { fetchCustomerTiers, useCustomerTiers } from './hooks/useCustomerTiers'

export { calculateQuotePricing, findServiceForQuoteItem } from './lib/pricingCalculator'
export { clearQuoteParseCache, parseQuoteBrief, parseQuoteInput, useQuoteParser } from './lib/aiParser'
export { validateQuoteInput } from './lib/quoteValidation'

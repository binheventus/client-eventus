import { useEffect, useState } from 'react'
import { useLegalEntities } from '../hooks/useLegalEntities'
import { getQuote } from '../hooks/useQuotes'
import { getContractEntityMismatchWarning } from '../lib/contractEntityConsistency'
import ImportantWarningPopup from './ImportantWarningPopup'

export default function ContractEntityMismatchPopup({
  contract = {},
  quote = null,
  documents = [],
  currentDocument = null,
}) {
  const { legalEntities } = useLegalEntities()
  const [linkedQuote, setLinkedQuote] = useState(null)
  const [dismissedSignature, setDismissedSignature] = useState('')
  const quoteId = contract?.quote_id || quote?.id || ''
  const resolvedQuote = quote || linkedQuote || contract?.quote_snapshot || null
  const warning = getContractEntityMismatchWarning({
    contract,
    quote: resolvedQuote,
    documents,
    currentDocument,
    legalEntities,
  })

  useEffect(() => {
    let mounted = true
    if (quote || !quoteId) {
      setLinkedQuote(null)
      return undefined
    }

    getQuote(quoteId)
      .then(data => {
        if (mounted) setLinkedQuote(data || null)
      })
      .catch(() => {
        if (mounted) setLinkedQuote(null)
      })

    return () => {
      mounted = false
    }
  }, [quote, quoteId])

  useEffect(() => {
    if (!warning && dismissedSignature) setDismissedSignature('')
  }, [dismissedSignature, warning])

  if (!warning || warning.signature === dismissedSignature) return null

  return (
    <ImportantWarningPopup
      title={warning.title}
      description={warning.description}
      items={warning.items}
      confirmLabel="Nguy hiểm quá, tôi sẽ check và sửa lại ngay"
      onClose={() => setDismissedSignature(warning.signature)}
    />
  )
}

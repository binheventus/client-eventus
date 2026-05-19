import { getQuoteStatusLabel, getQuoteStatusTone } from '../lib/quoteList'

export default function QuoteStatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getQuoteStatusTone(status)}`}>
      {getQuoteStatusLabel(status)}
    </span>
  )
}

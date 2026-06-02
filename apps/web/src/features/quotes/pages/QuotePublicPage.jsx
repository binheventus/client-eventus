import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import QuoteMicroSurvey from '../components/QuoteMicroSurvey'
import QuotePreview from '../components/QuotePreview'
import { getPublicQuoteByToken, logQuoteView } from '../hooks/useQuotes'
import { useLegalEntities } from '../hooks/useLegalEntities'
import { normalizeQuoteValidityDays } from '../lib/quoteValidity'

const QuotePDFDownloadButton = lazy(() => import('../components/QuotePDFDownloadButton'))
const QUOTE_PUBLIC_PAGE_TITLE = 'Báo giá chi tiết - Eventus Production'

function getValidUntil(quote) {
  if (!quote) return null
  if (quote.valid_until) return new Date(quote.valid_until)
  if (!quote.created_at) return null
  const days = normalizeQuoteValidityDays(quote.validity_days)
  const date = new Date(quote.created_at)
  date.setDate(date.getDate() + days)
  return date
}

function sanitizePublicQuote(quote) {
  if (!quote) return null
  const {
    internal_note: _internalNote,
    sales_note: _salesNote,
    created_by: _createdBy,
    created_by_name: _createdByName,
    sales_name: _salesName,
    ...publicQuote
  } = quote
  return publicQuote
}

export default function QuotePublicPage() {
  const { share_token: shareToken } = useParams()
  const { legalEntities } = useLegalEntities()
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const validUntil = useMemo(() => getValidUntil(quote), [quote])
  const expired = validUntil ? validUntil.getTime() < Date.now() : false

  useEffect(() => {
    const previousTitle = document.title
    document.title = QUOTE_PUBLIC_PAGE_TITLE
    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadPublicQuote() {
      setLoading(true)
      setError('')

      try {
        const data = await getPublicQuoteByToken(shareToken)
        if (!mounted) return
        const publicQuote = sanitizePublicQuote(data)
        setQuote(publicQuote)
        logQuoteView(publicQuote.id).catch(() => {})
      } catch (err) {
        if (mounted) setError(err?.message || 'Không tải được báo giá.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadPublicQuote()
    return () => {
      mounted = false
    }
  }, [shareToken])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[14px] text-slate-500">
        Đang tải báo giá...
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-[20px] font-semibold text-slate-900">Không mở được báo giá</h1>
          <p className="mt-2 text-[13px] leading-6 text-slate-500">{error || 'Link không hợp lệ hoặc đã bị xóa.'}</p>
        </div>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-[24px]">!</div>
          <h1 className="text-[22px] font-semibold text-slate-900">Báo giá đã hết hạn</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-500">Báo giá này đã hết hiệu lực, vui lòng liên hệ sales Eventus để được cập nhật báo giá mới.</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <QuotePreview quote={quote} items={quote.items || []} totals={quote} entities={legalEntities} sticky={false} />
        <QuoteMicroSurvey quote={quote} />
        <div className="flex justify-center pb-4">
          <Suspense fallback={<span className="inline-flex min-w-[220px] justify-center rounded-xl bg-[#f8981d] px-7 py-3 text-[14px] font-semibold text-white shadow-sm">Đang tải PDF...</span>}>
            <QuotePDFDownloadButton
              quote={quote}
              items={quote.items || []}
              className="inline-flex min-w-[220px] justify-center rounded-xl bg-[#f8981d] px-7 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#ffad32]"
            >
              Tải báo giá PDF
            </QuotePDFDownloadButton>
          </Suspense>
        </div>
      </div>
    </main>
  )
}

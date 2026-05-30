import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom'

const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const QuoteListPage = lazy(() => import('./features/quotes/pages/QuoteListPage'))
const QuoteCreatePage = lazy(() => import('./features/quotes/pages/QuoteCreatePage'))
const QuoteDetailPage = lazy(() => import('./features/quotes/pages/QuoteDetailPage'))
const QuoteTrashPage = lazy(() => import('./features/quotes/pages/QuoteTrashPage'))
const QuotePublicPage = lazy(() => import('./features/quotes/pages/QuotePublicPage'))
const ContractPublicPage = lazy(() => import('./features/quotes/pages/ContractPublicPage'))
const ContractDocumentPublicPage = lazy(() => import('./features/quotes/pages/ContractDocumentPublicPage'))
const ContractListPage = lazy(() => import('./features/quotes/pages/ContractListPage'))
const ContractNewPage = lazy(() => import('./features/quotes/pages/ContractNewPage'))
const ContractEditorPage = lazy(() => import('./features/quotes/pages/ContractEditorPage'))
const ContractDocumentsPage = lazy(() => import('./features/quotes/pages/ContractDocumentsPage'))
const ContractDocumentEditorPage = lazy(() => import('./features/quotes/pages/ContractDocumentEditorPage'))
const ContractDocumentTemplatesPage = lazy(() => import('./features/quotes/pages/ContractDocumentTemplatesPage'))

const CONTRACT_DOCUMENT_TEMPLATE_TYPES = new Set([
  'advance_request',
  'acceptance_liquidation',
  'payment_request',
])
const DEFAULT_CONTRACT_DOCUMENT_TEMPLATE_TYPE = 'advance_request'

function AppLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[13px] font-semibold text-slate-500">Đang tải...</div>
}

function getCanonicalTemplatePath(type = '') {
  const normalizedType = String(type || '').trim()
  if (normalizedType === 'contract') return '/contracts/templates/contract'
  if (CONTRACT_DOCUMENT_TEMPLATE_TYPES.has(normalizedType)) return `/contracts/templates/documents/${normalizedType}`
  return '/contracts/templates/contract'
}

function ContractTemplatesRedirect({ kind = '' } = {}) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const queryType = params.get('type')
  const targetType = kind === 'contract'
    ? 'contract'
    : kind === 'documents'
      ? (CONTRACT_DOCUMENT_TEMPLATE_TYPES.has(queryType) ? queryType : DEFAULT_CONTRACT_DOCUMENT_TEMPLATE_TYPE)
      : (queryType || 'contract')
  params.delete('type')
  const search = params.toString()

  return <Navigate replace to={`${getCanonicalTemplatePath(targetType)}${search ? `?${search}` : ''}`} />
}

function QuoteModuleShell({ children }) {
  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex h-full min-h-0">
        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  )
}

function QuoteDetailRoute() {
  const { id } = useParams()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)

  if (searchParams.get('mode') === 'edit') {
    searchParams.delete('mode')
    const search = searchParams.toString()
    return <Navigate replace to={`/quotes/${encodeURIComponent(id)}/edit${search ? `?${search}` : ''}`} />
  }

  return (
    <QuoteModuleShell>
      <QuoteDetailPage />
    </QuoteModuleShell>
  )
}

function QuoteEditRoute() {
  const { id } = useParams()

  return (
    <QuoteModuleShell>
      <QuoteCreatePage mode="edit" quoteId={id} />
    </QuoteModuleShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/quotes" element={<QuoteModuleShell><QuoteListPage /></QuoteModuleShell>} />
          <Route path="/quotes/new" element={<QuoteModuleShell><QuoteCreatePage /></QuoteModuleShell>} />
          <Route path="/quotes/trash" element={<QuoteModuleShell><QuoteTrashPage /></QuoteModuleShell>} />
          <Route path="/quotes/contract-templates" element={<ContractTemplatesRedirect kind="contract" />} />
          <Route path="/quotes/:id/edit" element={<QuoteEditRoute />} />
          <Route path="/quotes/:id" element={<QuoteDetailRoute />} />
          <Route path="/quotes/*" element={<Navigate replace to="/quotes" />} />
          <Route path="/contracts" element={<ContractListPage />} />
          <Route path="/contracts/new" element={<ContractNewPage />} />
          <Route path="/contracts/new/manual" element={<ContractEditorPage />} />
          <Route path="/contracts/from-job/:jobId" element={<ContractEditorPage />} />
          <Route path="/contracts/from-quote/:quoteId" element={<ContractEditorPage />} />
          <Route path="/contracts/templates" element={<ContractTemplatesRedirect />} />
          <Route path="/contracts/templates/contract" element={<ContractDocumentTemplatesPage />} />
          <Route path="/contracts/templates/documents/:documentType" element={<ContractDocumentTemplatesPage />} />
          <Route path="/contracts/templates/documents" element={<ContractTemplatesRedirect kind="documents" />} />
          <Route path="/contracts/contract-templates" element={<ContractTemplatesRedirect kind="contract" />} />
          <Route path="/contracts/document-templates" element={<ContractTemplatesRedirect kind="documents" />} />
          <Route path="/contracts/:contractId/documents" element={<ContractDocumentsPage />} />
          <Route path="/contracts/:contractId/documents/new/:documentType" element={<ContractDocumentEditorPage />} />
          <Route path="/documents/:documentId/edit" element={<ContractDocumentEditorPage />} />
          <Route path="/contracts/:contractId/documents/:documentId/edit" element={<ContractDocumentEditorPage />} />
          <Route path="/contracts/:id" element={<ContractEditorPage />} />
          <Route path="/q/:share_token" element={<QuotePublicPage />} />
          <Route path="/c/:share_token" element={<ContractPublicPage />} />
          <Route path="/d/:share_token" element={<ContractDocumentPublicPage />} />
          <Route path="/position/:positionId" element={<ClientPortalPage />} />
          <Route path="/position/:positionId/level/:levelIndex" element={<ClientPortalPage />} />
          <Route path="*" element={<ClientPortalPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

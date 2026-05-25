import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage'))
const QuotePublicPage = lazy(() => import('./features/quotes/pages/QuotePublicPage'))
const ContractPublicPage = lazy(() => import('./features/quotes/pages/ContractPublicPage'))
const ContractListPage = lazy(() => import('./features/quotes/pages/ContractListPage'))
const ContractTemplatesPage = lazy(() => import('./features/quotes/pages/ContractTemplatesPage'))

function AppLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[13px] font-semibold text-slate-500">Đang tải...</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoading />}>
        <Routes>
          <Route path="/" element={<ClientPortalPage />} />
          <Route path="/quotes" element={<ClientPortalPage />} />
          <Route path="/quotes/new" element={<ClientPortalPage />} />
          <Route path="/quotes/trash" element={<ClientPortalPage />} />
          <Route path="/quotes/contract-templates" element={<ClientPortalPage />} />
          <Route path="/quotes/:id" element={<ClientPortalPage />} />
          <Route path="/contracts" element={<ContractListPage />} />
          <Route path="/contracts/contract-templates" element={<ContractTemplatesPage />} />
          <Route path="/contracts/:id" element={<ContractListPage />} />
          <Route path="/q/:share_token" element={<QuotePublicPage />} />
          <Route path="/c/:share_token" element={<ContractPublicPage />} />
          <Route path="/position/:positionId" element={<ClientPortalPage />} />
          <Route path="/position/:positionId/level/:levelIndex" element={<ClientPortalPage />} />
          <Route path="*" element={<ClientPortalPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

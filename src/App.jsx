import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const EventusAILabPage = lazy(() => import('./pages/EventusAILabPage'))
const QuotePublicPage = lazy(() => import('./features/quotes/pages/QuotePublicPage'))
const ContractPublicPage = lazy(() => import('./features/quotes/pages/ContractPublicPage'))

function AppLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[13px] font-semibold text-slate-500">Đang tải...</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoading />}>
        <Routes>
          <Route path="/" element={<EventusAILabPage />} />
          <Route path="/quotes" element={<EventusAILabPage />} />
          <Route path="/quotes/new" element={<EventusAILabPage />} />
          <Route path="/quotes/trash" element={<EventusAILabPage />} />
          <Route path="/quotes/contract-templates" element={<EventusAILabPage />} />
          <Route path="/quotes/:id" element={<EventusAILabPage />} />
          <Route path="/q/:share_token" element={<QuotePublicPage />} />
          <Route path="/c/:share_token" element={<ContractPublicPage />} />
          <Route path="/position/:positionId" element={<EventusAILabPage />} />
          <Route path="/position/:positionId/level/:levelIndex" element={<EventusAILabPage />} />
          <Route path="*" element={<EventusAILabPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

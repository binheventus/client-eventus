import { BrowserRouter, Routes, Route } from 'react-router-dom'
import EventusAILabPage from './pages/EventusAILabPage'
import { QuotePublicPage } from './features/quotes'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EventusAILabPage />} />
        <Route path="/hr-insights" element={<EventusAILabPage />} />
        <Route path="/vfx-builder" element={<EventusAILabPage />} />
        <Route path="/quotes" element={<EventusAILabPage />} />
        <Route path="/quotes/new" element={<EventusAILabPage />} />
        <Route path="/quotes/trash" element={<EventusAILabPage />} />
        <Route path="/quotes/:id" element={<EventusAILabPage />} />
        <Route path="/q/:share_token" element={<QuotePublicPage />} />
        <Route path="/position/:positionId" element={<EventusAILabPage />} />
        <Route path="/position/:positionId/level/:levelIndex" element={<EventusAILabPage />} />
      </Routes>
    </BrowserRouter>
  )
}

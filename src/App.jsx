import { BrowserRouter, Routes, Route } from 'react-router-dom'
import WikiPage from './pages/WikiPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WikiPage />} />
        <Route path="/competency" element={<WikiPage />} />
        <Route path="/orgchart" element={<WikiPage />} />
        <Route path="/30dayreview" element={<WikiPage />} />
        <Route path="/position/:positionId" element={<WikiPage />} />
        <Route path="/position/:positionId/level/:levelIndex" element={<WikiPage />} />
      </Routes>
    </BrowserRouter>
  )
}

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import WikiPage from './pages/WikiPage'
import PositionPage from './pages/PositionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WikiPage />} />
        <Route path="/position/:positionId" element={<PositionPage />} />
        <Route path="/position/:positionId/level/:levelIndex" element={<PositionPage />} />
      </Routes>
    </BrowserRouter>
  )
}

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import PositionPage from './pages/PositionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/position/:positionId" element={<PositionPage />} />
        <Route path="/position/:positionId/level/:levelIndex" element={<PositionPage />} />
      </Routes>
    </BrowserRouter>
  )
}

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import WikiPage from './pages/WikiPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WikiPage />} />
        <Route path="/quy-trinh" element={<WikiPage />} />
        <Route path="/quy-trinh/:articleSlug" element={<WikiPage />} />
        <Route path="/noi-quy" element={<WikiPage />} />
        <Route path="/noi-quy/:articleSlug" element={<WikiPage />} />
        <Route path="/huong-dan" element={<WikiPage />} />
        <Route path="/huong-dan/:articleSlug" element={<WikiPage />} />
        <Route path="/competency" element={<WikiPage />} />
        <Route path="/orgchart" element={<WikiPage />} />
        <Route path="/hr-insights" element={<WikiPage />} />
        <Route path="/30dayreview" element={<WikiPage />} />
        <Route path="/position/:positionId" element={<WikiPage />} />
        <Route path="/position/:positionId/level/:levelIndex" element={<WikiPage />} />
      </Routes>
    </BrowserRouter>
  )
}

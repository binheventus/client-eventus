import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Eventus app crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      const detail = import.meta.env.DEV
        ? this.state.error?.stack || this.state.error?.message || String(this.state.error)
        : 'Vui lòng tải lại trang hoặc báo quản trị viên kiểm tra.'

      return (
        <div style={{ minHeight: '100vh', padding: 32, fontFamily: 'sans-serif', background: '#f8fafc', color: '#0f172a' }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Eventus Handbook gặp lỗi khi tải trang</h1>
          <p style={{ marginTop: 12, lineHeight: 1.6 }}>Gửi lại màn hình này để kiểm tra lỗi runtime.</p>
          <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap', border: '1px solid #cbd5e1', borderRadius: 12, padding: 16, background: 'white' }}>
            {detail}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

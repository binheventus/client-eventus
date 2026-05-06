import { ADMIN_PASSWORD } from '../src/config.js'

export function requireAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD || ADMIN_PASSWORD
  const received = req.headers['x-admin-password']

  if (!expected || received !== expected) {
    const error = new Error('Bạn cần đăng nhập Admin mode để truy cập dữ liệu HR Insights.')
    error.statusCode = 401
    throw error
  }
}


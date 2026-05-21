# Eventus Competency Framework

Hệ thống khung năng lực nội bộ Eventus Việt Nam.

## Chạy local

App hiện chạy local với MySQL, không dùng Supabase.

1. Cài dependencies:

```bash
npm install
```

2. Tạo `.env` từ `.env.example`, rồi điền MySQL local:

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=
```

3. Tạo bảng `client_*`:

```bash
npm run db:migrate
```

4. Chạy app local:

```bash
npm run dev
```

Vite phục vụ frontend trong `apps/web` và proxy `/api/*` qua NestJS trong `apps/api`.

5. Chạy production-style:

```bash
npm run build
npm start
```

NestJS server phục vụ cả API `/api/quotes`, `/api/contracts`, `/api/client-pages`, `/api/parse-quote` và frontend đã build trong `apps/web/dist`.

## Deploy production

Production hiện chạy trên VPS bằng Nginx + PM2, không dùng Vercel.
Checklist deploy và cấu hình Nginx nằm trong `deploy/production-checklist.md`.
File Nginx mẫu để bật cache asset + gzip/brotli nằm tại `deploy/nginx-client-eventus.conf`.

## Pricing Sync

Bảng giá vẫn sync từ Google Sheet sang JSON trong `apps/web/src/data/pricing/`:

```bash
npm run pricing:export
```

Các biến `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` và `PRICING_SPREADSHEET_ID` chỉ dùng cho lệnh này, không liên quan tới MySQL runtime.

## Cập nhật nội dung

Nội dung client portal runtime lưu trong bảng `client_pages`. Dữ liệu pricing nằm trong `apps/web/src/data/pricing/`. Khung năng lực cũ vẫn nằm tại `apps/web/src/data/competency.json`.

## Cấu trúc thư mục

```
apps/
├── api/                    NestJS API + MySQL runtime
└── web/                    React/Vite frontend
    └── src/
        ├── data/
        │   └── competency.json
        ├── features/
        └── pages/
```

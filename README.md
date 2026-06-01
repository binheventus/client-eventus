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
Mở app tại `https://client-eventus.test/`. Herd giữ domain HTTPS này và proxy vào
Vite tại `http://127.0.0.1:5173`.

Thiết lập proxy Herd một lần trên máy local:

```bash
herd proxy client-eventus http://127.0.0.1:5173 --secure
```

Để giữ dev server chạy khi đóng terminal:

```bash
npm run dev:background
npm run dev:status
npm run dev:stop
```

5. Chạy production-style:

```bash
npm run build
npm start
```

NestJS server phục vụ cả API `/api/quotes`, `/api/contracts`, `/api/client-pages`, `/api/parse-quote` và frontend đã build trong `apps/web/dist`.

## Feedback module

Feedback chạy trong `client-eventus` với routes:

- `/feedback`: dashboard nội bộ, dùng auth Eventus hiện tại.
- `/feedbacks`: form nhập mã job/Zalo cho khách.
- `/feedbacks/:id`: link feedback khách hàng; link cũ theo legacy id vẫn mở được sau khi import dữ liệu.
- `/redirect/:zaloId`, `/survey`, `/gallery/:zaloId`: routes công khai tương thích flow cũ.

Upload file feedback dùng Google Drive qua `rclone` theo mặc định:

```bash
RCLONE_BIN=rclone
RCLONE_REMOTE=eventus
RCLONE_FEEDBACK_DIR=feedback
FEEDBACK_UPLOAD_STORAGE=rclone
```

Các biến bổ sung:

```bash
YT_DLP_BIN=
FFMPEG_BINARIES=ffmpeg
NHANSU_URL=
```

Sau khi chạy `npm run db:migrate`, import dữ liệu legacy cùng DB bằng:

```bash
npm run feedback:import-legacy -- --dry-run
npm run feedback:import-legacy
```

Nếu chỉ muốn giữ dữ liệu Feedback trong 6 tháng gần nhất, prune dữ liệu đã import trong
`client_feedback_*` bằng:

```bash
npm run feedback:prune -- --months=6
npm run feedback:prune -- --months=6 --force
```

Script prune không xóa bảng legacy gốc và không xóa file Google Drive/local.

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

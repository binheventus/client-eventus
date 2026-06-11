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

- `/feedback`: redirect vĩnh viễn sang `/feedbacks`.
- `/feedbacks`: dashboard nội bộ, dùng auth Eventus hiện tại.
- `/feedbacks/:share_token`: link feedback công khai cho khách hàng.
- `/survey` và `/gallery/:share_token`: các trang khảo sát và gallery công khai.

Upload ảnh feedback lưu trực tiếp trên server hiện tại:

```bash
FEEDBACK_UPLOAD_ROOT=/var/www/client-eventus/uploads
FEEDBACK_UPLOAD_PUBLIC_PREFIX=/feedback-assets/uploads
FEEDBACK_ATTACHMENT_TTL_DAYS=20
FEEDBACK_IMAGE_MAX_COUNT=4
FEEDBACK_IMAGE_MAX_BYTES=3145728
VITE_FEEDBACK_IMAGE_MAX_COUNT=4
VITE_FEEDBACK_IMAGE_MAX_EDGE=1600
VITE_FEEDBACK_IMAGE_MAX_BYTES=3145728
```

Frontend tự resize/nén ảnh trước khi upload; backend chỉ nhận ảnh JPG/PNG/WebP đã tối ưu.
Để xóa thật file hết hạn khỏi ổ cứng, chạy cleanup định kỳ:

```bash
npm run feedback:cleanup-attachments
npm run feedback:cleanup-attachments -- --force
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

Script prune không xóa bảng legacy gốc. File attachment hết hạn được xóa bằng
`npm run feedback:cleanup-attachments -- --force`.

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

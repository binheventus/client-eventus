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

4. Chạy app:

```bash
npm run dev
```

Vite local server phục vụ cả frontend và các API `/api/quotes`, `/api/contracts`, `/api/client-pages`, `/api/parse-quote`.

## Pricing Sync

Bảng giá vẫn sync từ Google Sheet sang JSON trong `src/data/pricing/`:

```bash
npm run pricing:export
```

Các biến `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` và `PRICING_SPREADSHEET_ID` chỉ dùng cho lệnh này, không liên quan tới MySQL runtime.

## Cập nhật nội dung

Nội dung client portal runtime lưu trong bảng `client_pages`. Dữ liệu pricing nằm trong `src/data/pricing/`. Khung năng lực cũ vẫn nằm tại `src/data/competency.json`.

## Cấu trúc thư mục

```
src/
├── data/
│   └── competency.json     ← EDIT FILE NÀY để cập nhật nội dung
├── components/
│   ├── Header.jsx
│   ├── PositionCard.jsx
│   └── CompetencyPanel.jsx
└── pages/
    ├── HomePage.jsx
    └── PositionPage.jsx
```

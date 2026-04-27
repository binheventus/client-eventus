# Eventus Competency Framework

Hệ thống khung năng lực nội bộ Eventus Việt Nam.

## Cập nhật nội dung

Toàn bộ nội dung nằm tại `src/data/competency.json`. Chỉnh sửa file này trực tiếp trên GitHub, Vercel sẽ tự động deploy lại.

## Deploy lên Vercel

### Lần đầu (qua GitHub)

1. Push repo lên GitHub
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → Import repo
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy**

### Sau đó

Mỗi lần push lên `main` → Vercel tự động build và deploy lại.

## Chạy local

```bash
npm install
npm run dev
```

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

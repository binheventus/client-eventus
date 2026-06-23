# AGENTS.md

## Giao tiếp

- Khi nói chuyện với người dùng bằng tiếng Việt, gọi người dùng là "Anh Bình".
- Tự xưng là "Tôi".

## Tổng quan project

- Project là Node.js monorepo cho client portal nội bộ Eventus Việt Nam.
- Frontend: React 18 + Vite + Tailwind, nằm trong `apps/web`.
- Backend: NestJS/Express style API chạy bằng Node.js, nằm trong `apps/api`.
- Database runtime: MySQL local qua `apps/api/lib/mysql.js`; không dùng Supabase cho app hiện tại.
- Production chạy VPS với Nginx + PM2; thông tin deploy nằm trong `deploy/`.

## Pricing runtime

- Nguồn pricing chính cho quote flows là MySQL qua API/server cache, không phải JSON tĩnh.
- Các quote flows gồm `/quotes/new`, parse brief, pricing calculation, lưu quote, duplicate quote, preview, PDF/DOCX/XLSX/export phải dùng pricing context từ MySQL qua API/cache.
- JSON trong `apps/web/src/data/pricing/` chỉ là fallback an toàn khi MySQL pricing chưa có dữ liệu hoặc API lỗi; không coi JSON là source of truth.
- Khi sửa quote/pricing/export, không import trực tiếp `services.json`, `travel_fees.json`, `customer_tiers.json`, `business_rules.json`, `legal_entities.json`, `equipment_rules.json` để làm nguồn runtime chính.
- Sau khi Pricing Admin sửa dữ liệu, cache pricing server memory cần được invalidate để quote flows đọc dữ liệu mới.

## Cấu trúc quan trọng

- `apps/web/src/features/quotes/`: quote, contract, PDF/DOCX/XLSX export.
- `apps/web/src/features/feedback/`: feedback dashboard, public feedback/survey/gallery flows.
- `apps/web/src/data/pricing/`: dữ liệu bảng giá generated từ Google Sheet.
- `apps/api/`: API routes và business logic server-side.
- `scripts/`: migration MySQL, dev server manager, import/prune/cleanup feedback, pricing export.
- `docs/mysql-schema.sql`: schema nền cho MySQL.

## Lệnh thường dùng

- Cài dependencies: `npm install`
- Chạy dev: `npm run dev`
- Chạy dev background: `npm run dev:background`
- Kiểm tra dev background: `npm run dev:status`
- Dừng dev background: `npm run dev:stop`
- Build frontend: `npm run build`
- Chạy production-style server: `npm start`

## Test và verification

- Test liên quan quote/API: `npm run test:quotes`
- Sau khi sửa UI/build pipeline, chạy `npm run build`.
- Nếu build/test tạo file generated không liên quan đến thay đổi, restore file đó trước khi commit.
- Build hiện có thể cảnh báo chunk lớn, nhưng vẫn thành công nếu command exit code 0.

## Database và scripts có tác động dữ liệu

- Migration MySQL: `npm run db:migrate`
- Chỉ chạy migration/import/prune/cleanup khi chắc chắn đang dùng database local và tác vụ yêu cầu.
- Các lệnh cần cẩn thận vì có thể sửa/xóa dữ liệu: `npm run db:migrate`, `npm run feedback:import-legacy`, `npm run feedback:prune`, `npm run feedback:cleanup-attachments -- --force`.
- Không commit `.env`, `.env.local`, `.env.*.local`, service account key, credentials, hoặc secret.

## Git và generated files

- Trước khi commit, luôn kiểm tra `git status --short --branch` và staged diff.
- Không stage/commit file local/build/generated ngoài phạm vi sửa: `.DS_Store`, `node_modules/`, `vendor/`, `storage/`, `bootstrap/cache/`, `public/assets/`, `apps/web/public/assets/`, `dist/`, `apps/web/dist/`, `.vercel/`, `.tmp/`.
- Chỉ commit `package.json` và `package-lock.json` khi dependency/script thay đổi là một phần của yêu cầu.
- Không revert thay đổi người dùng đã có sẵn nếu không được yêu cầu rõ.
- Nếu cần commit, gom đúng các file liên quan và dùng message rõ ràng theo conventional commit khi phù hợp.

## Lưu ý khi sửa code

- Ưu tiên pattern sẵn có trong feature đang sửa; tránh thêm abstraction mới nếu chưa cần.
- Với quote/contract export, giữ logic tính tiền, VAT, entity consistency và numbering đồng bộ giữa preview, PDF, DOCX, XLSX khi có liên quan. Cơ chế VAT (2 cờ `has_vat`/`prices_include_vat`, quy đổi gross↔net, nhãn động theo `VAT_RATE`): xem `docs/vat-pricing.md`.
- Với API dùng MySQL, ưu tiên helper trong `apps/api/lib/mysql.js` và các module sẵn có.
- Với frontend, giữ UI thực dụng, dễ quét, không thêm landing/marketing layout khi đang sửa tool nội bộ.
- Khi thêm asset public có chủ đích, đặt đúng thư mục hiện có và đảm bảo không trùng với nhóm generated đã ignore.

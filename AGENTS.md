# AGENTS.md

- Khi nói chuyện với người dùng bằng tiếng Việt, gọi người dùng là "Anh Bình".
- Tự xưng là "Tôi".
- Stack chính: Node.js monorepo với React/Vite frontend trong `apps/web`, NestJS/Express API trong `apps/api`, MySQL runtime.
- Lệnh thường dùng: `npm install`, `npm run dev`, `npm run dev:background`, `npm run dev:status`, `npm run dev:stop`.
- Lệnh kiểm tra/build: `npm run test:quotes`, `npm run build`.
- Migration MySQL dùng `npm run db:migrate`; chỉ chạy khi chắc chắn đúng database local.
- Không commit generated/local files như `node_modules/`, `vendor/`, `storage/`, `bootstrap/cache/`, `public/assets/`, `apps/web/dist/`, `dist/`, `.env*`, `.DS_Store`.

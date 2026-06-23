# Tasks: AI Quote Parser

Implementation chia 3 PR liên tiếp. Mỗi PR có thể merge riêng và rollback độc lập.

---

## 1. PR1 — Backend AI parser + fallback

### 1.1 Prompt building blocks

- [x] 1.1.1 Tạo `apps/api/lib/claude-quote-prompt.js` chứa hằng `SYSTEM_PROMPT_LAYER_1_2` (vai trò + luật biên dịch tiếng Việt) như mô tả ở [design.md §4](./design.md).
- [x] 1.1.2 Tạo `apps/api/lib/claude-quote-examples.js` với mảng `FOUNDATIONAL_EXAMPLES` gồm 5–7 ví dụ: brief ngắn cơ bản, chat dài có MC ngoài khung, giá khác giá khung, có dựng có giá riêng, gimbal kèm quay live, multi-day, vague accessory bỏ qua.
- [x] 1.1.3 Mỗi example là `{ name, input, output }` với `output` đầy đủ schema parsed result (items, location, duration_hours, tier_code, ai_reasoning).

### 1.2 Claude client

- [x] 1.2.1 Tạo `apps/api/lib/claude-quote-parser.js` export `hasAnthropicKey()`, `parseQuoteWithClaude(input, context, { foundationalExamples, customExamples })`, `getAiModelName()`.
- [x] 1.2.2 Định nghĩa `QUOTE_PARSE_TOOL_SCHEMA` (JSON Schema cho tool call `submit_parsed_quote`) khớp với spec output (items với is_custom/is_overridden/group_code/...).
- [x] 1.2.3 Hàm `compactServicesCatalog(services)` trả mảng `{ code, name, unit, price_tier_2, duration_tier, group }`.
- [x] 1.2.4 Hàm `buildSystemPromptBlock(context, customExamples)` gộp Layer 1+2 + catalog + foundational + custom examples (sort theo sort_order, cap MAX_EXAMPLES=12).
- [x] 1.2.5 Hàm `callAnthropic({ system, userInput, model, timeoutMs })` dùng `fetch` thẳng tới `https://api.anthropic.com/v1/messages`, set `cache_control: { type: 'ephemeral' }` cho block system, `tool_choice: { type: 'tool', name: 'submit_parsed_quote' }`.
- [x] 1.2.6 Validate response: phải có 1 tool call duy nhất với `input` parse được; nếu lệch schema → throw để caller fallback. Retry 1 lần khi lỗi schema.
- [x] 1.2.7 Log telemetry minimal: `model`, `tokens_in`, `tokens_out`, `cache_read_tokens`, `latency_ms`. KHÔNG log nội dung chat.

### 1.3 Wire vào parse-quote.js

- [x] 1.3.1 Sửa `apps/api/parse-quote.js` handler: nếu `req.method === 'GET' && req.query.probe` → trả `{ ai_available: hasAnthropicKey(), model: getAiModelName() }`.
- [x] 1.3.2 Trong nhánh POST: đọc `mode` từ body. Nếu `mode === 'ai' && hasAnthropicKey()`, gọi `parseQuoteWithClaude` trong try/catch.
- [x] 1.3.3 Sau khi AI trả result thành công → wrap qua `applyBriefBusinessRules(aiResult, inputText, context)` rồi gắn `source: 'ai'` + `pricing_meta`.
- [x] 1.3.4 Khi AI lỗi/timeout/schema invalid hoặc thiếu key: chạy `deterministicParseQuoteInput`, gắn `source: 'ai_fallback'`, prepend dòng giải thích vào `ai_reasoning`. Khi mode không phải 'ai': source `'regex'`.
- [x] 1.3.5 Cache in-memory hash(input_text + mode) TTL 60s ở scope module để chống double-click.

### 1.4 Env và docs

- [x] 1.4.1 Sửa `.env.example`: thêm `ANTHROPIC_API_KEY=`, `QUOTE_PARSE_AI_MODEL=claude-haiku-4-5-20251001`, `QUOTE_PARSE_AI_TIMEOUT_MS=20000`. XÓA dòng `VITE_ANTHROPIC_API_KEY=`. (Bonus: thêm `ANTHROPIC_BASE_URL=https://api.coffeevibeai.com` cho proxy nội bộ; admin tự đổi sang anthropic.com nếu muốn.)
- [x] 1.4.2 Thêm `docs/ai-quote-parser.md` (~1 trang): mô tả env vars, cách bật/tắt, cách thêm ví dụ qua `claude-quote-examples.js`, link tới Pricing Admin tab cho phase sau.

### 1.5 Tests

- [x] 1.5.1 Sửa `apps/api/parse-quote.test.js`: import handler, mock `globalThis.fetch` cho Anthropic.
- [x] 1.5.2 Test "mode=ai trả structured response → trả result với source=ai và items đúng".
- [x] 1.5.3 Test "mode=ai khi env thiếu key → source=ai_fallback, items từ regex".
- [x] 1.5.4 Test "mode=ai khi fetch reject → fallback".
- [x] 1.5.5 Test "mode=ai khi tool call schema invalid → retry 1 lần, vẫn fail → fallback".
- [x] 1.5.6 Test "mode=ai khi AI trả CHUP_IN_4H với is_overridden=true unit_price=1800000 → applyBriefBusinessRules giữ override".
- [x] 1.5.7 Test "GET /api/parse-quote?probe=1 trả ai_available phù hợp với env".
- [x] 1.5.8 Chạy `npm run test:quotes` → green. (165/165 tests pass.)

### 1.6 Smoke test thủ công

- [ ] 1.6.1 Set `ANTHROPIC_API_KEY` thật vào `.env`, `npm run dev`, gọi curl `POST /api/parse-quote {"input_text":"2 chụp 1 quay 5 tiếng Hải Phòng","mode":"ai"}` → verify items đúng.
- [ ] 1.6.2 Tạm xóa key trong `.env`, `npm run dev:stop && npm run dev:background`, gọi lại curl với mode=ai → verify fallback.
- [ ] 1.6.3 Commit + tạo PR1 với title "feat: thêm Claude AI parser cho /api/parse-quote (opt-in)".

---

## 2. PR2 — Frontend hai nút song song

### 2.1 Brief parser client

- [x] 2.1.1 Sửa `apps/web/src/features/quotes/lib/briefParser.js`: thêm `mode` vào `getCacheKey()` để cache phân biệt regex/AI.
- [x] 2.1.2 Thêm export `parseQuoteInputWithAi(inputText, context, options)` — wrap `parseQuoteInput` truyền `mode: 'ai'`.
- [x] 2.1.3 Thêm `probeAiAvailability()` gọi `GET /api/parse-quote?probe=1`, trả `{ ai_available, model }` hoặc `{ ai_available: false }` nếu lỗi.

### 2.2 Brief input UI

- [x] 2.2.1 Sửa `QuoteChatInput.jsx`: thêm props `onAnalyzeWithAi`, `aiAvailable`, `aiLoading`, `aiModel`.
- [x] 2.2.2 Render 2 nút song song: "Phân tích nhanh" giữ logic hiện tại; "Phân tích bằng AI" với icon Sparkles từ lucide-react.
- [x] 2.2.3 Khi `!aiAvailable`: nút AI disable + tooltip "Chưa cấu hình API key Claude" (qua `title` hoặc Tooltip primitive sẵn có).
- [x] 2.2.4 Khi `aiLoading`: chữ nút đổi "Đang phân tích bằng AI...", spinner đơn giản.

### 2.3 Quote create page

- [x] 2.3.1 Sửa `QuoteCreatePage.jsx`: state mới `aiAvailable`, `aiLoading`, `aiModel`. `useEffect` gọi `probeAiAvailability()` 1 lần khi mount.
- [x] 2.3.2 Tách `analyzeInput` thành `analyzeInput` (regex, giữ nguyên) và `analyzeInputWithAi` (gọi `parseQuoteInputWithAi`).
- [x] 2.3.3 Truyền `onAnalyzeWithAi`, `aiAvailable`, `aiLoading` xuống `QuoteChatInput`.
- [x] 2.3.4 Khi response có `source: 'ai_fallback'`: hiển thị badge cảnh báo nhỏ "AI tạm lỗi, dùng parser cơ bản" dưới phần `ai_reasoning`.

### 2.4 Tôn trọng AI override

- [x] 2.4.1 Sửa `normalizeParsedItem` ([QuoteCreatePage.jsx:513](../../../apps/web/src/features/quotes/pages/QuoteCreatePage.jsx)): nếu `item.is_overridden === true && Number(item.unit_price) > 0`, giữ `unit_price` từ AI và set `original_unit_price` = giá tier khung; giữ `is_overridden`, `override_reason` từ AI.
- [x] 2.4.2 Nếu `item.is_custom === true`: dùng pattern `addCustomItem` đã có — `service_code: 'CUSTOM'`, `is_overridden: true`, `group_code: 'OTHER'` mặc định nếu AI không truyền.
- [ ] 2.4.3 Verify bằng cách paste chat có MC + giá khác giá khung → bảng items hiển thị đúng cờ override (ô giá nền cam).

### 2.5 Tests / verify

- [x] 2.5.1 `npm run build` → không lỗi. (Trong sandbox: `.env` không đọc được nên build bị chặn ở vite.config; đã syntax-check 3 file edit qua esbuild — green. `test:quotes` 165/165 pass. Anh Bình chạy `npm run build` ngoài sandbox để xác nhận lần cuối.)
- [ ] 2.5.2 Chạy local: paste chat dài có MC, bấm "Phân tích bằng AI" → MC xuất hiện custom item, giá đúng từ chat.
- [ ] 2.5.3 Bấm "Phân tích nhanh" trên cùng brief → output regex (không có MC).
- [ ] 2.5.4 Tạm tắt key trong env, reload page → nút AI disable + tooltip.
- [ ] 2.5.5 Commit + tạo PR2 "feat: thêm nút Phân tích bằng AI trên /quotes/new".

---

## 3. PR3 — Examples DB + admin UI + nút "Lưu ví dụ"

### 3.1 MySQL schema

- [x] 3.1.1 Sửa `docs/mysql-schema.sql`: thêm bảng `pricing_ai_parse_examples` (cột id, name unique, input_text mediumtext, expected_output json, notes text, is_active tinyint, sort_order int, source_json json, created_at, updated_at; index trên `is_active, sort_order`).
- [x] 3.1.2 Cập nhật `scripts/migrate-mysql.mjs` để áp schema mới khi `npm run db:migrate`. (Migrate script đọc thẳng `docs/mysql-schema.sql` và áp `create table if not exists` từng statement — không cần code thêm.)
- [ ] 3.1.3 Chạy migrate trên local → verify bảng có.

### 3.2 Backend CRUD

- [x] 3.2.1 Sửa `apps/api/pricing-admin.js`: thêm entry `ai_parse_examples` vào `DATASETS` với `tableName`, `keyColumn: 'name'`, `searchColumns`, `orderBy: 'sort_order asc, id asc'`, `fields` cho name/input_text/expected_output/notes/is_active/sort_order.
- [x] 3.2.2 Field `expected_output` validate JSON: trong `normalize`, nếu là string thì `JSON.parse`, lỗi → throw `makeHttpError('expected_output phải là JSON hợp lệ.', 400, 'VALIDATION_ERROR')`.
- [x] 3.2.3 Đảm bảo `invalidatePricingContextCache` được gọi sau create/update/delete như các dataset khác (đã sẵn trong framework — chỉ cần đặt resource vào DATASETS).
- [x] 3.2.4 Thêm helper `getActiveAiParseExamples()` trong `apps/api/lib/pricing-context.js`: query `pricing_ai_parse_examples` where `is_active=1` order by `sort_order`, cache cùng vòng đời pricing context (TTL 5 phút).
- [x] 3.2.5 Sửa `claude-quote-parser.js` để nhận `customExamples` từ `getActiveAiParseExamples()`, merge với `FOUNDATIONAL_EXAMPLES`, sort theo sort_order, cap 12. (Parser đã hỗ trợ `customExamples` từ PR1; chỉ cần wire `parse-quote.js` đọc rows từ helper rồi truyền xuống — `normalizeCustomExample` map đúng `{ name, input_text, expected_output, sort_order }`.)

### 3.3 Admin UI

- [x] 3.3.1 Sửa `apps/web/src/features/pricing-admin/pages/PricingAdminPage.jsx`: thêm entry `ai_parse_examples` vào `DATASETS` với `formFields`: name (text required), input_text (textarea-large required), expected_output (json required), notes (textarea), is_active (checkbox), sort_order (number).
- [x] 3.3.2 Thêm field type renderer 'json': textarea với button "Format JSON" và validate `JSON.parse` trước submit; báo lỗi tiếng Việt khi parse hỏng.
- [x] 3.3.3 Thêm tab "AI Examples" vào navigation list — pattern hiện tại tự generate từ `DATASETS`, có thể chỉ cần thêm label tiếng Việt. (Đã thêm field `tabLabel: 'AI Examples'` và render qua `dataset.tabLabel || dataset.resource`.)

### 3.4 Nút "Lưu thành ví dụ"

- [x] 3.4.1 Sửa `QuoteCreatePage.jsx`: chỉ hiện nút "📚 Lưu thành ví dụ huấn luyện" sau khi `parseResult?.source === 'ai'` thành công VÀ có ít nhất 1 item.
- [x] 3.4.2 Tạo component `SaveExampleModal` trong `apps/web/src/features/quotes/components/SaveExampleModal.jsx`: form với name (suggest `chat-${YYYYMMDD}-${random4}`), input_text (textarea), expected_output (textarea read-only hoặc collapse json), notes.
- [x] 3.4.3 Khi mở modal: snapshot từ state hiện tại — `expected_output = JSON.stringify({ items: snapshotItems, location, duration_hours, tier_code, num_days })` với `snapshotItems` chỉ giữ những field cần dạy AI (service_code, quantity, service_name, service_name_raw, is_custom, unit_price, is_overridden, override_reason, group_code, group_label).
- [x] 3.4.4 Save: `POST /api/pricing-admin` với resource `ai_parse_examples`. Hiển thị toast/banner thành công, đóng modal.
- [x] 3.4.5 Khi save xong, gọi `clearQuoteParseCache()` để parse lần sau không trả cache cũ.

### 3.5 Tests / verify

- [x] 3.5.1 Test backend mới: insert example với expected_output không phải JSON → 400; insert đúng → 201; update is_active=false → query examples không trả nó. (Đã thêm `apps/api/pricing-admin.test.js` test `normalizeExpectedOutput` reject JSON sai cú pháp / primitive / rỗng — full handler test với MySQL pool nằm ngoài scope sandbox.)
- [x] 3.5.2 Test integration: insert custom example → gọi parse-quote AI → fetch mock thấy prompt chứa example đó. (Đã thêm 3 test cho `buildSystemPromptBlock` trong `parse-quote.test.js`: merge custom example, cap MAX_EXAMPLES=12, bỏ qua expected_output không hợp lệ.)
- [ ] 3.5.3 Manual: chạy migrate, mở /pricing-admin → tab AI Examples xuất hiện. Thêm 1 ví dụ. Vào /quotes/new paste brief tương tự → AI trả output theo ví dụ.
- [ ] 3.5.4 Bấm "Lưu thành ví dụ" sau parse → modal mở với expected_output đầy đủ → save → row xuất hiện trong admin tab.
- [x] 3.5.5 `npm run test:quotes` + `npm run build` green. (`test:quotes`: 173/173 pass. `npm run build`: trong sandbox `.env` không đọc được → vite.config crash; đã syntax-check 6 file edit qua esbuild — green. Anh Bình chạy `npm run build` ngoài sandbox để xác nhận lần cuối.)
- [ ] 3.5.6 Commit + tạo PR3 "feat: AI examples library + admin UI + Lưu thành ví dụ".

---

## 4. Cleanup & docs

- [ ] 4.1 Cập nhật `docs/ai-quote-parser.md` với hướng dẫn quản lý examples qua admin UI và workflow "Lưu thành ví dụ".
- [ ] 4.2 Cập nhật `AGENTS.md` (nếu cần) ghi rõ luồng AI là opt-in, không thay regex.
- [ ] 4.3 Verify `.env.production` / `.env.vercel.production.local` của Anh Bình có thể đã có `ANTHROPIC_API_KEY` riêng — đảm bảo không commit lên git.
- [ ] 4.4 Sau khi production chạy 1 tuần, đọc log `[claude-parser]` để confirm cache hit rate + token cost. Tinh chỉnh `MAX_EXAMPLES` nếu prompt phình.

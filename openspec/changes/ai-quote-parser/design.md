# Design: AI Quote Parser

## Context

Quote brief parsing hiện tại chạy ở `apps/api/parse-quote.js` thuần regex, được tối ưu cho format ngắn quy ước nội bộ Eventus. Khi sales paste cả đoạn chat hội thoại với khách (thường có hạng mục ngoài catalog và giá đã chốt), regex bỏ qua hạng mục lạ và luôn dùng giá tier mặc định, sales phải sửa tay nhiều dòng.

Hệ thống đã có sẵn:
- Schema response chuẩn `{ parsed: { items, location, duration_hours, tier_code, ... }, missing_fields, ambiguous_fields, ai_reasoning, pricing_meta }` được FE consume tại [QuoteCreatePage.jsx:981](../../../apps/web/src/features/quotes/pages/QuoteCreatePage.jsx).
- Pattern custom item (`is_custom: true, service_code: 'CUSTOM'`) cho phép item ngoài catalog với giá tự do.
- Cờ `is_overridden + original_unit_price + override_reason` cho phép giữ giá khác giá khung và hiển thị cảnh báo.
- Business rules (`applyBriefBusinessRules`) chạy tách khỏi parse — auto-add RECAP, multi-day grouping, single-combo grouping. Idempotent: nếu items đã có RECAP rồi, rule chỉ replace bracket sai chứ không double.
- Pricing calculator (`calculateQuotePricing`) tự xử lý overtime, VAT, travel fee — AI không cần biết.
- Pricing Admin có CRUD framework dataset-driven sẵn ([pricing-admin.js:86-126](../../../apps/api/pricing-admin.js)) — chỉ thêm 1 entry vào `DATASETS` là có CRUD endpoint mới.
- `.env.example` đã có placeholder `ANTHROPIC_API_KEY`.

Stakeholders: sales team (user trực tiếp), Pricing Admin (quản lý examples), dev (maintain prompt + code).

## Goals / Non-Goals

**Goals:**
- Cho phép sales paste cả đoạn chat → AI parse ra items + override giá đã chốt mà không phải sửa tay nhiều dòng.
- Hai luồng song song: regex (nhanh, free, không phụ thuộc network) và AI (mạnh hơn cho chat dài). Sales chọn nút mình muốn.
- Fallback an toàn: server thiếu key, API down, timeout, schema invalid — luồng cũ vẫn chạy bình thường, không ảnh hưởng sales.
- Sales/admin tự dạy AI qua UI khi gặp pattern mới, không cần dev sửa code.
- Chi phí dưới $25/tháng cho khối lượng hiện tại nhờ Haiku + prompt cache.

**Non-Goals:**
- Không thay thế regex parser — nó vẫn là default cho format brief ngắn quen thuộc.
- Không tự động gọi AI — sales phải bấm nút có chữ "AI 🪄". Tránh tốn token bất ngờ.
- Không train model riêng — chỉ dùng prompt + few-shot. Fine-tuning ngoài tầm.
- Không xây vector DB / RAG — examples library đơn giản (top-N rows từ MySQL theo `sort_order`).
- Không trích xuất `event_name`, contact info từ chat (Anh Bình đã chốt phase 1 không làm).
- Không expose key ra frontend — gọi qua `/api/parse-quote` của server.

## Decisions

### 1. AI là một mode của endpoint cũ, không phải endpoint riêng

Thêm trường `mode` vào body `POST /api/parse-quote`. Khi `mode === 'ai'` và có key, gọi Claude; ngược lại fallback regex.

**Tại sao:** giữ một đường code/test, một schema response, một probe endpoint. Frontend chỉ cần thay flag.

**Alternative bị loại:** endpoint riêng `/api/parse-quote-ai` — duplicate logic auth, business rules wrapping, cache logic.

### 2. Probe qua query param thay vì endpoint riêng

`GET /api/parse-quote?probe=1` trả `{ ai_available, model }`. Frontend gọi 1 lần khi mount `/quotes/new`, cache tới khi reload.

**Tại sao:** nhẹ, không phải thêm route, không phải qua nest controller mới.

### 3. Tool use thay vì JSON mode

Anthropic chưa có "JSON mode" như OpenAI. Cách tin cậy nhất để bắt structured output là tool use với `tool_choice: { type: 'tool', name: 'submit_parsed_quote' }`. AI bắt buộc trả về tool call duy nhất theo `input_schema` đã định.

**Tại sao:** schema validation tự động ở Anthropic side; nếu AI lệch schema, response sẽ fail trước khi về tới ta. Còn nếu fail thì retry 1 lần rồi fallback regex.

**Alternative bị loại:** parse JSON từ text — fragile, dễ mất newline trong example, khó debug.

### 4. Prompt structure 4-layer với cache_control trên 3 layer đầu

```
Layer 1 (vai trò) ─┐
Layer 2 (luật)     │ Đưa vào 1 message với cache_control:'ephemeral'
Layer 3 (catalog)  │ → cache hit lần 2 trong 5 phút, giảm cost ~4×
Layer 4 (examples)─┘
─── boundary ───
User chat (mỗi request khác nhau, không cache)
```

**Tại sao tách 4 layer:**
- Layer 1+2 hardcoded trong `claude-quote-prompt.js` — dev sửa khi thay đổi quy tắc.
- Layer 3 build runtime từ `pricing_services` đã load cho context — luôn đồng bộ với MySQL.
- Layer 4 = foundational examples từ `claude-quote-examples.js` (5–7 cái cố định) + custom examples từ MySQL `pricing_ai_parse_examples` (sales tự thêm).

**Cache lifetime 5 phút** = TTL Anthropic; hợp với pattern sales paste burst nhiều brief liên tiếp.

### 5. Phân vai AI vs business rules

AI **chỉ trích xuất nội dung từ chat**:
- Map `service_code` theo location (IN/OUT) + duration (4H/8H).
- Bóc số lượng, đơn vị, location, duration_hours, tier_code.
- Hạng mục ngoài catalog → `is_custom + group_code='OTHER'`.
- Giá chốt trong chat → `is_overridden + unit_price + override_reason`.
- Phụ kiện chat nhắc rõ (gimbal, capture card, drone permit...) → tự thêm.
- Item dựng/recap **chỉ trả khi chat có giá rõ ràng** (để override). Không có giá → bỏ qua, để rule tự thêm với giá khung.

`applyBriefBusinessRules` áp **đồng nhất** cho cả AI và regex output:
- Auto-add RECAP_X_CAM nếu thiếu (không double — check `itemLooksLikeRecapEdit`).
- Multi-day grouping (`Ngày 1:`, `Ngày 2:`).
- Single combo grouping cho brief 1 dòng.

`calculateQuotePricing` (FE) tự xử overtime, VAT, travel fee — AI tuyệt đối không tính tiền.

**Tại sao chia rạch ròi:** một nguồn cho luật pricing (`pricingCalculator.js`); prompt nhỏ gọn, không phải mô tả công thức tính tiền; hai luồng cho kết quả nhất quán ở step cuối.

### 6. Examples library: A (file JS) + C (MySQL admin UI) ngay từ phase 1

- **Foundational examples** trong `apps/api/lib/claude-quote-examples.js` — 5–7 cái dạy AI format chuẩn, không xóa lỡ tay.
- **Custom examples** trong MySQL `pricing_ai_parse_examples` — sales/admin tự thêm qua UI.

Loader merge cả hai trước khi nhét vào prompt:
```
buildExamplesSection(foundational, customRows) {
  const all = [...foundational, ...customRows.filter(r => r.is_active)]
  return all.sort(by sort_order).slice(0, MAX_EXAMPLES).map(toBlock).join('\n\n')
}
```

Cap số lượng (`MAX_EXAMPLES = 12`) để tránh prompt phình; sales muốn ưu tiên ví dụ nào thì sửa `sort_order` trong admin.

### 7. UI workflow — "Hướng C" cho việc lưu ví dụ

Sales bấm "Phân tích bằng AI" → kết quả parse render lên bảng items như bình thường. Sales sửa lại cho đúng (đổi service_code, sửa số lượng, sửa giá). Khi đã thấy items đúng, bấm **"Lưu thành ví dụ huấn luyện"** → modal popup với:
- `name` (auto-suggest từ một phần input + ngày)
- `input_text` = brief hiện tại (read-only, có thể sửa nhẹ)
- `expected_output` = snapshot items + location + duration_hours + tier_code hiện tại
- `notes` (optional)

→ Insert vào `pricing_ai_parse_examples` qua `/api/pricing-admin`. Lần parse tiếp theo (sau khi cache 5 phút expire), AI sẽ thấy ví dụ mới này.

**Tại sao chọn C:** workflow tự nhiên — sales đã quen làm việc trên bảng items. Không cần học UI thứ 2 để gõ JSON. Tận dụng UI sẵn có 100%.

**Trade-off chấp nhận:** không thể "lưu ví dụ trống và điền sau" — phải parse trước, sửa items, mới lưu. Đây không phải hạn chế thực tế vì sales luôn cần parse trước rồi.

### 8. Model mặc định: Claude Haiku 4.5

Override qua `QUOTE_PARSE_AI_MODEL`. Không hardcode, để dev đo chất lượng rồi chọn lại sau.

**Tại sao Haiku:** đủ thông minh cho task structured extraction (catalog 96 service rất rõ ràng), rẻ ~10× so với Sonnet 4.6, latency thấp.

### 9. Giá khung khác giá chat → AI set is_overridden

Anh Bình đã chốt: luôn lấy giá trong chat nếu phát hiện. AI trả:
```json
{
  "service_code": "CHUP_IN_4H",
  "quantity": 2,
  "unit_price": 1800000,
  "is_overridden": true,
  "override_reason": "Đã chốt với khách: 1tr8/người"
}
```

FE `normalizeParsedItem` cần tôn trọng cờ này thay vì luôn dùng `service.price_tier_X`. Sửa nhỏ ở [QuoteCreatePage.jsx:513-543](../../../apps/web/src/features/quotes/pages/QuoteCreatePage.jsx).

### 10. Frontend cache invalidation cho hai mode

`briefParser.js` có `parseCache` Map. Cache key hiện chỉ check `input_text + service codes`. Cần thêm `mode` vào cache key, không thì sales bấm "Phân tích nhanh" sau "AI" sẽ thấy lại kết quả AI cũ.

## Risks / Trade-offs

- **API key bị leak qua client bundle** → Mitigation: backend-only call. Loại bỏ dòng `VITE_ANTHROPIC_API_KEY` trong `.env.example`.

- **Anthropic API down hoặc trả 5xx khi sales đang parse** → Mitigation: try/catch trong `claude-quote-parser`, log warning, fallback `deterministicParseQuoteInput`. Response set `source: 'ai_fallback'` + `ai_reasoning` ghi rõ lý do để sales biết.

- **AI trả schema không match tool input_schema** → Mitigation: validate sau khi nhận; nếu fail, retry 1 lần với cùng prompt; vẫn fail → fallback regex. Log incident.

- **Sales spam nút "AI" → ăn token** → Mitigation: (a) cache FE theo input_text+mode, (b) cache BE in-memory 60s theo hash(input+mode), (c) prompt cache Anthropic giảm cost cache hit ~10×. Lưu telemetry số request/ngày để theo dõi.

- **Custom example sai (sales lưu output nhầm) → đầu độc AI** → Mitigation: (a) cờ `is_active` để admin tắt nhanh, (b) examples chỉ load top N theo `sort_order`, foundational luôn ở đầu, (c) admin UI có nút "test ngược" để paste lại input → xem AI có trả đúng output không (phase 2, không phải bây giờ).

- **AI không hiểu tên service mới khi admin thêm vào catalog** → Mitigation: catalog luôn build runtime từ `pricing_services`, không hardcode trong prompt. Service mới có ngay; không cần redeploy AI.

- **Token budget vượt khi catalog phình to** → Mitigation: compact format (chỉ code/name/price_tier_2/duration_tier/group), bỏ description. Hiện 96 service ~2K tokens; nếu lên 200+ vẫn dưới 4K, OK với Haiku 200k context.

- **JSON expected_output trong examples bị malformed** → Mitigation: backend `pricing-admin.js` validate `JSON.parse(expected_output)` trước khi insert, throw 400 nếu hỏng. UI form có nút "Format JSON" để đỡ lỗi cú pháp.

- **Multi-day brief paste cả chat (Ngày 1: ... Ngày 2: ...)** → AI có thể nhầm grouping. Mitigation: dạy AI bỏ qua grouping, luôn liệt kê items tuần tự — `applyMultiDayBriefGroups` sẽ tự nhóm sau. Có 1 few-shot ví dụ multi-day.

- **Phụ kiện đi kèm mơ hồ** → AI tự thêm gimbal/capture card/drone permit khi chat nhắc rõ. Khi mơ hồ ("đầy đủ thiết bị") thì bỏ qua — sales tự thêm tay. Có 1 few-shot ví dụ.

## Migration Plan

Chia thành 3 PR liên tiếp để dễ review và rollback từng phần:

**PR1 — Backend AI parser + fallback (không UI)**
1. Thêm `claude-quote-parser.js`, `claude-quote-prompt.js`, `claude-quote-examples.js`.
2. Sửa `parse-quote.js`: nhánh `mode === 'ai'`, probe handler.
3. Sửa `.env.example`: thêm `ANTHROPIC_API_KEY`, `QUOTE_PARSE_AI_MODEL`, `QUOTE_PARSE_AI_TIMEOUT_MS`. Bỏ `VITE_ANTHROPIC_API_KEY`.
4. Test mới mock fetch: success path, key trống, timeout, schema invalid.
5. Smoke test bằng curl.

**Verify PR1:** `npm run test:quotes` pass; `curl -X POST /api/parse-quote -d '{"input_text":"...","mode":"ai"}'` trả result hợp lệ; thiếu key → fallback regex; sai key → fallback regex.

**Rollback PR1:** revert commit. Frontend chưa có nút AI nên không user-facing.

**PR2 — Frontend 2 nút song song**
1. Sửa `briefParser.js`: thêm `parseQuoteInputWithAi`, `probeAiAvailability`. Cache key gồm `mode`.
2. Sửa `QuoteChatInput.jsx`: nút thứ 2 + state `aiAvailable + aiLoading`.
3. Sửa `QuoteCreatePage.jsx`: hàm `analyzeInputWithAi`, gọi probe ở `useEffect`. Cập nhật `normalizeParsedItem` để tôn trọng `is_overridden + unit_price` từ AI.

**Verify PR2:** vào `/quotes/new`, paste chat dài có MC, bấm AI → thấy MC làm custom item với giá đúng. Bấm "Phân tích nhanh" sau đó → thấy regex output.

**Rollback PR2:** revert frontend commit. Backend AI mode vẫn còn nhưng không ai gọi.

**PR3 — Examples DB + admin UI + nút "Lưu ví dụ"**
1. Thêm bảng `pricing_ai_parse_examples` vào `docs/mysql-schema.sql`.
2. Sửa `scripts/migrate-mysql.mjs` để áp schema mới.
3. Sửa `pricing-admin.js`: dataset `ai_parse_examples` với `expected_output` validate JSON.
4. Sửa `lib/pricing-context.js`: helper `getActiveAiParseExamples()` cache 5 phút.
5. Sửa `claude-quote-parser.js`: load custom examples + merge với foundational.
6. Sửa `PricingAdminPage.jsx`: tab + JSON renderer ('json' field type).
7. Sửa `QuoteCreatePage.jsx`: nút "Lưu thành ví dụ" + modal snapshot items hiện tại.

**Verify PR3:** chạy `npm run db:migrate`, vào Pricing Admin thấy tab AI Examples; thêm 1 ví dụ; vào `/quotes/new` paste brief tương tự ví dụ → thấy AI parse đúng theo ví dụ. Bấm "Lưu thành ví dụ" sau parse → record xuất hiện trong admin.

**Rollback PR3:** revert code; bảng MySQL có thể giữ (data không hại). Nếu muốn clean → `drop table pricing_ai_parse_examples`.

## Open Questions

Không còn câu hỏi mở quan trọng — Anh Bình đã chốt:
- Hướng B (2 nút song song) cho UX.
- Option 2 (luôn lấy giá chat).
- `OTHER` cho is_custom group.
- A+C cho examples library.
- Hướng C (snapshot từ items hiện tại) cho "Lưu ví dụ".
- Phụ kiện đi kèm: AI tự thêm khi chat nhắc rõ.
- Dựng có giá riêng: AI trả; không có giá: rule tự thêm.

Câu hỏi nhỏ chỉ ở mức implementation, sẽ giải quyết trong tasks:
- Tên cụ thể cho field type 'json' renderer (gọi 'json' hay 'json-textarea'?).
- Default `MAX_EXAMPLES` (đề xuất 12, có thể chỉnh khi đo).
- Format `name` slug auto-suggest cho example mới (đề xuất `chat-${YYYYMMDD}-${random4}`).

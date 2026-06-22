# Proposal: AI Quote Parser

## Why

Sales team Eventus đang phải sửa tay rất nhiều khi paste cả đoạn chat khách hàng vào ô brief ở `/quotes/new`. Lý do: parser hiện tại (`apps/api/parse-quote.js`) là một bộ regex tiếng Việt được tối ưu cho format ngắn `"2 chụp, 1 quay, 5 tiếng, Hải Phòng, khách lạ"`. Khi đầu vào là hội thoại tự nhiên có hạng mục ngoài catalog (MC, LED, hoa, BTC quà tặng) hoặc giá đã chốt khác giá khung, regex bỏ qua hết — sales phải:

- Tự thêm từng custom item, gõ lại tên + đơn vị + giá.
- Override giá tiền khi sales đã chốt với khách trong chat khác giá tier mặc định.
- Đoán mức nhóm (PHOTO/VIDEO/...) cho item lạ.

Giờ team có thể trả tiền API Claude với chi phí <$25/tháng cho ~100 lần parse/ngày. Đây là lúc thêm một luồng AI làm nhanh cho case "paste cả chat", đồng thời tạo cơ chế để sales/admin tự dạy thêm AI khi gặp pattern mới — không cần dev can thiệp.

## What Changes

- **Thêm tuỳ chọn AI** cho luồng parse brief: `/quotes/new` có thêm nút "Phân tích bằng AI 🪄" đứng cạnh nút "Phân tích nhanh" hiện tại. AI gọi Claude qua server-side, không lộ API key ra trình duyệt.
- **Giữ nguyên luồng regex** làm fallback: khi `ANTHROPIC_API_KEY` trống, khi API lỗi, hoặc khi AI trả schema sai, hệ thống tự rớt về `deterministicParseQuoteInput` cũ. User vẫn dùng được "Phân tích nhanh" mọi lúc.
- **AI tôn trọng giá trong chat**: nếu sales đã chốt giá với khách (cả service trong khung lẫn ngoài khung), AI set `is_overridden=true` và đặt `unit_price` theo chat. Giá khung giữ ở `original_unit_price` để pipeline tính tiền hiện tại vẫn show "đã sửa khác khung".
- **Hạng mục ngoài khung** → `is_custom=true`, `service_code='CUSTOM'`, `group_code='OTHER'`, dùng đúng pattern custom item đã có.
- **Business rules vẫn áp đồng nhất** cho cả AI lẫn regex: `applyBriefBusinessRules` (multi-day grouping, single combo grouping, default RECAP auto-add) chạy sau khi parse, không phân biệt nguồn.
- **AI examples library trong MySQL**: sales/admin có thể "lưu ví dụ huấn luyện" trực tiếp từ kết quả parse hoặc quản lý qua tab mới trong `/pricing-admin`. Mỗi example được nhét vào prompt cho lần parse tiếp theo (cache 5 phút).
- **Probe AI availability**: `GET /api/parse-quote?probe=1` cho frontend biết AI có sẵn không, để disable nút khi server thiếu key.
- **Prompt caching**: dùng Anthropic `cache_control` cho phần system + catalog + examples để giảm chi phí ~4×.

## Capabilities

### New Capabilities

- `ai-quote-parser`: bao gồm endpoint AI mode, contract schema cho output, fallback rules, prompt structure (vai trò + luật biên dịch + catalog + examples), probe endpoint, cache layer.
- `ai-parse-examples`: bảng MySQL `pricing_ai_parse_examples`, CRUD qua `/api/pricing-admin`, UI tab trong Pricing Admin, nút "Lưu thành ví dụ" trên `/quotes/new`, cơ chế load examples vào prompt.

### Modified Capabilities

Chưa có spec sẵn trong `openspec/specs/` (project mới init OpenSpec). Không có capability cũ cần modify ở dạng spec — toàn bộ thay đổi vào logic backend `apps/api/parse-quote.js` và UI `/quotes/new` được mô tả như impact đến code, không phải delta spec.

## Impact

**Backend (apps/api/):**
- `parse-quote.js`: thêm branch `mode === 'ai'`, probe handler, fallback wiring.
- `lib/claude-quote-parser.js` (mới): logic gọi Anthropic + build prompt.
- `lib/claude-quote-prompt.js` (mới): hardcoded Layer 1+2 (vai trò + luật biên dịch).
- `lib/claude-quote-examples.js` (mới): foundational few-shot examples (5–7 cái).
- `lib/pricing-context.js`: thêm helper load `ai_parse_examples` (cache TTL 5 phút).
- `pricing-admin.js`: thêm dataset `ai_parse_examples` vào CRUD framework có sẵn.

**Frontend (apps/web/src/):**
- `features/quotes/components/QuoteChatInput.jsx`: thêm nút thứ 2 + state `aiAvailable`/`aiLoading`.
- `features/quotes/lib/briefParser.js`: thêm `parseQuoteInputWithAi()` + `probeAiAvailability()`.
- `features/quotes/pages/QuoteCreatePage.jsx`: handler `analyzeInputWithAi`, modal "Lưu ví dụ", tôn trọng `is_overridden` từ AI khi normalize item.
- `features/pricing-admin/pages/PricingAdminPage.jsx`: tab mới + JSON form renderer.

**Database:**
- Bảng mới `pricing_ai_parse_examples` trong `docs/mysql-schema.sql` + script migrate.

**External dependencies:**
- Không thêm npm package (dùng `fetch` thẳng vào `https://api.anthropic.com/v1/messages`).
- `.env.example`: thêm `ANTHROPIC_API_KEY`, `QUOTE_PARSE_AI_MODEL`, `QUOTE_PARSE_AI_TIMEOUT_MS`. Bỏ `VITE_ANTHROPIC_API_KEY` để tránh hiểu lầm rằng key có thể đặt phía client.

**Test:**
- `apps/api/parse-quote.test.js`: thêm test mock fetch cho mode AI, verify fallback khi key trống / timeout / schema invalid.
- Test mới cho `lib/claude-quote-parser.js`: build prompt, validate schema.

**Cost:**
- Claude Haiku 4.5 với prompt cache: ~$0.0015/lần parse AI. Ước tính <$5/tháng cho khối lượng hiện tại. Nếu cần upgrade Sonnet/Opus, đổi qua env `QUOTE_PARSE_AI_MODEL`.

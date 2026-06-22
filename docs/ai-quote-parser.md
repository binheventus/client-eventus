# AI Quote Parser

Hệ thống `/api/parse-quote` hỗ trợ 2 chế độ phân tích sales brief:

- **Regex (mặc định)** – chạy `deterministicParseQuoteInput`, không gọi API ngoài. Phù hợp brief ngắn theo format nội bộ (`2 chụp 1 quay 5 tiếng Hải Phòng`).
- **AI (opt-in)** – gọi Claude qua proxy/endpoint Anthropic-compatible. Phù hợp brief dài / chat hội thoại có hạng mục ngoài catalog (MC, LED, hoa, …) hoặc giá đã chốt khác giá khung.

PR1 chỉ thêm backend; FE vẫn chưa có nút bấm — gọi qua curl để smoke test (xem cuối file).

## Bật / tắt AI

Set 4 biến môi trường trong `.env` (xem `.env.example`):

```
ANTHROPIC_API_KEY=sk-...               # bắt buộc nếu muốn bật AI
ANTHROPIC_BASE_URL=https://api.coffeevibeai.com  # mặc định proxy nội bộ; đổi sang api.anthropic.com nếu cần
QUOTE_PARSE_AI_MODEL=claude-haiku-4-5-20251001    # đổi sang claude-sonnet-4-6 nếu muốn upgrade chất lượng
QUOTE_PARSE_AI_TIMEOUT_MS=20000        # timeout gọi Anthropic; quá ngưỡng → fallback regex
```

- **Khi `ANTHROPIC_API_KEY` trống**: handler vẫn trả 200 nhưng `source: 'ai_fallback'` cho mọi request `mode=ai`. Frontend probe `GET /api/parse-quote?probe=1` để biết key có sẵn không và disable nút "Phân tích bằng AI".
- **Khi Anthropic API lỗi / timeout / schema mismatch**: handler retry 1 lần (chỉ với schema mismatch) rồi fallback regex, gắn `source: 'ai_fallback'` và prepend lý do vào `ai_reasoning`.

## API contract

### `POST /api/parse-quote`

Body:

```json
{
  "input_text": "2 chụp 1 quay 5 tiếng Hải Phòng",
  "mode": "ai"
}
```

Response (cả 2 mode):

```json
{
  "parsed": { "items": [...], "location": "...", "duration_hours": 5, "tier_code": "TIER_2", "num_days": 1 },
  "missing_fields": [],
  "ambiguous_fields": [],
  "ai_reasoning": "...",
  "pricing_meta": { ... },
  "source": "regex" | "ai" | "ai_fallback"
}
```

### `GET /api/parse-quote?probe=1`

Trả `{ "ai_available": true, "model": "claude-haiku-4-5-20251001" }` khi key có sẵn; `{ "ai_available": false, "model": null }` khi không. Endpoint không gọi Anthropic.

## Cấu trúc code

- `apps/api/parse-quote.js` – handler entry, branch theo `mode`, áp `applyBriefBusinessRules` và cache 60s.
- `apps/api/lib/claude-quote-parser.js` – client Anthropic: build prompt 4-layer, tool call `submit_parsed_quote`, retry, telemetry.
- `apps/api/lib/claude-quote-prompt.js` – Layer 1+2 (vai trò + luật biên dịch tiếng Việt). Sửa file này khi thay đổi quy tắc parser.
- `apps/api/lib/claude-quote-examples.js` – `FOUNDATIONAL_EXAMPLES` (5–7 cái cố định). Thêm ví dụ mới ở đây khi muốn dạy pattern mới mà KHÔNG phụ thuộc admin UI.
- Layer 3 (catalog dịch vụ) build runtime từ `pricing_services` qua `getPricingContext()` → luôn đồng bộ MySQL.
- Layer 4 = foundational + (PR3) custom examples từ MySQL `pricing_ai_parse_examples`. Cap `MAX_EXAMPLES = 12`.

## Cache & performance

- **Server cache**: 60s in-memory theo `hash(input_text + mode)` chống double-click.
- **Anthropic prompt cache**: block system gắn `cache_control: { type: 'ephemeral' }` → 5 phút TTL phía Anthropic, giảm cost ~10× cho cache hit.
- Telemetry log dạng `[claude-parser] model=... tokens_in=... tokens_out=... cache_read_tokens=... latency_ms=...`. Không log nội dung chat.

## Smoke test thủ công

```bash
# 1. Set ANTHROPIC_API_KEY thật vào .env
# 2. Khởi động dev server
npm run dev:background

# 3. Test mode=ai (cookies từ session đã đăng nhập)
curl -s -X POST http://localhost:3000/api/parse-quote \
  -H 'content-type: application/json' \
  --cookie "$(cat .session-cookie)" \
  -d '{"input_text":"2 chụp 1 quay 5 tiếng Hải Phòng","mode":"ai"}' | jq

# 4. Probe
curl -s 'http://localhost:3000/api/parse-quote?probe=1' \
  --cookie "$(cat .session-cookie)" | jq

# 5. Tắt key trong .env, restart, test lại → source phải là ai_fallback
```

## Phase roadmap

- **PR1 (file này)**: backend AI + fallback + tests, chưa có UI.
- **PR2**: frontend nút "Phân tích bằng AI" trên `/quotes/new`, probe khi mount, tôn trọng `is_overridden` từ AI.
- **PR3**: bảng `pricing_ai_parse_examples` + tab admin trong `/pricing-admin` + nút "Lưu thành ví dụ" để sales tự dạy AI.

# Trợ lý feedback AI (tóm tắt comment + viết lại lời nhắn)

Tính năng cho **Editor** trên trang duyệt video `/feedbacks/:share_token`:

1. **Tóm tắt việc cần sửa** — gom các comment **chưa sửa** (`is_done_1 = 0`) của một bản feedback thành checklist phân nhóm theo loại việc dựng (`audio`, `color`, `cut`, `text`, `branding`, `content`, `other`), mỗi việc kèm timecode + `comment_ids`, cùng cờ **trùng/mâu thuẫn** và **chưa rõ**.
2. **AI viết lại lời nhắn** — Editor gõ lý do thô (thường là lý do *không sửa được* một yêu cầu), AI viết lại thành 1–3 phiên bản lời nhắn tiếng Việt lịch sự, thuyết phục để gửi khách (có "Đổi cách nói").

Tái dùng nguyên khuôn client Anthropic của quote parser (forced tool-call + JSON schema, prompt cache `ephemeral`, timeout, retry schema-mismatch, telemetry KHÔNG log nội dung, fallback an toàn).

## Lối vào ẩn, KHÔNG thêm đăng nhập

- Lối vào là cụm chữ **"All rights reserved"** trong dòng copyright ở footer của `FeedbackDetailPage.jsx` — ngụy trang như text (`cursor-default`, màu chữ footer), giống cách giấu nút "Cài đặt Feedback" sau logo và popup tin nhắn sau nhãn "Editor:". Khách không thấy nút tính năng ở khu vực chính.
- Khi `footerStatus` đang hiển thị (thông báo tạm sau khi lưu link), copyright bị thay tạm → trigger ẩn trong lúc đó (transient, chấp nhận được).
- Backend cấp quyền cho 2 action AI qua `assertFeedbackAccess` (share token hoặc phiên) **như mọi action feedback khác** — không thêm cờ quyền, không thêm login.
- Panel chỉ mở khi **AI khả dụng** (probe) **và** số comment chưa sửa **≥ 6** (`MIN_UNRESOLVED_COMMENTS` trong `FeedbackAiAssist.jsx`). Thiếu key → trigger không làm gì (degrade an toàn, coi như ẩn).

## Bật / tắt AI

Dùng chung key với quote parser; thêm 2 ENV tùy chọn riêng (xem `.env.example`):

```
ANTHROPIC_API_KEY=sk-...                          # bắt buộc nếu muốn bật AI; trống = tắt mềm toàn tính năng
ANTHROPIC_BASE_URL=https://api.coffeevibeai.com   # proxy nội bộ mặc định
FEEDBACK_SUMMARY_AI_MODEL=claude-haiku-4-5-20251001   # mặc định trùng quote parser
FEEDBACK_SUMMARY_AI_TIMEOUT_MS=20000                  # timeout gọi Anthropic; quá ngưỡng → ai_unavailable
```

- **Thiếu `ANTHROPIC_API_KEY`**: `probe` trả `ai_available: false`; trigger không mở panel; mọi thao tác feedback khác vẫn chạy bình thường.
- **Lỗi / timeout / sai schema**: tầng điều phối trả `{ source: 'ai_unavailable', reason }` thay vì ném lỗi cứng; UI báo "không khả dụng" gọn, không phá phần còn lại.

## API contract

Tất cả đi qua `POST/GET /api/feedback` (cùng handler module feedback), cấp quyền qua `access: { token }` (share token) hoặc phiên đăng nhập.

### `POST` — `action: "summarize_comments"`

```json
{ "action": "summarize_comments", "feedback_id": "<id|share_token>", "access": { "token": "<share_token>" } }
```

Response khi AI khả dụng:

```json
{
  "source": "ai",
  "model": "claude-haiku-4-5-20251001",
  "unresolved_count": 9,
  "cached": false,
  "summary": "…",
  "task_count": 7,
  "groups": [
    { "category": "audio", "label": "Âm thanh", "items": [ { "task": "…", "timecodes": [12], "comment_ids": ["123"] } ] }
  ],
  "conflicts": [ { "description": "…", "comment_ids": ["1","2"] } ],
  "unclear": [ { "timecode": 30, "original": "…", "why": "…", "comment_ids": ["3"] } ]
}
```

Khi không khả dụng: `{ "source": "ai_unavailable", "reason": "no_api_key" | "no_comments" | "error" | "SCHEMA_MISMATCH" | ... }`.

### `POST` — `action: "rewrite_reply"`

```json
{ "action": "rewrite_reply", "feedback_id": "<id|share_token>", "access": { "token": "<share_token>" },
  "raw_text": "không làm nét logo được vì file gốc phân giải thấp", "context": "<task liên quan, tùy chọn>", "tone": "<tùy chọn>" }
```

- `raw_text` rỗng → backend trả lỗi `400 EMPTY_RAW_TEXT` (UI cũng disable nút khi rỗng).
- Response khả dụng: `{ "source": "ai", "model": "...", "replies": ["…", "…"] }`.

### `GET` — `resource: "ai_probe"`

`GET /api/feedback?resource=ai_probe` → `{ "ai_available": true, "model": "claude-haiku-4-5-20251001" }`. Không gọi mô hình; là endpoint public (như survey/gallery) để trang share-token probe khi mount.

## Cấu trúc code

- `apps/api/lib/claude-feedback-summary.js` — **tầng AI thuần**: 2 tool (`submit_feedback_summary`, `submit_rewritten_reply`), system prompt, prompt cache `ephemeral`, retry schema-mismatch, telemetry chỉ-số-đo. Export `summarizeFeedbackComments(comments, options)`, `rewriteReply(rawText, options)`.
- `apps/api/lib/feedback-ai-assist.js` — **tầng điều phối**: nạp comment chưa sửa qua `query`/`tables`, map sang input AI, cache in-memory ~5' cho tóm tắt, fallback mềm. Export `summarizeComments(feedback)`, `rewriteReply({ rawText, context, tone })`, `probe()`. KHÔNG chứa auth.
- `apps/api/feedback.js` — điểm tích hợp duy nhất: `import * as feedbackAi`, 2 nhánh POST + 1 nhánh GET `ai_probe`, 2 entry trong `isPublicFeedbackRequest`. Không sửa `getFeedbackPermissions`.
- `apps/web/src/features/feedback/hooks/useFeedbackAi.js` — client API riêng (`summarizeFeedbackComments`, `rewriteFeedbackReply`, `probeFeedbackAi`).
- `apps/web/src/features/feedback/components/FeedbackAiAssist.jsx` — UI tự chứa (probe, ngưỡng 6, panel tóm tắt + seek timecode, công cụ viết lại).
- `apps/web/src/features/feedback/pages/FeedbackDetailPage.jsx` — tích hợp tối thiểu: 1 import, state `aiAssistOpen`, trigger "All rights reserved", render `<FeedbackAiAssist />`.

## Cache & bảo mật

- **Cache tóm tắt**: in-memory ~5 phút theo `sha1(feedback_id + tập comment chưa sửa)`; mở lại khi comment không đổi → phục vụ từ cache (`cached: true`), không gọi AI lại. `rewrite_reply` không cache.
- **Prompt cache Anthropic**: block system gắn `cache_control: { type: 'ephemeral' }`.
- **Không log nội dung**: telemetry chỉ `[claude-feedback] tool=… model=… tokens_in=… tokens_out=… cache_read_tokens=… latency_ms=…`, không in comment/lý do.

## Smoke test thủ công

1. Mở một bản feedback có **≥ 6 comment chưa sửa**.
2. Bấm cụm **"All rights reserved"** ở footer → panel mở, kiểm tra nhóm việc + bấm timecode để seek video.
3. Gõ 1 lý do "không sửa được" → **Viết lại bằng AI** → kiểm tra `replies`, thử **Đổi cách nói**, **Copy**.
4. Tắt `ANTHROPIC_API_KEY` → restart → bấm trigger **không làm gì**; các thao tác feedback khác (comment, reply, đánh dấu đã sửa, đổi link) vẫn chạy.

## Gỡ bỏ (teardown gọn)

Để bỏ hẳn tính năng:

1. Xóa `apps/api/lib/claude-feedback-summary.js` và `apps/api/lib/feedback-ai-assist.js`.
2. Trong `apps/api/feedback.js`: xóa dòng `import * as feedbackAi …`, 2 nhánh POST (`summarize_comments`, `rewrite_reply`), nhánh GET `ai_probe`, và 2 entry + `ai_probe` trong `isPublicFeedbackRequest`.
3. Xóa `apps/web/src/features/feedback/components/FeedbackAiAssist.jsx` và `apps/web/src/features/feedback/hooks/useFeedbackAi.js`.
4. Trong `FeedbackDetailPage.jsx`: xóa import `FeedbackAiAssist`, state `aiAssistOpen`, onClick bọc "All rights reserved" (khôi phục `<span>{footerCopyright}</span>` nếu muốn), và thẻ `<FeedbackAiAssist />`.
5. Xóa test `apps/api/feedback-ai-assist.test.js`.
6. (Tùy chọn) gỡ ENV `FEEDBACK_SUMMARY_AI_*` trong `.env.example` và file `docs/ai-feedback-summary.md`.

Không đụng schema MySQL, không đụng `getFeedbackPermissions`, không ảnh hưởng các action feedback khác.

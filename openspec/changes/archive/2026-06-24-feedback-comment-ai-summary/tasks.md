## 1. Backend — Client AI thuần (file riêng)

- [x] 1.1 Tạo `apps/api/lib/claude-feedback-summary.js` mirror `claude-quote-parser.js`: helper `getAiBaseUrl/getAiModelName/getAiTimeoutMs/hasAnthropicKey`, `callAnthropicOnce`, retry schema-mismatch, `logTelemetry` (chỉ số đo, KHÔNG log nội dung). Tầng thuần AI, không biết HTTP/DB.
- [x] 1.2 Tool `submit_feedback_summary`: input `summary`, `task_count`, `groups[]{category∈(audio,color,cut,text,branding,content,other), label, items[]{timecodes[], task, comment_ids[]}}`, `conflicts[]{description, comment_ids[]}`, `unclear[]{timecode, original, why, comment_ids[]}` — KHÔNG có draft_reply.
- [x] 1.3 Tool `submit_rewritten_reply`: input `replies[]` (1–3 phiên bản tiếng Việt). Prompt: chỉ diễn giải đúng lý do Editor cung cấp cho lịch sự/thuyết phục, được gợi ý phương án, KHÔNG bịa thông tin mới.
- [x] 1.4 System prompt tóm tắt (vai trò editor video + bộ phân loại cố định + chỉ dùng comment được cung cấp), gắn `cache_control: ephemeral`.
- [x] 1.5 Export `summarizeFeedbackComments(comments, options)`, `rewriteReply(rawText, options)`; ném lỗi `NO_API_KEY`/`SCHEMA_MISMATCH` đúng khuôn parser.

## 2. Backend — Tầng điều phối tách biệt (file riêng)

- [x] 2.1 Tạo `apps/api/lib/feedback-ai-assist.js`: nhận `feedback` (đã được handler cấp quyền), tự nạp comment chưa sửa (`is_done_1 = 0`) qua `query`/`tables`, map sang input AI `{comment_id, time_comment_1, comment_1, author_name}`, gọi client AI. KHÔNG chứa logic auth.
- [x] 2.2 Export `summarizeComments(feedback)` (có cache in-memory ~5' theo `hash(feedback_id + tập comment chưa sửa)`), `rewriteReply({ rawText, context, tone })` (không cache), `probe()` trả `{ ai_available, model }` dùng `hasAnthropicKey()`.
- [x] 2.3 Fallback nội bộ: thiếu key/timeout/lỗi/sai schema → trả `{ source: 'ai_unavailable' }` thay vì ném lỗi cứng.

## 3. Backend — Điểm tích hợp tối thiểu trong feedback.js

- [x] 3.1 Thêm `import * as feedbackAi from './lib/feedback-ai-assist.js'`.
- [x] 3.2 POST: thêm nhánh `summarize_comments` và `rewrite_reply` — mỗi nhánh **tái dùng** `getFeedbackByIdentifier` + `assertFeedbackAccess(req, feedback, parseAccess(body))` rồi giao cho `feedbackAi`. KHÔNG sửa `getFeedbackPermissions`.
- [x] 3.3 GET: thêm nhánh `resource: 'ai_probe'` trả `feedbackAi.probe()` (không gọi AI).
- [x] 3.4 Thêm `summarize_comments`, `rewrite_reply` vào danh sách trong `isPublicFeedbackRequest`.

## 4. Backend — Tests

- [x] 4.1 Test `summarize_comments` chỉ lấy comment `is_done_1 = 0`; bỏ qua comment đã sửa.
- [x] 4.2 Test `rewrite_reply`: từ chối khi `raw_text` rỗng; trả `replies` không rỗng khi có input (mock client).
- [x] 4.3 Test fallback khi thiếu `ANTHROPIC_API_KEY` (mock) trả không khả dụng, không ném lỗi cứng; các action feedback khác không bị ảnh hưởng.
- [x] 4.4 Test cache tóm tắt phục vụ lại khi tập comment không đổi (đếm số lần gọi client bằng mock).

## 5. Frontend — Hook & component tách biệt (file riêng)

- [x] 5.1 Tạo `apps/web/src/features/feedback/hooks/useFeedbackAi.js`: `summarizeFeedbackComments(feedbackId, access)`, `rewriteFeedbackReply(feedbackId, { rawText, context, tone }, access)`, `probeFeedbackAi()`. (KHÔNG nhét vào `useFeedback.js` chung.)
- [x] 5.2 Tạo `apps/web/src/features/feedback/components/FeedbackAiAssist.jsx` tự chứa toàn bộ UI; props `{ open, onClose, feedback, comments, access, onSeek }`: probe khi mount; chỉ cho mở khi AI khả dụng && số comment chưa sửa ≥ 6.
- [x] 5.3 Trong component: panel tóm tắt (câu tóm tắt + tổng số việc; mỗi nhóm label/emoji; việc kèm timecode bấm `onSeek`); khối Mâu thuẫn & Chưa rõ kèm `comment_ids`/timecode.
- [x] 5.4 Trong component: công cụ "AI viết lại lời nhắn" — ô nhập lý do thô (gắn ngữ cảnh mục việc khi mở từ một mục), nút "Viết lại bằng AI" (vô hiệu khi rỗng), hiện `replies` với Copy và "Đổi cách nói" (tone); loading/lỗi/không khả dụng gọn, không phá phần còn lại.

## 6. Frontend — Trigger ẩn ở "All rights reserved"

- [x] 6.1 Trong `FeedbackDetailPage.jsx`: 1 import, 1 state `aiAssistOpen`, render `<FeedbackAiAssist open={aiAssistOpen} onClose=... feedback comments access onSeek={seekTo} />`.
- [x] 6.2 Bọc cụm "All rights reserved" trong dòng copyright footer thành phần tử bấm được (ngụy trang như text: `cursor-default`, màu chữ footer) `onClick={() => setAiAssistOpen(true)}`; khi `footerStatus` đang hiển thị thì hiện trạng thái, không bọc trigger.

## 7. Cấu hình & tài liệu

- [x] 7.1 Thêm ENV tùy chọn `FEEDBACK_SUMMARY_AI_MODEL`, `FEEDBACK_SUMMARY_AI_TIMEOUT_MS` vào `.env.example` (mặc định trùng quote parser).
- [x] 7.2 Thêm `docs/ai-feedback-summary.md`: bật/tắt, API contract (summarize + rewrite + probe), vị trí lối vào ẩn ("All rights reserved"), fallback, không log nội dung, và **mục "Gỡ bỏ"** liệt kê các file/điểm tích hợp cần xóa.

## 8. Verification

- [x] 8.1 Chạy `npm run test:quotes` (hoặc runner liên quan) đảm bảo test mới xanh. → 196/196 pass (gồm `feedback-ai-assist.test.js`).
- [x] 8.2 Chạy `npm run build` đảm bảo exit code 0. → Đã chạy build local xanh (exit 0).
- [x] 8.3 Smoke test: feedback ≥ 6 comment chưa sửa → bấm "All rights reserved" → kiểm tra nhóm/timecode; nhập 1 lý do "không sửa được" → viết lại → kiểm tra lời nhắn; tắt key → trigger không làm gì và các thao tác feedback khác vẫn chạy. → Đã smoke test thủ công OK.

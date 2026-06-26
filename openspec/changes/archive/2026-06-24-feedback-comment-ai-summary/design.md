## Context

Module feedback (`apps/api/feedback.js`, `apps/web/src/features/feedback/`) là công cụ duyệt video: khách để comment theo mốc thời gian (`client_feedback_comments`), Editor reply và đánh dấu đã sửa. Trang `FeedbackDetailPage.jsx` phục vụ cả Editor lẫn khách trên cùng route `/feedbacks/:share_token`; **không có cơ chế đăng nhập riêng** — các action feedback cấp quyền qua `assertFeedbackAccess` (share token hoặc phiên sẵn có).

Công cụ chỉ-Editor hiện được "giấu" bằng affordance ngụy trang ở footer (thanh chữ xám 11px): bấm **logo footer** → modal "Cài đặt Feedback"; nhãn **"Editor:"** (`cursor-default`) → popup tin nhắn khách. Người dùng muốn giấu lối vào tính năng mới vào cụm chữ **"All rights reserved"** trong dòng copyright footer (`<span>{footerCopyright}</span>`, ~dòng 2493) — KHÔNG thêm login.

Dự án đã có client Anthropic chín trong `apps/api/lib/claude-quote-parser.js` + handler `apps/api/parse-quote.js`: gọi `/v1/messages` qua proxy `ANTHROPIC_BASE_URL`, ép tool-call theo JSON schema, prompt cache `ephemeral`, timeout, retry sai schema, telemetry không log nội dung, probe `?probe=1`.

Phạm vi đã chốt: chỉ comment chưa sửa (`is_done_1 = 0`); ngưỡng hiện nút **6**; bỏ nháp reply tự động, thay bằng công cụ **viết lại lý do thô của Editor** thành lời nhắn khách thuyết phục. **Yêu cầu kiến trúc của người dùng: phần này phải hoạt động tương đối độc lập, không ảnh hưởng chức năng còn lại, và sau này gỡ bỏ phải dễ & gọn.**

## Goals / Non-Goals

**Goals:**
- Giảm thời gian Editor đọc & gom comment thủ công bằng checklist phân nhóm theo loại việc dựng, gắn timecode và `comment_ids`.
- Khi không sửa được một yêu cầu, giúp Editor soạn nhanh lời nhắn khách từ một lý do gõ vội.
- **Tách biệt tối đa:** dồn code vào module/component riêng; điểm tích hợp vào file hiện có ở mức tối thiểu để bật/tắt/gỡ dễ.
- Tái dùng hạ tầng AI hiện có; chi phí thấp, fallback an toàn; KHÔNG thêm login, KHÔNG đổi schema MySQL, KHÔNG thêm npm dependency.

**Non-Goals:**
- Vision (ảnh đính kèm), lưu DB, nháp reply tự động "đã sửa", sentiment survey, tìm kiếm ngữ nghĩa.

## Decisions

### 1. Client AI riêng: `apps/api/lib/claude-feedback-summary.js`
Mirror `claude-quote-parser.js` (cùng `callAnthropicOnce`, forced `tool_choice`, prompt cache, timeout, retry schema-mismatch, `logTelemetry` không log nội dung). Export 2 hàm + 2 tool schema: `summarizeFeedbackComments` (tool `submit_feedback_summary`) và `rewriteReply` (tool `submit_rewritten_reply`). Đây là tầng thuần AI, không biết gì về HTTP/DB.

### 2. Schema output tóm tắt — KHÔNG kèm reply tự động
`groups[]`: `{ category ∈ {audio,color,cut,text,branding,content,other}, label, items[]{ timecodes[], task, comment_ids[] } }`. `conflicts[]{ description, comment_ids[] }`. `unclear[]{ timecode, original, why, comment_ids[] }`. Cộng `summary`, `task_count`. Bỏ draft_reply theo yêu cầu (reply tách sang tool riêng); giữ output gọn, map `comment_ids` về dữ liệu thật để seek timecode.

### 3. Tool viết lại lời nhắn (rewrite_reply)
Input: `raw_text` (lý do/ghi chú thô) + tùy chọn `context` (task/comment liên quan) + tùy chọn `tone`. Output: `replies[]` (1–3 phiên bản tiếng Việt). Prompt: chỉ diễn giải đúng lý do Editor cung cấp cho lịch sự/thuyết phục, được gợi ý phương án, KHÔNG bịa thông tin mới.

### 4. Lối vào ẩn = cụm chữ "All rights reserved" ở footer, KHÔNG login
Bọc cụm "All rights reserved" trong dòng copyright thành phần tử bấm được, ngụy trang như text (giống nút "Editor:": `cursor-default`, màu chữ footer). Bấm → mở panel AI assist. Khi `footerStatus` đang hiển thị (thông báo tạm sau khi lưu link), copyright bị thay tạm → trigger ẩn trong lúc đó (chấp nhận được, transient). Backend `summarize_comments`/`rewrite_reply` cấp quyền qua `assertFeedbackAccess` như mọi action feedback.
- **Vì sao**: người dùng chỉ định cụm này; không thêm login; nhất quán cách giấu hiện có.

### 5. Trigger on-demand + probe + ngưỡng 6
Panel/nút tóm tắt chỉ kích hoạt khi AI khả dụng (probe, tái dùng `hasAnthropicKey()`) && số comment chưa sửa ≥ 6 (cấu hình được). Tóm tắt và viết lại chạy khi Editor chủ động bấm.

### 6. Cache in-memory theo nội dung (chỉ cho tóm tắt)
Cache ~5' theo `hash(feedback_id + danh sách {comment_id,is_done_1,comment_1,time_comment_1} chưa sửa)`. Rewrite_reply không cache.

### 7. Kiến trúc tách biệt & dễ gỡ (yêu cầu cốt lõi của người dùng)
Toàn bộ tính năng dồn vào file riêng; file hiện có chỉ thêm điểm tích hợp tối thiểu, không sửa logic sẵn có.

**Backend**
- `apps/api/lib/claude-feedback-summary.js` — tầng AI thuần (Decision 1).
- `apps/api/lib/feedback-ai-assist.js` — tầng điều phối: nhận `feedback` đã được handler cấp quyền, tự nạp comment chưa sửa (qua `query`/`tables` hoặc nhận từ handler), cache, gọi client AI; export `summarizeComments(...)`, `rewriteReply(...)`, `probe()`. KHÔNG chứa logic auth.
- `apps/api/feedback.js` — điểm tích hợp duy nhất, dạng tối thiểu: `import * as feedbackAi from './lib/feedback-ai-assist.js'`; trong dispatch POST thêm 2 nhánh, mỗi nhánh **tái dùng** `getFeedbackByIdentifier` + `assertFeedbackAccess` (đã có) rồi giao `feedback` cho `feedbackAi`; GET thêm 1 nhánh `resource: 'ai_probe'`; thêm 2 action vào `isPublicFeedbackRequest`. **Không** sửa `getFeedbackPermissions` (giữ nguyên), không đổi schema.

**Frontend**
- `apps/web/src/features/feedback/hooks/useFeedbackAi.js` — client API riêng: `summarizeFeedbackComments`, `rewriteFeedbackReply`, `probeFeedbackAi` (KHÔNG nhét vào `useFeedback.js` chung).
- `apps/web/src/features/feedback/components/FeedbackAiAssist.jsx` — tự chứa toàn bộ UI: probe khi mount, kiểm ngưỡng 6, panel tóm tắt (seek timecode), ô viết lại lời nhắn. Nhận props `{ open, onClose, feedback, comments, access, onSeek }`.
- `FeedbackDetailPage.jsx` — điểm tích hợp tối thiểu: 1 dòng import, 1 state `aiAssistOpen`, bọc "All rights reserved" bằng `onClick={() => setAiAssistOpen(true)}`, render `<FeedbackAiAssist ... />`.

### 8. Tắt nhanh & cờ bật/tắt
Thiếu `ANTHROPIC_API_KEY` → probe trả không khả dụng → trigger không làm gì (degrade an toàn, coi như ẩn). Đây cũng là công tắc tắt mềm toàn tính năng mà không phải sửa code.

## Risks / Trade-offs

- **Lối vào ẩn vẫn có thể bị khách tò mò tìm ra** → chấp nhận theo chủ trương người dùng (obscurity); tính năng chỉ đọc/soạn-nháp, không tự ghi dữ liệu khách.
- **Sai/ảo loại việc hoặc gộp nhầm timecode** → output luôn kèm `comment_ids`/timecode để Editor đối chiếu; coi là gợi ý.
- **Lời nhắn viết lại thêm cam kết ngoài ý** → prompt cấm bịa ngoài lý do; Editor review & copy thủ công; có "đổi cách nói".
- **Rò rỉ nội dung khách qua log** → telemetry chỉ-số-đo như parser hiện có.
- **Coupling ngầm với footerStatus** (trigger nằm trong chuỗi copyright bị footerStatus thay tạm) → giữ trigger là phần tử riêng bọc đúng cụm "All rights reserved"; khi footerStatus hiện thì hiển thị trạng thái, không bọc trigger.

## Migration Plan

- Thuần cộng thêm, không migration dữ liệu. Bật/tắt theo `ANTHROPIC_API_KEY`.
- Triển khai sau khi build FE; smoke test theo tasks.

## Removal / Teardown Plan (gỡ gọn về sau)

Để bỏ hẳn tính năng, chỉ cần:
1. Xóa `apps/api/lib/claude-feedback-summary.js` và `apps/api/lib/feedback-ai-assist.js`.
2. Trong `apps/api/feedback.js`: xóa dòng import `feedbackAi`, 2 nhánh action POST, nhánh GET `ai_probe`, và 2 entry trong `isPublicFeedbackRequest`. (Không có thay đổi nào khác trong file này cần hoàn tác.)
3. Xóa `apps/web/src/features/feedback/components/FeedbackAiAssist.jsx` và `hooks/useFeedbackAi.js`.
4. Trong `FeedbackDetailPage.jsx`: xóa 1 import, state `aiAssistOpen`, onClick bọc "All rights reserved", và thẻ `<FeedbackAiAssist />`.
5. (Tùy chọn) gỡ ENV `FEEDBACK_SUMMARY_AI_*` và `docs/ai-feedback-summary.md`.
Không đụng schema MySQL, không đụng `getFeedbackPermissions`, không ảnh hưởng các action feedback khác.

## Open Questions

- "Viết lại lời nhắn" gắn ngữ cảnh theo từng mục việc trong checklist hay là một ô độc lập (hoặc cả hai) — đề xuất: gắn theo mục việc để có context, đồng thời mở được từ panel tóm tắt. Chốt khi implement.
- Có thêm ENV riêng `FEEDBACK_SUMMARY_AI_MODEL`/`FEEDBACK_SUMMARY_AI_TIMEOUT_MS` hay dùng chung mặc định quote parser — đề xuất thêm ENV riêng, mặc định trùng.
- Giới hạn số comment tối đa mỗi lần gọi (nếu cần) — chốt khi implement.

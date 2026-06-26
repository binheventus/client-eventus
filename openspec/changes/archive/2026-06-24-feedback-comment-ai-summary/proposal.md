## Why

Trên công cụ duyệt video (`/feedbacks/:share_token`), khách hàng để lại nhiều comment rải theo mốc thời gian. Khi tới lượt sửa, Editor phải đọc hết, tự gom nhóm trong đầu (mấy chỗ nhạc, mấy chỗ màu, mấy chỗ chữ…), tự phát hiện comment trùng / mâu thuẫn / mơ hồ, rồi mới lên kế hoạch dựng. Việc này thủ công, lặp lại và tốn thời gian với mỗi bản feedback đông comment. Ngoài ra, khi có yêu cầu **không sửa được**, Editor phải tự nghĩ cách trả lời khách sao cho khéo. Hạ tầng Claude trong dự án đã chín (xem `ai-quote-parser`), nên có thể tái dùng để tự động hoá cả hai việc này gần như miễn phí về công sức nền tảng.

## What Changes

- Thêm tính năng **"Tóm tắt việc cần sửa"**: AI gom các comment **chưa sửa** (`is_done_1 = 0`) của một bản feedback thành **checklist phân nhóm theo loại việc dựng** (âm thanh, màu, cắt dựng, chữ, branding, nội dung, khác), mỗi nhóm gắn timecode + `comment_ids`, kèm cờ **trùng / mâu thuẫn / chưa rõ**.
- Thêm tính năng **"AI viết lại lời nhắn"**: dùng khi Editor **không sửa được** một yêu cầu — Editor gõ lý do thô, AI viết lại thành lời nhắn tiếng Việt lịch sự, thuyết phục để gửi khách (có thể đổi cách nói). Thay cho ý tưởng nháp reply tự động ban đầu.
- **Điểm truy cập ẩn, không thêm đăng nhập**: cả hai tính năng được kích hoạt qua một affordance ẩn ở footer (cùng cách dự án đang giấu nút "Cài đặt Feedback" sau logo footer và popup tin nhắn sau nhãn "Editor:"). Khách không thấy; không thêm cơ chế login.
- Nút "Tóm tắt" chỉ hiện khi AI khả dụng và số comment chưa sửa đạt ngưỡng (mặc định **6**).
- Tái dùng nguyên khuôn client Anthropic của quote parser (forced tool-call + JSON schema, prompt cache, timeout, retry schema-mismatch, telemetry KHÔNG log nội dung, fallback an toàn).
- Thuần cộng thêm: AI thiếu key / lỗi / timeout → affordance không làm gì hoặc báo không khả dụng; luồng feedback hiện có chạy bình thường. Không breaking change.

## Capabilities

### New Capabilities
- `feedback-comment-ai-summary`: Trợ lý AI cho Editor trong luồng feedback — (1) tóm tắt & phân loại comment chưa sửa thành checklist việc dựng kèm cờ trùng/mâu thuẫn/chưa rõ; (2) viết lại lý do thô của Editor thành lời nhắn khách thuyết phục. Truy cập qua affordance ẩn ở footer (không thêm đăng nhập), có probe khả dụng và fallback an toàn.

### Modified Capabilities
<!-- Không có capability spec sẵn nào thay đổi requirement. -->

## Impact

- **API mới**: thêm `apps/api/lib/claude-feedback-summary.js` (mirror `apps/api/lib/claude-quote-parser.js`) với 2 tool: tóm tắt comment và viết lại lời nhắn; thêm POST action `summarize_comments` và `rewrite_reply` + probe trong `apps/api/feedback.js`. Cả hai action xác thực qua `assertFeedbackAccess` hiện có (share token hoặc phiên) — **không thêm cờ quyền / không thêm login**.
- **Frontend**: thêm `summarizeFeedbackComments()`, `rewriteFeedbackReply()`, `probeFeedbackAi()` trong `apps/web/src/features/feedback/hooks/useFeedback.js`; thêm affordance ẩn + panel kết quả tóm tắt + ô "viết lại lời nhắn" trong `apps/web/src/features/feedback/pages/FeedbackDetailPage.jsx`.
- **Phụ thuộc / cấu hình**: dùng lại ENV `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` (proxy `api.coffeevibeai.com`); tùy chọn thêm `FEEDBACK_SUMMARY_AI_MODEL`, `FEEDBACK_SUMMARY_AI_TIMEOUT_MS`. Không thêm npm dependency, không đổi schema MySQL (tính lại khi bấm, không lưu DB ở v1).
- **Dữ liệu khách hàng**: input là comment/lý do của khách & Editor → giữ nguyên tắc telemetry không log nội dung; gọi qua proxy nội bộ như các luồng AI hiện có.
- **Ngoài phạm vi v1**: phân tích ảnh đính kèm (vision), lưu kết quả vào DB, sentiment survey, tìm kiếm ngữ nghĩa.

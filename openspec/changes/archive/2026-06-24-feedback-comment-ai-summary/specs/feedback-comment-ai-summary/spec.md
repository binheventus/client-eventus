## ADDED Requirements

### Requirement: Điểm truy cập ẩn, không thêm đăng nhập
Hệ thống SHALL đặt lối vào các tính năng AI cho Editor (tóm tắt comment, viết lại lời nhắn) ở một affordance ẩn/ngụy trang trên trang chi tiết feedback — cụ thể là cụm chữ **"All rights reserved"** trong dòng copyright ở footer — ngụy trang như văn bản giống cách các công cụ Editor hiện có đang được giấu. Hệ thống SHALL KHÔNG thêm cơ chế đăng nhập mới; backend SHALL cấp quyền cho các action AI qua cơ chế truy cập feedback hiện có (`assertFeedbackAccess`: share token hoặc phiên), giống các action feedback khác.

#### Scenario: Khách không thấy lối vào ở khu vực chính
- **WHEN** khách mở `/feedbacks/:share_token` và dùng giao diện comment bình thường
- **THEN** không có nút tính năng AI hiển thị ở khu vực chính; lối vào chỉ tồn tại ở cụm chữ "All rights reserved" tại footer

#### Scenario: Không phát sinh bước đăng nhập
- **WHEN** Editor bấm cụm chữ "All rights reserved" để mở tính năng AI
- **THEN** tính năng chạy bằng cơ chế truy cập feedback hiện có, KHÔNG yêu cầu thêm bước đăng nhập mới

### Requirement: Tách biệt và gỡ bỏ độc lập
Tính năng SHALL hoạt động tách biệt với phần còn lại của module feedback: khi tính năng bị tắt (thiếu API key) hoặc được gỡ bỏ, mọi chức năng feedback hiện có (xem video, comment, reply, đánh dấu đã sửa, đổi link, tin nhắn khách…) SHALL hoạt động không thay đổi. Điểm tích hợp vào file hiện có SHALL ở mức tối thiểu để có thể gỡ gọn.

#### Scenario: Tắt tính năng không ảnh hưởng luồng feedback
- **WHEN** AI không khả dụng (thiếu `ANTHROPIC_API_KEY`)
- **THEN** lối vào AI không hoạt động và tất cả thao tác feedback khác vẫn chạy bình thường

#### Scenario: Gỡ bỏ gọn
- **WHEN** muốn loại bỏ tính năng
- **THEN** chỉ cần xóa các module/component AI riêng và gỡ vài điểm tích hợp tối thiểu, KHÔNG cần đụng schema MySQL hay sửa logic feedback hiện có

### Requirement: Tóm tắt comment chưa sửa thành checklist phân nhóm
Khi được yêu cầu, hệ thống SHALL chỉ lấy các comment có `is_done_1 = 0` của bản feedback và dùng AI gom thành checklist theo bộ phân loại cố định: `audio`, `color`, `cut`, `text`, `branding`, `content`, `other`. Mỗi nhóm SHALL gồm danh sách việc, mỗi việc kèm các timecode tương ứng và `comment_ids` nguồn, cùng một câu tóm tắt và tổng số việc. Hệ thống SHALL bỏ qua các comment đã đánh dấu đã sửa.

#### Scenario: Gom nhóm nhiều comment chưa sửa
- **WHEN** Editor mở tính năng tóm tắt trên bản feedback có nhiều comment `is_done_1 = 0`
- **THEN** hệ thống trả về các nhóm theo loại việc dựng, mỗi việc có timecode và `comment_ids`, cùng câu tóm tắt và tổng số việc

#### Scenario: Loại trừ comment đã sửa
- **WHEN** một bản feedback có cả comment đã sửa (`is_done_1 = 1`) lẫn chưa sửa
- **THEN** kết quả tóm tắt SHALL chỉ phản ánh các comment chưa sửa

### Requirement: AI viết lại lời nhắn từ lý do thô của Editor
Hệ thống SHALL cho phép Editor nhập một lý do/ghi chú thô (ví dụ vì sao không sửa được một yêu cầu) và nhận lại một hoặc nhiều phiên bản lời nhắn tiếng Việt đã viết lại lịch sự, thuyết phục để gửi khách. Hệ thống SHALL bám theo lý do Editor cung cấp và ngữ cảnh việc liên quan (nếu có), KHÔNG bịa thông tin ngoài lý do; và SHALL cho phép tạo phiên bản khác (đổi cách nói/giọng).

#### Scenario: Viết lại lý do không sửa được
- **WHEN** Editor nhập lý do thô (ví dụ "không làm nét logo được vì file gốc phân giải thấp") và yêu cầu viết lại
- **THEN** hệ thống trả về lời nhắn tiếng Việt lịch sự giải thích đúng lý do đó (có thể kèm đề xuất phương án), không thêm thông tin sai

#### Scenario: Đổi cách nói
- **WHEN** Editor muốn một cách diễn đạt khác cho cùng lý do
- **THEN** hệ thống SHALL tạo được phiên bản lời nhắn khác

#### Scenario: Chưa nhập lý do
- **WHEN** Editor chưa nhập nội dung lý do
- **THEN** thao tác viết lại SHALL bị vô hiệu và KHÔNG gọi AI

### Requirement: Cờ comment trùng, mâu thuẫn và chưa rõ
Hệ thống SHALL phát hiện và trả về danh sách các comment mâu thuẫn/trùng (kèm mô tả và `comment_ids`) và danh sách các comment chưa rõ nghĩa (kèm timecode, nội dung gốc, lý do và `comment_ids`).

#### Scenario: Hai yêu cầu mâu thuẫn
- **WHEN** khách yêu cầu trái ngược nhau ở hai mốc (ví dụ tăng rồi giảm cùng một yếu tố)
- **THEN** kết quả SHALL liệt kê mục mâu thuẫn đó kèm `comment_ids` liên quan

#### Scenario: Comment mơ hồ
- **WHEN** một comment quá chung chung để hành động (ví dụ "thấy chưa ổn")
- **THEN** kết quả SHALL đưa comment đó vào danh sách chưa rõ kèm lý do

### Requirement: Khả dụng AI và điều kiện hiển thị nút tóm tắt
Hệ thống SHALL cung cấp cách kiểm tra AI có khả dụng hay không (probe) mà không gọi mô hình. Lối vào tính năng tóm tắt SHALL chỉ hiển thị khi đồng thời: AI khả dụng và số comment chưa sửa đạt ngưỡng tối thiểu cấu hình được (mặc định 6).

#### Scenario: Thiếu API key thì ẩn nút
- **WHEN** AI không khả dụng (thiếu `ANTHROPIC_API_KEY`)
- **THEN** probe trả về không khả dụng và lối vào tóm tắt SHALL không hiển thị

#### Scenario: Quá ít comment thì ẩn nút
- **WHEN** số comment chưa sửa thấp hơn ngưỡng tối thiểu (mặc định 6)
- **THEN** lối vào tóm tắt SHALL không hiển thị

### Requirement: Fallback an toàn khi AI lỗi
Khi AI lỗi, timeout, thiếu key, hoặc trả về sai schema, hệ thống SHALL không làm gián đoạn luồng feedback hiện có và SHALL báo trạng thái không khả dụng thay vì kết quả sai; Editor vẫn dùng được danh sách comment gốc.

#### Scenario: AI timeout
- **WHEN** lệnh gọi AI vượt quá timeout cấu hình
- **THEN** hệ thống SHALL trả về trạng thái không khả dụng/lỗi mềm và KHÔNG chặn các thao tác feedback khác

### Requirement: Bảo mật và không log nội dung khách
Hệ thống SHALL không ghi log nội dung comment của khách hay lý do Editor nhập. Telemetry cho lệnh gọi AI SHALL chỉ gồm số đo (model, token, cache, độ trễ, trạng thái), tương tự luồng AI hiện có.

#### Scenario: Telemetry không chứa nội dung
- **WHEN** một lệnh tóm tắt hoặc viết lại lời nhắn được thực thi
- **THEN** log telemetry SHALL chỉ chứa số đo và KHÔNG chứa nội dung comment/lý do

### Requirement: Tránh gọi AI trùng lặp khi tóm tắt
Hệ thống SHALL cache kết quả tóm tắt trong thời gian ngắn theo bản feedback và tập comment chưa sửa hiện tại, để các lần mở liên tiếp không tạo nhiều lệnh gọi AI khi dữ liệu không đổi.

#### Scenario: Mở lại khi comment không đổi
- **WHEN** Editor yêu cầu tóm tắt nhiều lần trong thời gian ngắn mà tập comment chưa sửa không đổi
- **THEN** hệ thống SHALL phục vụ từ cache thay vì gọi AI lại

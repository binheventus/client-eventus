## Why

Trang `/gallery/{token}` đang phục vụ đồng thời hai mục tiêu kéo nhau: khách muốn **xem & tải ảnh** (utilitarian, cần ngay), còn Eventus muốn khách **gửi phản hồi khảo sát** (emotional, cần thuyết phục). Hiện cả hai nút CTA ("Tải toàn bộ" và "Phản hồi về trải nghiệm tại Eventus") cùng nằm dưới đáy trang, **sau toàn bộ lưới ảnh + nút "Xem thêm"**, cùng màu cam và cùng kích thước. Hệ quả: khách tải xong thường đóng tab trước khi cuộn tới nút Phản hồi, và không có phân cấp thị giác giữa hai hành động. Nền gradient cam + sọc chéo (phù hợp khi card hẹp 672px) sẽ thành mảng màu lớn cạnh tranh chú ý với ảnh sau khi lưới được nới rộng.

Mục tiêu: tái cấu trúc layout/CTA/background để **cân bằng cả hai mục tiêu** — khách tải ảnh dễ dàng bất cứ lúc nào, đồng thời được mời phản hồi đúng "khoảnh khắc vàng" (sau khi đã xem bộ ảnh).

## What Changes

- **Background nhẹ đi:** vùng lưới ảnh dùng nền trung tính (xám rất nhạt/trắng) để ảnh là nhân vật chính; giữ branding cam ấm chỉ ở header và vùng closing card ("đóng khung" hai đầu trang).
- **Tách & phân cấp 2 CTA** (hết cảnh hai nút giống hệt nhau ở đáy):
  - "Tải toàn bộ ảnh" trở thành CTA chính ở **header** (khách thấy & tải ngay, không phải cuộn).
  - "Gửi phản hồi" trở thành CTA chính trong một **closing card** ấm áp ở **cuối trang** ("Cảm ơn bạn đã xem trọn bộ ảnh — trải nghiệm thế nào?").
- **Sticky bar mỏng khi cuộn:** hiện tên sự kiện + nút Tải + nút Phản hồi, luôn trong tầm tay.
- **Header gọn lại:** logo + tiêu đề sự kiện (to hơn) + meta số ảnh/ngày chụp.
- **Closing card luôn hiện ở cuối** danh sách đang render (không phụ thuộc trạng thái "Xem thêm").
- Không đổi API, dữ liệu ảnh, route hay auth. Lightbox, folder tabs, "Xem thêm", per-image download, fallback ảnh lỗi giữ nguyên hành vi.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `gallery-drive-viewer`: cập nhật/bổ sung yêu cầu về **bố cục trang viewer & phân cấp CTA** — tải ảnh là CTA chính ở header + sticky bar; phản hồi là CTA chính ở closing card cuối trang + sticky bar; background trung tính cho vùng ảnh, branding cam giới hạn ở header/closing.

## Impact

- `apps/web/src/features/feedback/pages/FeedbackGalleryPage.jsx`: tái cấu trúc bố cục (header với CTA Tải, sticky bar, closing card với CTA Phản hồi), đổi nền vùng ảnh.
- Có thể tách thành phần nhỏ mới trong `apps/web/src/features/feedback/components/` (ví dụ sticky bar, closing card) nếu hợp lý.
- Phối hợp với change `gallery-fullwidth-masonry` (lưới full-width + nhiều cột) — bổ sung, không xung đột.
- Không ảnh hưởng `apps/api`, dữ liệu Drive/GAS, route, hay auth.

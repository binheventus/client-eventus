## Why

Trên trang xem ảnh `/gallery/{token}`, toàn bộ lưới ảnh đang nằm trong thẻ nội dung canh giữa rộng tối đa `max-w-2xl` (~672px). Hậu quả là lưới masonry chỉ có 2–3 cột hẹp, mọi ảnh bị bóp nhỏ và trông đều đều như nhau, không tạo được cảm giác trưng bày. Khách hàng muốn ảnh "tràn" ra gần full trang và hiển thị to/nhỏ đa dạng cho đẹp, với phương án thay đổi ít nhất.

## What Changes

- Lưới ảnh (`GalleryGrid` + các thành phần liên quan) được tách khỏi thẻ nội dung hẹp và mở rộng tới gần chiều rộng trang (full-bleed có giới hạn tối đa rộng), trong khi phần branding (logo, tiêu đề, nút tải/khảo sát) vẫn giữ bố cục canh giữa hiện tại.
- Tăng số cột masonry theo breakpoint (2 → 3 → 4 → 5 cột) khi màn hình rộng hơn. Vì ảnh giữ tỉ lệ gốc, nhiều cột + nhiều chiều rộng tự động tạo hiệu ứng ảnh cao thấp xen kẽ (to/nhỏ đa dạng) mà không cần đổi dữ liệu.
- Không thay đổi API, không thay đổi dữ liệu ảnh, không thêm auth. Lightbox, folder tabs, "Xem thêm", per-image download và fallback giữ nguyên hành vi.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `gallery-drive-viewer`: cập nhật yêu cầu "Inline gallery viewer at /gallery/{token}" để mô tả lưới masonry mở rộng gần full trang với số cột tăng theo breakpoint; làm rõ rằng branding/CTA vẫn canh giữa còn lưới ảnh tràn rộng.

## Impact

- `apps/web/src/features/feedback/pages/FeedbackGalleryPage.jsx`: tách vùng lưới ảnh ra khỏi `max-w-2xl`, cho vùng lưới một container rộng hơn.
- `apps/web/src/features/feedback/components/GalleryGrid.jsx`: tăng số cột masonry theo breakpoint.
- Không ảnh hưởng backend (`apps/api`), không đổi dữ liệu Drive/GAS, không đổi route.

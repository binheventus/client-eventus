## 1. Mở rộng vùng lưới ảnh (FeedbackGalleryPage)

- [x] 1.1 Giữ `<section>` branding canh giữa `max-w-2xl` cho logo, tiêu đề và khối CTA (nút "Tải toàn bộ" / khảo sát) như hiện tại.
- [x] 1.2 Tách vùng lưới ảnh (folder tabs + `GalleryGrid` + nút "Xem thêm") ra một container riêng canh giữa trang với chiều rộng rộng hơn (đề xuất `max-w-[1600px]`, padding ngang nhỏ trên mobile).
- [x] 1.3 Đảm bảo trạng thái loading/empty/error và fallback nút Drive vẫn hiển thị đúng trong layout mới.

## 2. Tăng số cột masonry (GalleryGrid)

- [x] 2.1 Đổi class cột từ `columns-2 min-[480px]:columns-3` sang thang nhiều cột theo breakpoint (đề xuất `columns-2 sm:columns-3 lg:columns-4 xl:columns-5`), giữ `gap-3` và `break-inside-avoid`.
- [x] 2.2 (Tùy chọn) Nâng `GRID_SIZE` trong `GalleryPhotoCard` từ 600 lên ~800 nếu ảnh bị mờ ở cột rộng; cân nhắc băng thông.

## 3. Kiểm thử & xác minh

- [ ] 3.1 Chạy dev server, mở `/gallery/<token>` có ảnh; xác nhận lưới tràn rộng hơn card branding và ảnh xếp so le cao/thấp đa dạng. _(cần xem trực tiếp tại client-eventus.test — preview tool không gắn được vào server đang chạy của bạn)_
- [ ] 3.2 Kiểm tra responsive: 2 cột mobile → 3 → 4 → 5 cột khi màn hình rộng dần (preview_resize mobile/tablet/desktop). _(cần xem trực tiếp)_
- [ ] 3.3 Xác nhận các tính năng cũ không hồi quy: folder tabs lọc đúng, "Xem thêm" load thêm, lightbox mở/chuyển/đóng/tải, per-image download, placeholder ảnh lỗi. _(cần xem trực tiếp — chỉ sửa class layout, không đụng logic nên không kỳ vọng hồi quy)_
- [ ] 3.4 Kiểm tra branding (logo, tiêu đề) và 2 nút CTA vẫn canh giữa, không bị kéo dãn. _(cần xem trực tiếp)_

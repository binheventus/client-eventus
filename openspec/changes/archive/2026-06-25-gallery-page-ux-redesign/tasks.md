## 1. Header & CTA Tải ảnh

- [x] 1.1 Đưa "Tải toàn bộ ảnh" lên header (dưới tiêu đề) dạng nút primary cam đậm, mở `drive_link` ở tab mới.
- [x] 1.2 Giữ fallback "Chưa có link tải ảnh" khi thiếu `drive_link`, hiển thị ở vị trí header mới.
- [x] 1.3 (Tùy chọn) Bổ sung meta header: số ảnh + số ngày chụp (suy ra từ groups/photos).

## 2. Closing card mời phản hồi

- [x] 2.1 Thêm closing card sau lưới ảnh + nút "Xem thêm": tiêu đề ấm, dòng phụ, nút primary "Gửi phản hồi" dẫn `survey_link`.
- [x] 2.2 Style closing card với branding cam ấm để nổi khỏi vùng lưới trung tính; luôn render khi có ảnh.
- [x] 2.3 Bỏ cụm 2 nút `grid sm:grid-cols-2` cũ ở đáy (Tải đã lên header, Phản hồi đã vào closing card).

## 3. Sticky bar khi cuộn

- [x] 3.1 Thêm sticky bar mỏng (`position: sticky; top:0`): tên sự kiện rút gọn + nút Tải + nút Phản hồi, dùng lại `drive_link`/`survey_link`.
- [x] 3.2 Xử lý sticky không che hàng ảnh trên cùng (scroll offset) và ẩn/đè đúng khi lightbox mở (z-index).
- [x] 3.3 Responsive sticky bar trên mobile (icon + nhãn ngắn hoặc ưu tiên nút) cho vừa bề ngang.

## 4. Background & phân cấp thị giác

- [x] 4.1 Đổi nền vùng lưới sang trung tính (xám rất nhạt/trắng); bỏ `repeating-linear-gradient` sọc chéo sau ảnh.
- [x] 4.2 Giữ tông cam ấm ở header và closing card để vẫn nhận diện Eventus.
- [x] 4.3 Đảm bảo Tải = primary trong header/sticky, Phản hồi = primary trong closing/sticky; không còn 2 nút giống hệt song song.

## 5. (Tùy chọn) Tách component

- [x] 5.1 Nếu `FeedbackGalleryPage` phình to, tách `GalleryStickyBar` và `GalleryClosingCard` ra `components/`.

## 6. Kiểm thử & xác minh

- [ ] 6.1 Mở `/gallery/<token>` có ảnh: nút Tải hiện ở header không cần cuộn; closing card + nút Phản hồi hiện ở cuối. _(cần xem trực tiếp — preview tool không gắn được vào server đang chạy của bạn)_
- [ ] 6.2 Cuộn xuống: sticky bar hiện với tên sự kiện + Tải + Phản hồi; không che ảnh; click dẫn đúng đích. _(cần xem trực tiếp)_
- [ ] 6.3 Kiểm responsive (mobile/tablet/desktop): header, sticky bar, closing card đều gọn và đúng. _(cần xem trực tiếp)_
- [ ] 6.4 Không hồi quy: folder tabs, "Xem thêm", lightbox (mở/chuyển/đóng/tải, không bị sticky đè), per-image download, placeholder ảnh lỗi. _(cần xem trực tiếp — sticky ẩn khi lightbox mở qua prop `hidden`)_
- [ ] 6.5 Trường hợp thiếu `drive_link`: header hiện fallback đúng; closing card vẫn mời phản hồi. _(cần xem trực tiếp)_

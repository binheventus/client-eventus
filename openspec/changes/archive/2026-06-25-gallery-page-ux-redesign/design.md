## Context

`/gallery/{token}` (`FeedbackGalleryPage.jsx`) hiện gói tất cả trong một thẻ branding canh giữa: logo → tiêu đề → folder tabs → lưới ảnh → "Xem thêm" → **hai nút CTA giống hệt nhau ("Tải toàn bộ" + "Phản hồi") ở đáy**. Nền là gradient cam + sọc chéo phủ toàn card. Nút Phản hồi dẫn tới `survey_link` (`/survey?job=...`, khảo sát ~2 phút cùng app); nút Tải mở `drive_link` (folder Google Drive) ở tab mới.

Hai vấn đề UX:
1. Cả hai CTA nằm dưới đáy, sau toàn bộ ảnh → khách tải xong đóng tab, không thấy nút Phản hồi.
2. Hai nút cùng màu/kích thước → không có phân cấp, không "khoảnh khắc" cho từng hành động.

Change này đi cùng `gallery-fullwidth-masonry` (lo lưới full-width + nhiều cột); ở đây lo layout/CTA/background.

Đã chốt với khách: **cân bằng cả hai mục tiêu**, **có sticky bar**, **closing card luôn hiện cuối trang**.

## Goals / Non-Goals

**Goals:**
- Khách tải ảnh dễ, không phải cuộn (CTA Tải ở header + sticky bar).
- Mời phản hồi đúng "khoảnh khắc vàng" (closing card sau khi xem ảnh) + nhắc ở sticky bar.
- Ảnh là nhân vật chính: nền vùng lưới trung tính, branding cam chỉ đóng khung header + closing.
- Phân cấp rõ: mỗi CTA là primary trong vùng của nó, không còn hai nút song song giống hệt.

**Non-Goals:**
- Không đổi API, shape dữ liệu ảnh, route, auth.
- Không đổi hành vi lightbox, folder tabs, "Xem thêm", per-image download, fallback ảnh lỗi.
- Không thêm thư viện UI/scroll mới; dùng CSS `sticky` thuần.
- Không làm closing card phụ thuộc trạng thái "đã xem hết" (đã chốt: luôn hiện cuối).

## Decisions

### Quyết định 1: Tải = CTA chính ở header; bỏ cụm 2 nút ở đáy
Đưa "Tải toàn bộ ảnh" lên header dưới tiêu đề, style primary (cam đậm). Bỏ block `grid sm:grid-cols-2` chứa 2 nút ở đáy. Giữ nguyên fallback "Chưa có link tải ảnh" khi thiếu `drive_link` (chỉ đổi vị trí).
- **Vì sao:** khách đến để tải — đặt ngay tầm mắt, không bắt cuộn qua 671 ảnh.
- **Phương án khác:** giữ Tải ở đáy → loại, vì đó chính là vấn đề.

### Quyết định 2: Phản hồi = CTA chính trong closing card cuối trang
Thêm một closing card sau "Xem thêm": tiêu đề ấm ("Cảm ơn bạn đã xem trọn bộ ảnh"), một dòng phụ, và nút primary "Gửi phản hồi · chỉ 2 phút →" dẫn `survey_link`. Card có nền branding cam ấm để nổi khỏi vùng lưới trung tính. Luôn render khi có ảnh.
- **Vì sao:** xin phản hồi tốt nhất ngay sau khi khách hưởng giá trị; closing card không phiền như popup/pill.
- **Phương án khác:** floating pill che ảnh → loại (kiểu growth-hack, kém "chuyên nghiệp"); chỉ-hiện-khi-xem-hết → loại (đã chốt luôn hiện cho đơn giản).

### Quyết định 3: Sticky bar mỏng khi cuộn
Thanh `position: sticky; top: 0` mỏng: tên sự kiện (rút gọn) + nút Tải + nút Phản hồi, dùng lại `drive_link`/`survey_link`. Trên mobile có thể chỉ hiện icon + nhãn ngắn để vừa bề ngang.
- **Vì sao:** "cân bằng" = cả hai hành động luôn trong tầm tay ở mọi vị trí cuộn.
- **Phương án khác:** không sticky → loại (đã chốt có). Lưu ý: cần xử lý để sticky bar không che hàng ảnh trên cùng (offset/scroll-margin).

### Quyết định 4: Background trung tính cho vùng ảnh, branding đóng khung
Vùng lưới đặt trên nền trung tính (xám rất nhạt/trắng); bỏ `repeating-linear-gradient` sọc chéo phía sau ảnh. Giữ tông cam ấm ở header và closing card.
- **Vì sao:** trong gallery, ảnh phải nổi; mảng cam lớn sau khi nới rộng sẽ cạnh tranh chú ý.
- **Phương án khác:** bỏ sạch branding → loại (mất nhận diện Eventus); giữ nguyên nền cũ → loại (lý do trên).

### Quyết định 5 (mở): có tách component không
Cân nhắc tách `GalleryStickyBar` và `GalleryClosingCard` thành component riêng trong `components/` cho gọn `FeedbackGalleryPage`. Quyết định lúc implement tùy độ phình của file; không bắt buộc.

## Risks / Trade-offs

- **Sticky bar che hàng ảnh trên cùng / chồng lightbox** → đặt z-index hợp lý, ẩn sticky khi lightbox mở, thêm scroll offset.
- **Header + sticky + closing làm trang dài hơn, nhiều "chrome"** → giữ header/sticky gọn, chỉ một CTA primary mỗi vùng.
- **Mobile chật cho 2 nút trên sticky bar** → rút còn icon + nhãn ngắn, hoặc ưu tiên 1 nút + menu; quyết định khi dựng.
- **"Luôn hiện closing card" có thể xuất hiện khi mới tải vài ảnh** (chưa thực sự "xem xong") → chấp nhận theo lựa chọn đã chốt; đổi sau nếu muốn.
- **Đổi màu nền có thể lệch nhận diện thương hiệu** → giữ cam ở header/closing để vẫn "rất Eventus".

## Migration Plan

Thuần front-end, không migration dữ liệu. Triển khai = build & deploy web. Rollback = revert thay đổi của `FeedbackGalleryPage.jsx` (và component mới nếu có). Không ảnh hưởng API/dữ liệu. Nên làm sau khi `gallery-fullwidth-masonry` đã vào để dựng trên lưới full-width mới.

## Open Questions

- Nội dung chữ closing card cuối cùng là gì (tiêu đề + dòng phụ + nhãn nút)? Đề xuất: "Cảm ơn bạn đã xem trọn bộ ảnh 💛 / Trải nghiệm của bạn cùng Eventus thế nào? / [⭐ Gửi phản hồi · chỉ 2 phút →]".
- Header có thêm meta "671 ảnh · 2 ngày chụp" không, hay chỉ tiêu đề sự kiện?
- Trên mobile, sticky bar hiển thị cả 2 nút hay ưu tiên 1?

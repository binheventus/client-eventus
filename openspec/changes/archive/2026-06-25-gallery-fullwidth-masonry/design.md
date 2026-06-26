## Context

`/gallery/{token}` (`FeedbackGalleryPage.jsx`) bọc tất cả nội dung trong một `<section>` canh giữa với `max-w-2xl` (~672px). Lưới ảnh (`GalleryGrid.jsx`) dùng CSS multi-column masonry (`columns-2 min-[480px]:columns-3`) với card `break-inside-avoid` và ảnh `w-full object-cover` giữ tỉ lệ gốc. Vì container quá hẹp, lưới chỉ có 2–3 cột nhỏ nên ảnh trông bị bóp và đều đều.

Ràng buộc:
- Phương án "ít thay đổi nhất": ưu tiên chỉ chỉnh class Tailwind, không đổi API/dữ liệu/route, không đụng backend.
- Branding (logo, tiêu đề, nút "Tải toàn bộ" / khảo sát) nên giữ bố cục canh giữa hiện tại — chỉ vùng lưới ảnh cần tràn rộng.
- Các tính năng hiện có (folder tabs, "Xem thêm", lightbox, per-image download, fallback ảnh lỗi) phải giữ nguyên.

## Goals / Non-Goals

**Goals:**
- Lưới ảnh tràn rộng gần full trang thay vì bị giới hạn trong thẻ `max-w-2xl`.
- Ảnh hiển thị to/nhỏ đa dạng (cao thấp xen kẽ) tự nhiên hơn nhờ nhiều cột + container rộng.
- Thay đổi tối thiểu, chỉ ở tầng layout/CSS của 2 file front-end.

**Non-Goals:**
- Không đổi cách lấy ảnh từ Drive/GAS, không đổi shape dữ liệu `{ fileId, name, parentName }`.
- Không thêm thông tin kích thước ảnh từ server (vẫn để trình duyệt tự cân cột).
- Không xây layout "featured/spotlight" theo grid-template phức tạp (yêu cầu crop ảnh về tỉ lệ cố định) — ngoài phạm vi "ít thay đổi".
- Không đổi auth, route, hay hành vi lightbox/tabs/"Xem thêm".

## Decisions

### Quyết định 1: Tách vùng lưới ảnh ra khỏi card `max-w-2xl`

Giữ `<section>` branding canh giữa `max-w-2xl` cho header và khối CTA, nhưng đưa vùng lưới ảnh (tabs + grid + "Xem thêm") vào một container riêng rộng hơn, ví dụ `max-w-[1600px]` (hoặc tương đương) canh giữa trang. Branding và CTA vẫn nằm trong layout hẹp như cũ.

- **Vì sao:** Đây là nguyên nhân gốc khiến ảnh bị bóp. Mở rộng đúng vùng lưới cho hiệu quả thị giác lớn nhất với thay đổi nhỏ nhất, đồng thời giữ phần chữ/nút không bị kéo dãn xấu.
- **Phương án khác đã cân nhắc:** Nới luôn cả `max-w-2xl` của toàn `<section>` → đơn giản hơn nhưng làm header và 2 nút CTA bị kéo quá rộng, xấu trên desktop. Bỏ qua.

### Quyết định 2: Tăng số cột masonry theo breakpoint

Đổi class `GalleryGrid` từ `columns-2 min-[480px]:columns-3` sang thang nhiều cột, ví dụ `columns-2 sm:columns-3 lg:columns-4 xl:columns-5`. Giữ nguyên cơ chế CSS multi-column + `break-inside-avoid`.

- **Vì sao:** Ảnh giữ tỉ lệ gốc, nên khi có nhiều cột trên container rộng, các ảnh cao/thấp khác nhau sẽ tự xếp so le tạo cảm giác to/nhỏ đa dạng — đúng mong muốn, không cần dữ liệu kích thước.
- **Phương án khác đã cân nhắc:** CSS Grid `grid-auto-flow: dense` với một số ô `col-span/row-span` để có ảnh "to" thật sự → đẹp kiểu Google Photos nhưng buộc crop ảnh về tỉ lệ cố định và viết thêm logic chọn ô nổi bật. Nhiều thay đổi hơn, để dành nếu sau này cần.

### Quyết định 3: Cân nhắc kích thước ảnh tải về (`GRID_SIZE`)

`GalleryPhotoCard` đang yêu cầu ảnh `lh3` ở `w600`. Khi cột rộng hơn trên desktop, có thể nâng nhẹ (ví dụ `w800`) để ảnh không bị mờ. Đây là tinh chỉnh tùy chọn, không bắt buộc cho phạm vi layout.

- **Vì sao:** Cột rộng hơn → ảnh hiển thị lớn hơn → `w600` có thể hơi mờ. Nhưng tăng size làm tải nặng hơn; giữ ở mức vừa phải.

## Risks / Trade-offs

- **Container quá rộng trên màn hình lớn khiến ảnh quá to / thưa** → Đặt trần `max-w` hợp lý (~1600px) và canh giữa; số cột tối đa 5.
- **Nhiều cột + ảnh w600 có thể hơi mờ trên desktop** → Tùy chọn nâng `GRID_SIZE` lên ~800; đánh đổi với băng thông, giữ lazy-load.
- **Multi-column masonry xếp theo thứ tự cột (trên→xuống từng cột) chứ không trái→phải** → Hành vi này đã tồn tại từ trước, không phải hồi quy do thay đổi này; chấp nhận.
- **CSS multi-column không cho ảnh "to" thật sự (span nhiều cột)** → Chấp nhận trong phạm vi "ít thay đổi"; sự đa dạng đến từ tỉ lệ ảnh + số cột. Nếu khách muốn ảnh nổi bật hẳn, mở change riêng theo phương án CSS Grid.

## Migration Plan

Thuần front-end, không migration dữ liệu. Triển khai = build & deploy web như bình thường. Rollback = revert thay đổi class của 2 file. Không ảnh hưởng API hay dữ liệu đã lưu.

## Open Questions

- Trần chiều rộng vùng lưới mong muốn là bao nhiêu (1400px / 1600px / gần full viewport)? Mặc định đề xuất ~1600px.
- Có cần nâng `GRID_SIZE` từ 600 → 800 để ảnh nét hơn trên desktop không, hay giữ nguyên để nhẹ tải?

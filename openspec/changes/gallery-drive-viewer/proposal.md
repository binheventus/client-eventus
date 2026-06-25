# Proposal: Gallery Drive Viewer

## Why

Hiện tại khi khách mở link `/gallery/{token}`, trang [FeedbackGalleryPage.jsx](apps/web/src/features/feedback/pages/FeedbackGalleryPage.jsx) chỉ hiển thị **một nút "Tải ảnh từ Google Drive"** mở Drive ở tab mới (dùng `drive_link` mà `getGallery` đã giải ra từ `drive_url`/`gallery_drive`). Khách phải rời khỏi trang Eventus, vào giao diện Drive thô để xem ảnh — trải nghiệm rời rạc, không có thương hiệu, không xem nhanh được.

Đội ngũ đã có sẵn một module giao ảnh hoàn chỉnh ở dự án khác (`module-album-anh`) với UI grid masonry + lightbox đẹp. Tuy nhiên module đó viết bằng **React Native + Expo + Supabase + Deno Edge Functions** — không port trực tiếp được sang stack web hiện tại (**React + Vite + Express/MySQL**). Cái tái dùng được là **ý tưởng UX và logic thuần** (công thức URL ảnh Drive, cách liệt kê folder qua Google Apps Script), không phải file `.tsx`.

Mục tiêu: khách xem album ảnh **ngay tại `/gallery/{token}`** với UI như module kia, mà **không thêm bảng DB, không Supabase, không các chức năng thừa** (bình luận, yêu thích, chọn nhiều, mật khẩu folder, NAS, my-albums).

## What Changes

- **Nâng cấp `/gallery/{token}` thành viewer nhúng**: thay vì chỉ 1 nút Drive, trang render trực tiếp grid ảnh masonry (UI lấy từ module-album-anh, viết lại RN→DOM). Nút "Tải ảnh từ Google Drive" cũ **giữ lại** làm lưới an toàn (fallback khi không liệt kê được ảnh) và làm chức năng "Tải toàn bộ".
- **Mở rộng endpoint `getGallery`** (`apps/api/feedback.js`): trả thêm mảng `photos: [{ fileId, name, parentName }]`. Server tự trích `folderId` từ `drive_link` đã giải sẵn (client **không** gửi `folderId`), gọi Google Apps Script (GAS) server→server để liệt kê ảnh trong folder, né CORS và giấu URL GAS.
- **GAS đệ quy subfolder + lọc ảnh**: GAS duyệt folder gốc **và các subfolder con** (Drive cho phép lồng nhau, ví dụ folder A chứa "Ảnh ngày 1", "Ảnh ngày 2"), trả mỗi ảnh kèm `parentName` (tên subfolder chứa nó; ảnh ở gốc → `null`/`""`). GAS **chỉ trả file ảnh** (`mimeType` bắt đầu `image/`) — **video bị loại** khỏi viewer (khách vẫn tải video qua nút "Tải toàn bộ" → Drive).
- **Tab thư mục thích ứng (adaptive)**: khi album có **≥2 nhóm subfolder**, client hiện thanh tab `[Tất cả][Ảnh ngày 1][Ảnh ngày 2]...` để lọc grid (UX port từ `AlbumFolderBar`). Khi folder **phẳng / chỉ 1 nhóm**, ẩn tab và render grid thẳng. Gom **2 cấp** (gốc + 1 lớp con); ảnh sâu hơn gộp vào nhóm cha gần nhất — y như module gốc.
- **Helper trích folderId** chịu được nhiều định dạng link Drive: `/folders/<id>`, `?id=<id>`, link có `?usp=sharing`/`?usp=drive_link`, link rút gọn. Nếu không phải link folder hợp lệ → trả `photos: []`, trang tự rơi về nút Drive cũ.
- **Helper build URL ảnh Drive** (logic thuần, port từ `albumService.driveImageUrl`): `fileId → https://lh3.googleusercontent.com/d/<id>=w<size>` để xem, `https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t` để tải từng ảnh.
- **Lazy-load + "Xem thêm" (theo tab)**: GAS trả toàn bộ danh sách metadata 1 lần (nhẹ); client chỉ render 30-40 ảnh đầu **của nhóm đang xem**, bấm "Xem thêm" render thêm 30-40 (ảnh mới tải, không gọi lại GAS). Đổi tab → reset cửa sổ về đầu. Né rate-limit của `lh3.googleusercontent.com`.
- **Lightbox xem từng ảnh**: port UX cốt lõi từ `AlbumLightbox` (xem ảnh lớn, prev/next, zoom/pan, vuốt trên mobile, blur-up placeholder). **Bỏ** panel bình luận, yêu thích.
- **Tải ảnh**: nút tải từng ảnh (URL download Drive trực tiếp) trên card và trong lightbox; nút "Tải toàn bộ" mở Drive folder để Google tự nén/tải — né CORS, không cần ZIP client-side.
- **Cấu hình GAS qua env**: thêm `GALLERY_GAS_URL` (URL `/exec` của Google Apps Script Web App). Khi trống → `photos: []`, trang về hành vi cũ (chỉ nút Drive).

## Capabilities

### New Capabilities

- `gallery-drive-viewer`: endpoint trả danh sách ảnh từ Drive folder (qua GAS đệ quy subfolder, lọc chỉ ảnh, scope theo share_token), helper trích folderId + build URL ảnh + gom nhóm 2 cấp, viewer web (grid masonry + tab thư mục thích ứng + lazy-load "Xem thêm" + lightbox), tải từng ảnh + tải toàn bộ qua Drive, fallback khi GAS chưa cấu hình / không liệt kê được.

### Modified Capabilities

Không có spec cũ trong `openspec/specs/` cần sửa ở dạng delta. Thay đổi với `getGallery` (thêm field `photos`) được mô tả như impact đến code backend, giữ tương thích ngược (các field cũ `drive_link`, `survey_link`, `job`, `feedback` không đổi).

## Impact

**Backend (apps/api/):**
- `feedback.js`: mở rộng `getGallery()` trả thêm `photos[]`; gọi helper liệt kê Drive. Giữ nguyên `drive_link`/`survey_link`.
- `lib/gallery-drive.js` (mới): `extractDriveFolderId(url)`, `driveImageUrl(fileId, kind, size)`, `listDriveFolderPhotos(folderId)` (fetch GAS server→server, redirect:follow; GAS đã đệ quy subfolder + lọc ảnh, trả `photos[{fileId,name,parentName}]`), `groupPhotosByFolder(photos)` (gom 2 cấp theo `parentName`).
- `lib/server-env.js`: đọc `GALLERY_GAS_URL` (+ tùy chọn `GALLERY_GAS_TIMEOUT_MS`).

**Frontend (apps/web/src/):**
- `features/feedback/pages/FeedbackGalleryPage.jsx`: render viewer khi có `photos[]`; giữ nút Drive + survey; thêm state lazy-load/lightbox/tab thư mục.
- `features/feedback/components/` (mới): `GalleryGrid.jsx` (masonry), `GalleryLightbox.jsx` (xem/zoom/prev-next), `GalleryPhotoCard.jsx`, `GalleryFolderTabs.jsx` (tab thư mục thích ứng).
- `features/feedback/lib/galleryDrive.js` (mới): `buildDriveImageUrl(fileId, size)`, `buildDriveDownloadUrl(fileId)`, `groupPhotosByFolder(photos)` (gom nhóm 2 cấp để dựng tab).

**Database:**
- Không thay đổi schema. Không bảng mới. Đọc `drive_url`/`gallery_drive` sẵn có.

**KHÔNG đụng tới (giữ nguyên hoàn toàn):**
- **Mọi chỗ NHẬP link Google Drive giữ y nguyên** — cả ở nhansu-eventus và UI trong client-eventus ([FeedbackDetailPage.jsx:614](apps/web/src/features/feedback/pages/FeedbackDetailPage.jsx:614), `saveFooterLinks` tại [dòng 2124](apps/web/src/features/feedback/pages/FeedbackDetailPage.jsx:2124)). Change này **không thêm ô nhập link mới**, không sửa luồng nhập, không đổi cách ghi vào DB.
- Trang khách `/gallery/{token}` **không có ô nhập link** — chỉ đọc `drive_url` đã được nhân sự nhập sẵn từ trước.

**External dependencies:**
- Không thêm npm package (dùng `fetch` sẵn có; ảnh render bằng `<img>`).
- Phụ thuộc ngoài: **1 Google Apps Script Web App** (user tự deploy) liệt kê folder. Folder Drive để chế độ "anyone with link".
- `.env.example`: thêm `GALLERY_GAS_URL`, `GALLERY_GAS_TIMEOUT_MS`.

**Test:**
- `apps/api/gallery-drive.test.js` (mới): test `extractDriveFolderId` với nhiều định dạng link; `driveImageUrl`/`buildDriveDownloadUrl`; `groupPhotosByFolder` (gom 2 cấp, ảnh gốc, ≥2 nhóm vs phẳng); mock fetch GAS cho `listDriveFolderPhotos` (thành công, GAS lỗi, timeout, GAS_URL trống).
- `apps/api/feedback.test.js`: bổ sung case `getGallery` trả `photos[]` khi GAS có cấu hình + folder hợp lệ; trả `[]` khi `drive_link` không phải folder hoặc GAS trống.

**Security:**
- Client **không** gửi `folderId`; server tự trích từ `drive_link` đã scope theo `share_token` (giữ bài học "không trust client path" của module gốc).
- URL GAS giấu phía server, không lộ ra trình duyệt.
- Giữ nguyên mô hình `/gallery/{token}` không cần đăng nhập (đúng pattern public token hiện có).

**Cost:**
- $0 — GAS chạy free tier, ảnh phục vụ trực tiếp từ CDN Google. Không API key trả phí.

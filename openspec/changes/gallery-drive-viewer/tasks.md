# Tasks: Gallery Drive Viewer

## 0. Chuẩn bị / khảo sát

- [x] Kiểm tra mẫu thật của `drive_url` / `gallery_drive` trong MySQL (`client_feedbacks`, job) để biết các định dạng link cần xử lý. → xác nhận gián tiếp qua test thủ công với link thật (sandbox không đọc được DB credentials)
- [x] Stakeholder deploy Google Apps Script Web App liệt kê folder (dùng code script được cung cấp ở task 1.0); lấy URL `/exec`.

## 1. Backend — lớp đọc Drive

- [x] 1.0 Viết & bàn giao GAS script mẫu: `doGet` nhận `folderId`, **đệ quy folder gốc + subfolder con**, **chỉ lấy file ảnh** (`mimeType` bắt đầu `image/`), trả `{ ok, photos:[{fileId,name,parentName,mimeType}] }` (`parentName` = tên subfolder chứa ảnh, gốc → `null`); deploy "anyone". → `docs/gallery-gas-script.gs`
- [x] 1.1 Tạo `apps/api/lib/gallery-drive.js`:
  - [x] `extractDriveFolderId(url)` — regex `/folders/<id>`, fallback `?id=<id>`; trả `null` nếu không nhận ra.
  - [x] `driveImageUrl(fileId, kind, size)` — `view`→`lh3.../d/<id>=w<size>`, `download`→`drive.usercontent.../download`.
  - [x] `listDriveFolderPhotos(folderId)` — fetch `GALLERY_GAS_URL?folderId=`, `redirect:'follow'`, timeout, parse `{ok,photos}`; lỗi → trả `[]` + log.
  - [x] `groupPhotosByFolder(photos)` — gom 2 cấp theo `parentName`; trả `[{ name, photos[] }]` + xác định có ≥2 nhóm hay không (cho client quyết định hiện tab).
- [x] 1.2 `apps/api/lib/server-env.js` — đọc `GALLERY_GAS_URL`, `GALLERY_GAS_TIMEOUT_MS` (default ~8000).
- [x] 1.3 Mở rộng `getGallery()` trong `apps/api/feedback.js`: sau khi có `drive_link`, `extractDriveFolderId` → `listDriveFolderPhotos` → thêm `photos[{fileId,name,parentName}]` vào response. Giữ nguyên `drive_link`/`survey_link`/`job`/`feedback`.

## 2. Backend — test

- [x] 2.1 `apps/api/gallery-drive.test.js`: `extractDriveFolderId` (folders, ?usp=sharing, open?id, /u/0/, link lạ→null); `driveImageUrl`/download; `groupPhotosByFolder` (gom 2 cấp, ảnh gốc parentName null, ≥2 nhóm vs phẳng); `listDriveFolderPhotos` mock fetch (ok / GAS lỗi / timeout / GAS_URL trống → `[]`).
- [x] 2.2 `apps/api/feedback.test.js`: `getGallery` trả `photos[]` khi GAS cấu hình + folder hợp lệ; trả `[]` khi `drive_link` không phải folder / GAS trống. Đảm bảo field cũ không đổi (tương thích ngược).

## 3. Frontend — lib & data

- [x] 3.1 `apps/web/src/features/feedback/lib/galleryDrive.js`: `buildDriveImageUrl(fileId, size)`, `buildDriveDownloadUrl(fileId)` (mirror server), `groupPhotosByFolder(photos)` (gom 2 cấp → tab).
- [x] 3.2 Xác nhận `getFeedbackGallery` (hooks/useFeedback.js) trả về `photos` (không cần sửa nếu chỉ pass-through JSON).

## 4. Frontend — components viewer (port UX RN→DOM)

- [x] 4.1 `GalleryPhotoCard.jsx` — ảnh `<img loading="lazy">` bo góc, hover, nút tải; `onerror` placeholder.
- [x] 4.2 `GalleryGrid.jsx` — masonry chia cột theo `h/w` ratio (2 cột <480px, 3 cột ≥480px); nhận `photos` đã slice; `onOpen(index)`.
- [x] 4.3 `GalleryFolderTabs.jsx` — tab `[Tất cả][nhóm...]` + đếm số ảnh/nhóm; chỉ render khi ≥2 nhóm; `onSelect(tabId)`.
- [x] 4.4 `GalleryLightbox.jsx` — xem lớn, prev/next (phím ←→ + nút) trong nhóm đang xem, zoom/pan (wheel + pinch), vuốt mobile, blur-up placeholder, nút tải ảnh này, đóng (Esc/nút/click nền). Bỏ comment/fav.

## 5. Frontend — tích hợp trang

- [x] 5.1 `FeedbackGalleryPage.jsx`:
  - [x] `groupPhotosByFolder(photos)` → state `tab` (mặc định 'all'); render `<GalleryFolderTabs>` khi ≥2 nhóm.
  - [x] state `visible` (mặc định 36) + nút "Xem thêm" (+36) khi `visible < photosOfTab.length`; đổi tab → reset `visible=36`.
  - [x] `photos.length > 0` → render `<GalleryGrid>` (ảnh của tab) + lightbox; `=== 0` → giữ nút "Tải ảnh từ Google Drive" (như cũ).
  - [x] luôn render: nút "Tải toàn bộ" (mở `drive_link` folder) + nút survey.
  - [x] giữ logo + layout thương hiệu hiện có.

## 6. Cấu hình & tài liệu

- [x] 6.1 `.env.example`: thêm `GALLERY_GAS_URL=`, `GALLERY_GAS_TIMEOUT_MS=8000`.
- [x] 6.2 `docs/` (tùy chọn): ghi chú deploy GAS + yêu cầu folder "anyone with link". → hướng dẫn deploy nằm inline trong `docs/gallery-gas-script.gs`

## 7. Kiểm thử thủ công

- [x] 7.1 Link folder thật nhiều ảnh → grid hiện, "Xem thêm" chạy, lightbox prev/next/zoom OK.
- [x] 7.2 Link folder có **subfolder** (vd "Ảnh ngày 1"/"Ảnh ngày 2"/"Video") → hiện tab `[Tất cả][Ngày 1][Ngày 2]`, **không** có tab Video; đổi tab lọc đúng + reset "Xem thêm".
- [x] 7.3 Link folder **phẳng** (không subfolder) → ẩn tab, grid thẳng.
- [x] 7.4 Tải 1 ảnh OK; "Tải toàn bộ" mở Drive folder OK.
- [x] 7.5 GAS trống / link không phải folder / folder chỉ có video → trang về nút Drive cũ, không vỡ.
- [x] 7.6 Mobile: vuốt chuyển ảnh, pinch-zoom; ảnh lỗi lẻ → placeholder, ảnh khác vẫn chạy.

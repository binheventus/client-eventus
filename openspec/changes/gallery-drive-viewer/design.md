# Design: Gallery Drive Viewer

## Bối cảnh & ràng buộc

Bài toán: `/gallery/{token}` hiện chỉ có nút mở Drive → muốn render album ảnh inline với UI như `module-album-anh`. Module gốc là **React Native + Expo + Supabase + Deno**; stack đích là **React 18 + Vite + react-router-dom + Express(NestJS)/MySQL**. Không port file `.tsx`; chỉ tái dùng **logic thuần + UX**.

Quyết định đã chốt với stakeholder:
- Phạm vi: **chỉ viewer** (grid + lightbox + tải từng ảnh + tải toàn bộ). Bỏ bình luận, yêu thích, chọn nhiều, mật khẩu folder, NAS, my-albums, ZIP client-side.
- Nguồn ảnh: **`drive_url` sẵn có** trong feedback/job. Không bảng DB mới.
- Đọc Drive: **Google Apps Script** (user tự dựng), Express proxy server→server.
- **Subfolder lồng nhau**: folder paste vào có thể chứa nhiều subfolder (vd "Ảnh ngày 1", "Ảnh ngày 2", "Video"). GAS đệ quy, gom **2 cấp**, client hiện **tab thư mục thích ứng** (≥2 nhóm → tab; phẳng → grid thẳng).
- **Video: bỏ qua** — GAS chỉ trả `mimeType image/*`. Khách tải video qua nút "Tải toàn bộ" → Drive.
- Tải toàn bộ: **chuyển sang Drive folder** để Google tự nén (né CORS).
- Lazy-load: render 30-40 ảnh đầu của nhóm đang xem, "Xem thêm" render tiếp; đổi tab reset cửa sổ.
- Folder Drive luôn để "anyone with link" (thực tế hiện tại của team).

## Luồng tổng quan

```
Browser  /gallery/abc123
   │  GET /api/feedback?resource=gallery&share_token=abc123     ← KHÔNG gửi folderId
   ▼
Express  feedback.js getGallery()
   │  getFeedbackByShareToken → job → drive_link (đã có)
   │  extractDriveFolderId(drive_link) → folderId | null
   │  nếu folderId && GALLERY_GAS_URL:
   │      listDriveFolderPhotos(folderId)  → fetch GAS?folderId=...  (server→server)
   │      GAS đệ quy subfolder + lọc image/* → photos:[{fileId,name,parentName}]
   │  nếu không: photos:[]   (trang về nút Drive cũ)
   ▼
Response { feedback, job, drive_link, survey_link, photos:[{fileId,name,parentName}] }
   ▼
FeedbackGalleryPage
   │  groupPhotosByFolder(photos) → nhóm 2 cấp
   │  nhóm ≥2 → <GalleryFolderTabs> [Tất cả][Ngày 1][Ngày 2]; phẳng → ẩn tab
   │  photos.length > 0 → render <GalleryGrid> (36 đầu của nhóm) + "Xem thêm"
   │                      mỗi fileId → lh3.googleusercontent.com/d/<id>=w<size>
   │  photos.length === 0 → giữ nút "Tải ảnh từ Google Drive" (như cũ)
   │  luôn có: nút "Tải toàn bộ" (mở Drive folder) + nút survey
   ▼
Click ảnh → <GalleryLightbox> (xem lớn, prev/next trong nhóm, zoom/pan, tải ảnh này)
```

## Quyết định kỹ thuật

### 1. Đọc Drive: Google Apps Script qua Express proxy

Cân nhắc 3 cách: (A) GAS, (B) Google Drive API, (C) iframe embed. Chọn **A** vì:
- Tái dùng nguyên thiết kế `album-gdrive-list` của module gốc (đã kiểm chứng).
- Không cần OAuth/service account/GCP project — ít hạ tầng phải dựng/bảo trì.
- (B) overkill cho phạm vi viewer; (C) phủ định mục tiêu UI đẹp (chỉ là khung Google).

GAS Web App `/exec?folderId=<id>` đệ quy folder gốc + subfolder con, **chỉ lấy file `mimeType` bắt đầu `image/`** (loại video/khác), trả JSON `{ ok, photos:[{fileId,name,parentName,mimeType}] }` — `parentName` là tên subfolder trực tiếp chứa ảnh (ảnh ở gốc → `null`/`""`). Express gọi server→server với `redirect: "follow"` (GAS deploy trả 302). Lý do qua Express thay vì client gọi thẳng: Drive/GAS không phát `Access-Control-Allow-Origin` ổn định → CORS; và để **giấu URL GAS** + **không trust folderId từ client**.

### 2. Không trust folderId từ client

Client chỉ gửi `share_token`. Server giải `drive_link` (đã scope theo token qua `getFeedbackByShareToken`) rồi tự `extractDriveFolderId`. Khách không thể liệt kê folder Drive bất kỳ. Đây là port trực tiếp bài học bảo mật của module gốc ("client không gửi path, server tra DB rồi mới ký/gọi").

### 3. extractDriveFolderId — chịu nhiều định dạng

`drive_url` "nhiều định dạng" (theo xác nhận của stakeholder). Helper phải nhận diện:

| Định dạng | Ví dụ |
|---|---|
| folders path | `https://drive.google.com/drive/folders/<ID>` |
| folders + query | `.../folders/<ID>?usp=sharing`, `?usp=drive_link` |
| open?id | `https://drive.google.com/open?id=<ID>` |
| có `/u/0/` | `.../drive/u/0/folders/<ID>` |
| không nhận ra | trả `null` → `photos: []` → trang về nút Drive cũ |

Quy tắc: ưu tiên regex `/folders/([A-Za-z0-9_-]+)`, fallback `[?&]id=([A-Za-z0-9_-]+)`. Không cố đoán nếu link là file lẻ hoặc link rút gọn không giải được — trả `null` an toàn.

### 4. Build URL ảnh (logic thuần, port từ albumService)

```
view (thumb/lớn):  https://lh3.googleusercontent.com/d/<fileId>=w<size>
view gốc:          https://lh3.googleusercontent.com/d/<fileId>
download 1 ảnh:    https://drive.usercontent.google.com/download?id=<fileId>&export=download&confirm=t
```

Mirror logic ở 2 nơi: `apps/api/lib/gallery-drive.js` (server, dùng nếu cần) và `apps/web/.../lib/galleryDrive.js` (client, render `<img>`). Giữ đồng bộ; ưu tiên client build vì server đã trả `fileId`.

Kích thước đề xuất: grid `=w600`~`=w800` (thumb), lightbox `=w1600`~`=w2048` (lớn). `lh3` tự resize phía Google.

### 5. Subfolder lồng nhau → tab thư mục thích ứng

Folder paste vào có thể chứa subfolder (vd A → "Ảnh ngày 1", "Ảnh ngày 2", "Video"). GAS đã đệ quy + lọc ảnh + gắn `parentName`. Client gom **2 cấp** bằng `groupPhotosByFolder(photos)`:

```
groupPhotosByFolder(photos):
  - nhóm theo parentName ('' / null = "Gốc")
  - trả [{ name, photos[] }]  + luôn có nhóm ảo "Tất cả" (toàn bộ ảnh)
  - subfolder sâu hơn 2 cấp: GAS đã quy về parentName của lớp con gần nhất
```

UI thích ứng:

```
   nhóm thực ≥ 2   →  <GalleryFolderTabs> [Tất cả][Ảnh ngày 1][Ảnh ngày 2]  (port AlbumFolderBar)
   phẳng / 1 nhóm  →  ẩn tab, grid thẳng (toàn bộ ảnh)
```

Lý do tab (không phải section cuộn dọc): khớp UI module gốc; ăn khớp lazy-load (mỗi tab cửa sổ riêng, đổi tab reset sạch — section thì windowing xuyên nhóm rối); không thừa khi folder phẳng. Đánh đổi: khách bấm tab mới thấy nhóm khác — chấp nhận được vì "giao ảnh theo ngày/sự kiện" thường muốn lọc theo nhóm.

**Video bị loại tại GAS** (chỉ trả `image/*`) → nhóm "Video" không xuất hiện. Khách tải video qua "Tải toàn bộ" → Drive.

### 6. Lazy-load + "Xem thêm" (theo tab)

GAS trả **toàn bộ** metadata 1 lần (chỉ `{fileId,name,parentName}`, nhẹ). Client giữ full list, render theo cửa sổ **trong nhóm đang chọn**:

```
const PAGE = 36
const [tab, setTab] = useState('all')
const [visible, setVisible] = useState(PAGE)
const groupPhotos = photosOfTab(tab)
groupPhotos.slice(0, visible).map(render)
// "Xem thêm": setVisible(v => v + PAGE)        // ảnh mới tải, KHÔNG gọi lại GAS
// đổi tab:    setTab(id); setVisible(PAGE)      // reset cửa sổ về đầu
```

Mỗi `<img loading="lazy">` để trình duyệt hoãn tải ngoài viewport. Lý do giới hạn: né rate-limit `lh3.googleusercontent.com` khi album hàng trăm ảnh.

### 7. Viewer web — port UX, viết lại DOM

| Component module (.tsx, RN) | Component mới (.jsx, web) | Port gì / bỏ gì |
|---|---|---|
| `AlbumGrid` (masonry cân cột) | `GalleryGrid.jsx` | PORT: chia N cột theo chiều cao tích lũy (`h/w` ratio), 2 cột <480px / 3 cột ≥480px. BỎ: favorites, select-mode. CSS columns hoặc JS column-split. |
| `AlbumPhotoCard` | `GalleryPhotoCard.jsx` | PORT: ảnh bo góc, hover, nút tải. BỎ: tim, checkbox chọn. |
| `AlbumFolderBar` (tab lọc thư mục) | `GalleryFolderTabs.jsx` | PORT: tab [Tất cả][nhóm...], đếm số ảnh/nhóm, active underline. BỎ: tab "Yêu thích", subfolder cấp 2 bar riêng (gộp 2 cấp đủ dùng), khoá folder. Chỉ render khi ≥2 nhóm. |
| `AlbumLightbox` (400 dòng) | `GalleryLightbox.jsx` | PORT: xem lớn, prev/next (phím ← →, nút) trong nhóm đang xem, zoom/pan (wheel desktop, pinch mobile), vuốt mobile, blur-up placeholder từ thumb grid, nút tải ảnh này, đóng (Esc/nút). TÙY: slideshow/fullscreen/xoay (nhẹ, port nếu còn thời gian). BỎ: `AlbumCommentPanel`, favorites, thumbnail-strip (có thể thêm sau). |

Styling: Tailwind v3 (DOM thật) — `className` của module gần khớp, nhưng phải đổi `View`→`div`, `Pressable`→`button`, `expo-image Image`→`<img>`, bỏ `reanimated`/`gesture-handler` (dùng CSS transition + pointer events).

### 8. Tải ảnh

- **Từng ảnh**: `<a href={buildDriveDownloadUrl(fileId)} download>` trên card + trong lightbox. Endpoint `drive.usercontent.google.com/download` né trang virus-scan với `confirm=t`.
- **Toàn bộ**: nút "Tải toàn bộ" = mở `drive_link` (folder) ở tab mới; khách dùng nút Download của Drive để Google nén ZIP. **Không** fetch blob/JSZip phía client (Drive không phát ACAO → CORS). Đây là lựa chọn có chủ đích của stakeholder.

### 9. Fallback nhiều tầng (không bao giờ "vỡ trang")

```
GALLERY_GAS_URL trống            → photos:[] → chỉ nút Drive (hành vi cũ y hệt)
drive_link không phải folder     → photos:[] → chỉ nút Drive
GAS lỗi/timeout                  → photos:[] + log cảnh báo → chỉ nút Drive
folder chỉ có video (0 ảnh)      → photos:[] → chỉ nút Drive
ảnh lh3 lỗi tải lẻ               → <img onerror> hiện placeholder, ảnh khác vẫn chạy
```

Nguyên tắc: viewer là **lớp tăng cường**, nút Drive cũ luôn là lưới an toàn.

## Rủi ro

- 🟠 **GAS là phụ thuộc ngoài**: Google đổi GAS runtime hoặc folder mất quyền → liệt kê fail. Giảm thiểu: fallback về nút Drive + thông báo nhẹ, không chặn trang.
- 🟠 **`lh3` rate-limit / đổi URL**: tải nhiều ảnh nét cao có thể bị giới hạn. Giảm thiểu: lazy-load + "Xem thêm" + `onerror` placeholder.
- 🟠 **drive_url đa dạng**: regex extract có thể trượt định dạng lạ. Giảm thiểu: trả `null` an toàn + test nhiều định dạng + (bước code) kiểm tra mẫu thật trong DB.
- 🟠 **GAS đệ quy folder lớn chậm / timeout**: album nhiều subfolder + hàng nghìn file → GAS có thể chạm giới hạn thời gian. Giảm thiểu: GAS chỉ trả metadata (không tải bytes), cân nhắc giới hạn độ sâu/đếm; timeout server → fallback nút Drive.
- 🟢 **Bảo mật**: client không gửi folderId, GAS URL giấu server, token-no-login giữ nguyên pattern.

## Việc KHÔNG làm (out of scope)

**Chỗ nhập link Google Drive giữ nguyên 100%.** Change này chỉ *đọc* `drive_url`/`drive_feedback` đã có trong DB; không thêm/sửa bất kỳ ô nhập link nào. Link vẫn do nhân sự nhập như hiện tại — qua nhansu-eventus và/hoặc UI sẵn có trong client-eventus (`FeedbackDetailPage`: `saveFooterLinks` + form ở dòng 614). Trang khách `/gallery/{token}` không bao giờ có ô nhập link.

Ngoài ra: bình luận, yêu thích, chọn nhiều ảnh, mật khẩu thư mục, NAS gateway, "album của tôi", ZIP nén client-side, bảng DB album riêng, Supabase/RLS/RPC, admin tạo/sửa album, video player. Nếu sau này cần, mở change mới.

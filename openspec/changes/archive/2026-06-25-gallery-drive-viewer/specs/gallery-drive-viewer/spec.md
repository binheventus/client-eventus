# Spec: gallery-drive-viewer

## ADDED Requirements

### Requirement: Gallery endpoint returns Drive photo list

`GET /api/feedback?resource=gallery&share_token=<token>` (handler `getGallery`) SHALL return, in addition to the existing fields (`feedback`, `job`, `drive_link`, `survey_link`), a `photos` array of `{ fileId, name, parentName }` objects listing the images in the gallery's Google Drive folder (including images in subfolders, with `parentName` set to the containing subfolder name, or `null`/`""` for the root). The server MUST derive the folder ID itself from the already-resolved `drive_link` (scoped by `share_token`); it MUST NOT accept a `folderId` from the client. When the folder cannot be listed for any reason, `photos` MUST be an empty array and all existing fields MUST remain unchanged.

#### Scenario: Valid folder link with GAS configured returns photos

- **WHEN** a gallery's `drive_link` is a valid Drive folder URL and `GALLERY_GAS_URL` is configured
- **THEN** the response includes `photos` as a non-empty array of `{ fileId, name }` and the existing `drive_link`/`survey_link`/`job`/`feedback` fields are unchanged

#### Scenario: GAS not configured falls back to empty photos

- **WHEN** `GALLERY_GAS_URL` is not set
- **THEN** the response includes `photos: []` and `drive_link` still points to the Drive folder so the page can show the legacy download button

#### Scenario: drive_link is not a folder

- **WHEN** the gallery's `drive_link` is empty, a single-file link, or an unrecognized format
- **THEN** the server returns `photos: []` without calling GAS

#### Scenario: Client cannot inject a folder id

- **WHEN** the client includes a `folderId` (or `folder_id`) query parameter in the gallery request
- **THEN** the server ignores it and derives the folder ID only from the token-scoped `drive_link`

### Requirement: Drive folder listing via Google Apps Script proxy

The server SHALL list Drive folder contents by calling a Google Apps Script Web App (`GALLERY_GAS_URL`) server-to-server with the folder ID as a query parameter, following redirects. The GAS script SHALL recurse into subfolders and SHALL return only image files (`mimeType` beginning with `image/`), each tagged with its containing subfolder name (`parentName`). The GAS URL MUST NOT be exposed to the browser. Listing failures (non-2xx, timeout, malformed JSON, `ok:false`) MUST be caught and logged, and MUST result in `photos: []` rather than an error response.

#### Scenario: GAS returns photo list

- **WHEN** `listDriveFolderPhotos(folderId)` calls GAS and GAS responds `{ ok: true, photos: [{ fileId, name, parentName }] }`
- **THEN** the function returns that photos array

#### Scenario: Subfolder images are included with parent name

- **WHEN** the folder contains subfolders "Ảnh ngày 1" and "Ảnh ngày 2" each with images
- **THEN** the returned photos include those images with `parentName` set to "Ảnh ngày 1" / "Ảnh ngày 2" respectively

#### Scenario: Video files are excluded

- **WHEN** the folder (or a subfolder) contains video files alongside images
- **THEN** the returned photos contain only the image files; video files are omitted

#### Scenario: GAS error is swallowed

- **WHEN** GAS responds with a non-2xx status, times out beyond `GALLERY_GAS_TIMEOUT_MS`, or returns `{ ok: false }`
- **THEN** the function logs a warning and returns `[]`

#### Scenario: Folder with only videos yields no photos

- **WHEN** the folder contains only video files and no images
- **THEN** the function returns `[]` and the page falls back to the legacy Drive button

### Requirement: Drive folder ID extraction handles multiple URL formats

A helper `extractDriveFolderId(url)` SHALL return the Drive folder ID from common share-link formats and return `null` for anything it cannot confidently parse as a folder.

#### Scenario: Standard folder link

- **WHEN** the URL is `https://drive.google.com/drive/folders/ABC123`
- **THEN** the helper returns `ABC123`

#### Scenario: Folder link with usp query

- **WHEN** the URL is `https://drive.google.com/drive/folders/ABC123?usp=sharing` or `?usp=drive_link`
- **THEN** the helper returns `ABC123`

#### Scenario: open?id and /u/0/ variants

- **WHEN** the URL is `https://drive.google.com/open?id=ABC123` or `https://drive.google.com/drive/u/0/folders/ABC123`
- **THEN** the helper returns `ABC123`

#### Scenario: Unrecognized link returns null

- **WHEN** the URL is empty, a single-file link (`/file/d/...`), or an unparseable shortened link
- **THEN** the helper returns `null`

### Requirement: Drive image and download URL builders

Helpers SHALL build static Drive URLs from a `fileId`: a viewable URL `https://lh3.googleusercontent.com/d/<fileId>=w<size>` (or without `=w` when no size), and a download URL `https://drive.usercontent.google.com/download?id=<fileId>&export=download&confirm=t`. These are pure functions with no network calls and are mirrored on client and server.

#### Scenario: View URL with size

- **WHEN** building a view URL for `fileId=ABC` at size `800`
- **THEN** the result is `https://lh3.googleusercontent.com/d/ABC=w800`

#### Scenario: Download URL

- **WHEN** building a download URL for `fileId=ABC`
- **THEN** the result is `https://drive.usercontent.google.com/download?id=ABC&export=download&confirm=t`

### Requirement: Inline gallery viewer at /gallery/{token}

When the gallery response includes a non-empty `photos` array, `/gallery/{token}` SHALL render the images inline as a masonry grid instead of only showing the legacy Drive button. The page MUST keep its existing Eventus branding (logo, layout), the "Tải toàn bộ" action, and the survey link.

#### Scenario: Photos present render as grid

- **WHEN** the gallery response has `photos.length > 0`
- **THEN** the page renders a masonry grid of images (each `<img>` built from `lh3.googleusercontent.com/d/<fileId>`) and a lightbox is available on click

#### Scenario: No photos falls back to legacy button

- **WHEN** the gallery response has `photos: []`
- **THEN** the page shows the existing "Tải ảnh từ Google Drive" button and does not render an empty grid

### Requirement: Adaptive folder tabs for subfolders

When the returned photos span **two or more distinct subfolder groups** (by `parentName`), the viewer SHALL render a folder tab bar — an "Tất cả" tab plus one tab per group — and filter the grid to the selected group. When the photos form a single group (flat folder, or all at root), the tab bar MUST be hidden and the grid renders all photos directly. Grouping is two levels deep (root + one subfolder layer); deeper nesting is collapsed into the nearest named group by GAS.

#### Scenario: Two subfolders show tabs

- **WHEN** photos belong to "Ảnh ngày 1" and "Ảnh ngày 2"
- **THEN** the viewer shows tabs `[Tất cả] [Ảnh ngày 1] [Ảnh ngày 2]` and selecting a tab filters the grid to that group

#### Scenario: Flat folder hides tabs

- **WHEN** all photos share the same group (no subfolders)
- **THEN** no tab bar is shown and the grid renders all photos

#### Scenario: Tất cả tab shows everything

- **WHEN** the user selects the "Tất cả" tab
- **THEN** the grid renders photos from all groups combined

### Requirement: Lazy-loaded grid with "Xem thêm"

The viewer SHALL initially render at most a fixed window (36 by default) of the photos **in the active group** and provide a "Xem thêm" control that reveals the next window. Switching folder tabs MUST reset the window to the first 36. Revealing more photos MUST NOT trigger another folder-listing request; the full list is fetched once. Each image MUST use native lazy loading.

#### Scenario: Initial window limits rendered images

- **WHEN** the active group contains 200 photos
- **THEN** the grid initially renders only the first 36 and shows a "Xem thêm" control

#### Scenario: Xem thêm reveals next window without refetch

- **WHEN** the user clicks "Xem thêm"
- **THEN** the next 36 photos render from the already-loaded list and no new request to the gallery/GAS endpoint is made

#### Scenario: Switching tab resets the window

- **WHEN** the user has revealed 72 photos in one group and switches to another tab
- **THEN** the new group renders its first 36 photos and the "Xem thêm" control reflects the new group

#### Scenario: All photos shown hides control

- **WHEN** the number of revealed photos reaches the active group total
- **THEN** the "Xem thêm" control is hidden

### Requirement: Lightbox for single-photo viewing

Clicking a grid image SHALL open a lightbox showing the larger image with navigation to previous/next **within the active folder group**, zoom/pan, close (Esc, button, or backdrop click), and a download action for the current image. The lightbox MUST NOT include comments, favorites, or multi-select.

#### Scenario: Open and navigate

- **WHEN** the user clicks the 3rd image
- **THEN** the lightbox opens on that image and the left/right arrow keys (and on-screen buttons) move to the previous/next image

#### Scenario: Download current image

- **WHEN** the user triggers download inside the lightbox
- **THEN** the browser downloads the original via `drive.usercontent.google.com/download?id=<fileId>`

#### Scenario: Close lightbox

- **WHEN** the user presses Esc, clicks the close button, or clicks the backdrop
- **THEN** the lightbox closes and returns to the grid

### Requirement: Per-image and full-album download

The viewer SHALL offer downloading a single image directly from Drive, and a "Tải toàn bộ" action that opens the Drive folder in a new tab (letting Google zip and serve). The viewer MUST NOT fetch image bytes client-side for zipping.

#### Scenario: Download single image from card

- **WHEN** the user clicks the download control on a grid card
- **THEN** the original image downloads via the Drive download URL for that `fileId`

#### Scenario: Tải toàn bộ opens Drive folder

- **WHEN** the user clicks "Tải toàn bộ"
- **THEN** the Drive folder (`drive_link`) opens in a new tab and no client-side zip is attempted

### Requirement: Resilient image loading

Individual image load failures MUST NOT break the gallery. A failed image SHALL show a placeholder while the rest of the grid continues to function.

#### Scenario: One image fails to load

- **WHEN** an `lh3.googleusercontent.com` image returns an error
- **THEN** that card shows a placeholder and all other images remain viewable

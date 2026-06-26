## MODIFIED Requirements

### Requirement: Inline gallery viewer at /gallery/{token}

When the gallery response includes a non-empty `photos` array, `/gallery/{token}` SHALL render the images inline as a masonry grid instead of only showing the legacy Drive button. The page MUST keep its existing Eventus branding (logo, layout), the "Tải toàn bộ" action, and the survey link.

The photo grid SHALL be presented full-width relative to the page rather than confined to the narrow centered content card: the grid container MAY expand beyond the branding card's max width (up to a wide page-level maximum) while the branding header and the download/survey CTAs remain in the existing centered, narrower layout. The masonry grid SHALL increase its column count responsively as viewport width grows (at least 2 columns on small screens up to 5 columns on wide screens). Because images retain their natural aspect ratios, the wider container and added columns produce visibly varied image sizes (tall/short staggering) rather than a uniform grid. This change is presentation-only: it MUST NOT alter the gallery API, the photo data shape, authentication, or the behavior of folder tabs, "Xem thêm", the lightbox, per-image download, or image-failure fallback.

#### Scenario: Photos present render as grid

- **WHEN** the gallery response has `photos.length > 0`
- **THEN** the page renders a masonry grid of images (each `<img>` built from `lh3.googleusercontent.com/d/<fileId>`) and a lightbox is available on click

#### Scenario: No photos falls back to legacy button

- **WHEN** the gallery response has `photos: []`
- **THEN** the page shows the existing "Tải ảnh từ Google Drive" button and does not render an empty grid

#### Scenario: Grid spans wider than the branding card

- **WHEN** photos are rendered on a desktop-width viewport
- **THEN** the photo grid occupies a width noticeably greater than the centered branding card's max width, while the logo/title and the download/survey buttons stay in their existing centered narrow layout

#### Scenario: Column count grows with viewport width

- **WHEN** the viewport widens from mobile to a wide desktop
- **THEN** the masonry grid renders more columns at wider breakpoints (from 2 columns on small screens up to 5 on wide screens), and images of differing natural heights stagger to show varied sizes

#### Scenario: Existing interactions unchanged

- **WHEN** the layout change is applied
- **THEN** folder tabs, the "Xem thêm" window, the lightbox (open/navigate/close/download), per-image download, and the failed-image placeholder all behave exactly as before

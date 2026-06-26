## ADDED Requirements

### Requirement: Download is the primary action in the header

The gallery viewer SHALL present a "Tải toàn bộ ảnh" action in the page header (above the photo grid) as a visually primary control, so a visitor can download without scrolling past the grid. When `drive_link` is missing, the header MUST show the existing "Chưa có link tải ảnh" fallback state instead. This action MUST open the Drive folder in a new tab and MUST NOT attempt client-side zipping.

#### Scenario: Download visible without scrolling

- **WHEN** the gallery loads with a valid `drive_link`
- **THEN** a primary "Tải toàn bộ ảnh" control is visible in the header before the photo grid, and clicking it opens the Drive folder in a new tab

#### Scenario: Missing drive link shows fallback in header

- **WHEN** the gallery has no `drive_link`
- **THEN** the header shows the "Chưa có link tải ảnh" fallback and no download control

### Requirement: Feedback invitation as a closing call-to-action

The viewer SHALL present the survey invitation ("Phản hồi về trải nghiệm tại Eventus") as a visually primary control inside a dedicated closing card rendered after the photo grid (and after the "Xem thêm" control). The closing card SHALL always be present at the end of the rendered content when photos are shown, with warm branding styling distinct from the neutral grid area, and MUST link to the existing `survey_link`.

#### Scenario: Closing card invites feedback at the end

- **WHEN** photos are rendered
- **THEN** a closing card appears after the grid with a primary "Gửi phản hồi" control linking to `survey_link`

#### Scenario: Closing card always present with photos

- **WHEN** the visitor has not yet revealed all photos via "Xem thêm"
- **THEN** the closing card is still rendered at the end of the currently shown content

### Requirement: Sticky access bar on scroll

When the visitor scrolls the gallery, the viewer SHALL show a thin sticky bar containing the event name plus both a download action and a feedback action, keeping both within reach without scrolling to the top or bottom. The sticky bar MUST reuse the same destinations (`drive_link` and `survey_link`) as the header and closing card.

#### Scenario: Sticky bar appears on scroll

- **WHEN** the visitor scrolls down past the header
- **THEN** a thin sticky bar with the event name, a download action, and a feedback action remains visible

#### Scenario: Sticky bar actions match primary CTAs

- **WHEN** the visitor uses the download or feedback action in the sticky bar
- **THEN** they navigate to the same `drive_link` (new tab) / `survey_link` destinations as the header/closing CTAs

### Requirement: Photo grid uses a neutral background; branding frames the page

The photo grid area SHALL render on a neutral background (light gray/white) so images are the focal point. Warm Eventus branding (orange tones / decorative pattern) SHALL be limited to the header and the closing card, framing the top and bottom of the page rather than spanning behind the grid.

#### Scenario: Grid background is neutral

- **WHEN** photos are rendered
- **THEN** the area behind the grid uses a neutral background and the orange decorative pattern is not rendered behind the images

#### Scenario: Branding frames header and closing

- **WHEN** the page renders
- **THEN** warm branding styling appears in the header and the closing card, not behind the photo grid

### Requirement: Visual hierarchy distinguishes the two CTAs

The download and feedback actions MUST be visually distinguishable rather than identical: each is the primary (emphasized) control in its own zone — download in the header (and mirrored in the sticky bar), feedback in the closing card (and mirrored in the sticky bar). They MUST NOT both render as identical equal-weight buttons stacked together at the bottom of the page.

#### Scenario: CTAs are not identical and not stacked at the bottom

- **WHEN** the page renders with photos
- **THEN** the download and feedback controls are not two identical equal-weight buttons placed side by side at the bottom; each is emphasized within its respective zone (header / closing card)

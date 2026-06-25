/**
 * Gallery Drive Lister — Google Apps Script Web App
 * Change: gallery-drive-viewer (task 1.0)
 *
 * WHAT IT DOES
 *   doGet(?folderId=<id>) walks a Google Drive folder + its subfolders and
 *   returns ONLY image files as JSON:
 *     { ok: true, photos: [{ fileId, name, parentName, mimeType }] }
 *   - parentName = name of the first-level subfolder the image lives under.
 *   - parentName = null for images sitting directly in the pasted root folder.
 *   - Grouping is 2 levels deep (root + one subfolder layer). Images nested
 *     deeper than one level are collapsed into their FIRST-LEVEL ancestor's
 *     name, so the web viewer gets a small, stable set of folder tabs.
 *   - Non-image files (video/*, application/*, ...) are skipped on purpose.
 *   On any failure it returns { ok: false, error, photos: [] } — the server
 *   treats that exactly like an empty list and falls back to the Drive button.
 *
 * ── DEPLOY (stakeholder) ────────────────────────────────────────────────
 *   1. https://script.google.com → New project → paste this whole file.
 *   2. Deploy ▸ New deployment ▸ type "Web app".
 *        - Description: gallery-drive-viewer
 *        - Execute as:        Me
 *        - Who has access:    Anyone
 *   3. Copy the Web app URL ending in /exec.
 *   4. Put it in the API server env as GALLERY_GAS_URL=<that /exec URL>.
 *   5. Drive folders shared to clients must be "Anyone with the link".
 *
 *   Quick test in the browser (folder must be readable by the deploying user):
 *     https://script.google.com/.../exec?folderId=YOUR_FOLDER_ID
 * ─────────────────────────────────────────────────────────────────────────
 */

var IMAGE_PREFIX = 'image/';
var MAX_DEPTH = 5;       // safety cap: how deep to recurse
var MAX_PHOTOS = 5000;   // safety cap: max images returned (avoids huge payloads)

function doGet(e) {
  var folderId = (e && e.parameter && e.parameter.folderId)
    ? String(e.parameter.folderId).trim()
    : '';

  if (!folderId) {
    return jsonOutput({ ok: false, error: 'MISSING_FOLDER_ID', photos: [] });
  }

  try {
    var root = DriveApp.getFolderById(folderId);
    var photos = [];
    collectImages(root, null, 0, photos);
    return jsonOutput({ ok: true, photos: photos });
  } catch (err) {
    return jsonOutput({
      ok: false,
      error: String(err && err.message ? err.message : err),
      photos: []
    });
  }
}

/**
 * Recursively collect image files.
 * @param {Folder}      folder      current folder being scanned
 * @param {string|null} parentName  first-level subfolder name (null at root)
 * @param {number}      depth       current recursion depth (root = 0)
 * @param {Array}       out         accumulator of photo objects
 */
function collectImages(folder, parentName, depth, out) {
  if (out.length >= MAX_PHOTOS) return;

  // 1) image files directly in this folder
  var files = folder.getFiles();
  while (files.hasNext() && out.length < MAX_PHOTOS) {
    var file = files.next();
    var mimeType = file.getMimeType() || '';
    if (mimeType.indexOf(IMAGE_PREFIX) === 0) {
      out.push({
        fileId: file.getId(),
        name: file.getName(),
        parentName: parentName, // null at root, first-level subfolder name below
        mimeType: mimeType
      });
    }
  }

  if (depth >= MAX_DEPTH) return;

  // 2) descend into subfolders
  var subs = folder.getFolders();
  while (subs.hasNext() && out.length < MAX_PHOTOS) {
    var sub = subs.next();
    // 2-level grouping: a first-level subfolder defines the group name; any
    // deeper folder keeps the first-level ancestor's name (parentName stays).
    var groupName = (parentName === null) ? sub.getName() : parentName;
    collectImages(sub, groupName, depth + 1, out);
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

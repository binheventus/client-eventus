/**
 * Gallery Drive Lister — Google Apps Script Web App
 * Change: gallery-drive-viewer (task 1.0)
 *
 * WHAT IT DOES
 *   doGet(?folderId=<id>) walks a Google Drive folder + its subfolders and
 *   returns ONLY image files as JSON:
 *     { ok: true, photos: [{
 *       fileId, name, parentName, parentId, parentUrl,
 *       parentPath, topParentName, topParentId, topParentUrl, mimeType
 *     }] }
 *   - parentName/parentId/parentUrl = direct containing folder for the image.
 *   - parentPath = folder path from pasted root to the containing folder.
 *   - topParentName/topParentId/topParentUrl = first folder under pasted root.
 *   - parentName = null for images sitting directly in the pasted root folder.
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
    collectImages(root, [], [], [], 0, photos);
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
 * @param {Folder}      folder     current folder being scanned
 * @param {Array}       pathNames  folder names from pasted root to current folder
 * @param {Array}       pathIds    folder IDs from pasted root to current folder
 * @param {Array}       pathUrls   folder URLs from pasted root to current folder
 * @param {number}      depth      current recursion depth (root = 0)
 * @param {Array}       out        accumulator of photo objects
 */
function collectImages(folder, pathNames, pathIds, pathUrls, depth, out) {
  if (out.length >= MAX_PHOTOS) return;

  // 1) image files directly in this folder
  var files = folder.getFiles();
  while (files.hasNext() && out.length < MAX_PHOTOS) {
    var file = files.next();
    var mimeType = file.getMimeType() || '';
    if (mimeType.indexOf(IMAGE_PREFIX) === 0) {
      var lastIndex = pathNames.length - 1;
      out.push({
        fileId: file.getId(),
        name: file.getName(),
        parentName: lastIndex >= 0 ? pathNames[lastIndex] : null,
        parentId: lastIndex >= 0 ? pathIds[lastIndex] : folder.getId(),
        parentUrl: lastIndex >= 0 ? pathUrls[lastIndex] : folder.getUrl(),
        parentPath: pathNames.slice(),
        topParentName: pathNames.length > 0 ? pathNames[0] : null,
        topParentId: pathIds.length > 0 ? pathIds[0] : null,
        topParentUrl: pathUrls.length > 0 ? pathUrls[0] : null,
        mimeType: mimeType
      });
    }
  }

  if (depth >= MAX_DEPTH) return;

  // 2) descend into subfolders
  var subs = folder.getFolders();
  while (subs.hasNext() && out.length < MAX_PHOTOS) {
    var sub = subs.next();
    collectImages(
      sub,
      pathNames.concat([sub.getName()]),
      pathIds.concat([sub.getId()]),
      pathUrls.concat([sub.getUrl()]),
      depth + 1,
      out
    );
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

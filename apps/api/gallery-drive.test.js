import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearGalleryDriveCache,
  driveImageUrl,
  extractDriveFolderId,
  groupPhotosByFolder,
  listDriveFolderPhotos,
  listDriveFolderPhotosDetailed,
} from './lib/gallery-drive.js'

function setEnv(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

async function withEnv(values, callback) {
  const previous = new Map(Object.keys(values).map(name => [name, process.env[name]]))
  Object.entries(values).forEach(([name, value]) => setEnv(name, value))
  clearGalleryDriveCache()
  try {
    return await callback()
  } finally {
    clearGalleryDriveCache()
    previous.forEach((value, name) => setEnv(name, value))
  }
}

test('extractDriveFolderId: standard folder link', () => {
  assert.equal(extractDriveFolderId('https://drive.google.com/drive/folders/ABC123'), 'ABC123')
})

test('extractDriveFolderId: folder link with usp query', () => {
  assert.equal(extractDriveFolderId('https://drive.google.com/drive/folders/ABC123?usp=sharing'), 'ABC123')
  assert.equal(extractDriveFolderId('https://drive.google.com/drive/folders/ABC123?usp=drive_link'), 'ABC123')
})

test('extractDriveFolderId: open?id and /u/0/ variants', () => {
  assert.equal(extractDriveFolderId('https://drive.google.com/open?id=ABC123'), 'ABC123')
  assert.equal(extractDriveFolderId('https://drive.google.com/drive/u/0/folders/ABC123'), 'ABC123')
})

test('extractDriveFolderId: unrecognized links return null', () => {
  assert.equal(extractDriveFolderId(''), null)
  assert.equal(extractDriveFolderId(null), null)
  assert.equal(extractDriveFolderId('https://drive.google.com/file/d/FILE123/view'), null)
  assert.equal(extractDriveFolderId('https://example.com/whatever'), null)
})

test('driveImageUrl: view url with and without size', () => {
  assert.equal(driveImageUrl('ABC', 'view', 800), 'https://lh3.googleusercontent.com/d/ABC=w800')
  assert.equal(driveImageUrl('ABC', 'view'), 'https://lh3.googleusercontent.com/d/ABC')
  assert.equal(driveImageUrl('ABC'), 'https://lh3.googleusercontent.com/d/ABC')
})

test('driveImageUrl: download url', () => {
  assert.equal(
    driveImageUrl('ABC', 'download'),
    'https://drive.usercontent.google.com/download?id=ABC&export=download&confirm=t',
  )
})

test('groupPhotosByFolder: root photos use Gốc and parentName null collapses', () => {
  const photos = [
    { fileId: '1', name: 'a', parentName: null },
    { fileId: '2', name: 'b', parentName: '' },
  ]
  const { groups, hasMultiple } = groupPhotosByFolder(photos)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, 'Gốc')
  assert.equal(groups[0].photos.length, 2)
  assert.equal(hasMultiple, false)
})

test('groupPhotosByFolder: 2+ named groups flags multiple', () => {
  const photos = [
    { fileId: '1', name: 'a', parentName: 'Ảnh ngày 1' },
    { fileId: '2', name: 'b', parentName: 'Ảnh ngày 2' },
    { fileId: '3', name: 'c', parentName: 'Ảnh ngày 1' },
  ]
  const { groups, hasMultiple } = groupPhotosByFolder(photos)
  assert.equal(groups.length, 2)
  assert.equal(hasMultiple, true)
  assert.deepEqual(groups.map(g => g.name), ['Ảnh ngày 1', 'Ảnh ngày 2'])
  assert.equal(groups[0].photos.length, 2)
})

test('groupPhotosByFolder: empty/invalid input', () => {
  assert.deepEqual(groupPhotosByFolder([]), { groups: [], hasMultiple: false })
  assert.deepEqual(groupPhotosByFolder(undefined), { groups: [], hasMultiple: false })
})

test('listDriveFolderPhotos: returns [] when GAS url is empty', async () => {
  await withEnv({ GALLERY_GAS_URL: '   ' }, async () => {
    const result = await listDriveFolderPhotos('FID')
    assert.deepEqual(result, [])
  })
})

test('listDriveFolderPhotosDetailed: reports not_configured when GAS url is empty', async () => {
  await withEnv({ GALLERY_GAS_URL: '   ' }, async () => {
    const result = await listDriveFolderPhotosDetailed('FID')
    assert.deepEqual(result, { photos: [], status: 'not_configured' })
  })
})

test('listDriveFolderPhotos: returns [] for empty folderId without calling fetch', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec' }, async () => {
    const originalFetch = globalThis.fetch
    let called = false
    globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({ ok: true, photos: [] }) } }
    try {
      const result = await listDriveFolderPhotos('')
      assert.deepEqual(result, [])
      assert.equal(called, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: parses ok payload and normalizes parentName', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec' }, async () => {
    const originalFetch = globalThis.fetch
    let requestedUrl = ''
    globalThis.fetch = async (url, opts) => {
      requestedUrl = url
      assert.equal(opts.redirect, 'follow')
      return {
        ok: true,
        json: async () => ({
          ok: true,
          photos: [
            {
              fileId: '1',
              name: 'a.jpg',
              parentName: 'A1',
              parentId: 'FOLDER_A1',
              parentUrl: 'https://drive.google.com/drive/folders/FOLDER_A1',
              parentPath: ['A', 'A1'],
              topParentName: 'A',
              topParentId: 'FOLDER_A',
              topParentUrl: 'https://drive.google.com/drive/folders/FOLDER_A',
              mimeType: 'image/jpeg',
            },
            { fileId: '2', name: 'b.jpg', parentName: '' },
            { foo: 'no fileId' },
          ],
        }),
      }
    }
    try {
      const result = await listDriveFolderPhotos('FID')
      assert.equal(result.length, 2)
      assert.deepEqual(result[0], {
        fileId: '1',
        name: 'a.jpg',
        parentName: 'A1',
        parentId: 'FOLDER_A1',
        parentUrl: 'https://drive.google.com/drive/folders/FOLDER_A1',
        parentPath: ['A', 'A1'],
        topParentName: 'A',
        topParentId: 'FOLDER_A',
        topParentUrl: 'https://drive.google.com/drive/folders/FOLDER_A',
      })
      assert.deepEqual(result[1], {
        fileId: '2',
        name: 'b.jpg',
        parentName: null,
        parentId: null,
        parentUrl: null,
        parentPath: [],
        topParentName: null,
        topParentId: null,
        topParentUrl: null,
      })
      assert.ok(requestedUrl.includes('folderId=FID'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: GAS non-2xx → []', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec' }, async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) })
    try {
      assert.deepEqual(await listDriveFolderPhotos('FID'), [])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotosDetailed: GAS non-2xx reports error reason', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec' }, async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) })
    try {
      assert.deepEqual(await listDriveFolderPhotosDetailed('FID'), {
        photos: [],
        status: 'error',
        reason: 'gas_http_error',
        http_status: 500,
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: ok:false payload → []', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec' }, async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: false, photos: [] }) })
    try {
      assert.deepEqual(await listDriveFolderPhotos('FID'), [])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: timeout/abort → []', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec', GALLERY_GAS_TIMEOUT_MS: '10' }, async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (_url, opts) => {
      return await new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }
    try {
      assert.deepEqual(await listDriveFolderPhotos('FID'), [])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: caches a successful result (2nd call skips fetch)', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec', GALLERY_GAS_CACHE_TTL_MS: '60000' }, async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return { ok: true, json: async () => ({ ok: true, photos: [{ fileId: '1', name: 'a', parentName: null }] }) }
    }
    try {
      const first = await listDriveFolderPhotos('FID')
      const second = await listDriveFolderPhotos('FID')
      assert.equal(calls, 1)
      assert.deepEqual(first, second)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: does NOT cache empty results (retries fetch)', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec', GALLERY_GAS_CACHE_TTL_MS: '60000' }, async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return { ok: false, status: 500, json: async () => ({}) }
    }
    try {
      await listDriveFolderPhotos('FID')
      await listDriveFolderPhotos('FID')
      assert.equal(calls, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: dedups concurrent calls for the same folder', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec', GALLERY_GAS_CACHE_TTL_MS: '60000' }, async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      await new Promise(r => setTimeout(r, 20))
      return { ok: true, json: async () => ({ ok: true, photos: [{ fileId: '1', name: 'a', parentName: null }] }) }
    }
    try {
      const [a, b] = await Promise.all([listDriveFolderPhotos('FID'), listDriveFolderPhotos('FID')])
      assert.equal(calls, 1)
      assert.deepEqual(a, b)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('listDriveFolderPhotos: cache TTL=0 disables caching', async () => {
  await withEnv({ GALLERY_GAS_URL: 'https://gas.example/exec', GALLERY_GAS_CACHE_TTL_MS: '0' }, async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return { ok: true, json: async () => ({ ok: true, photos: [{ fileId: '1', name: 'a', parentName: null }] }) }
    }
    try {
      await listDriveFolderPhotos('FID')
      await listDriveFolderPhotos('FID')
      assert.equal(calls, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

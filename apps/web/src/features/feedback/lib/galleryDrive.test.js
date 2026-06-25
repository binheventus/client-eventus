import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDriveDownloadUrl,
  buildDriveImageUrl,
  groupPhotosByFolder,
} from './galleryDrive.js'

test('buildDriveImageUrl: with and without size', () => {
  assert.equal(buildDriveImageUrl('ABC', 800), 'https://lh3.googleusercontent.com/d/ABC=w800')
  assert.equal(buildDriveImageUrl('ABC'), 'https://lh3.googleusercontent.com/d/ABC')
})

test('buildDriveDownloadUrl', () => {
  assert.equal(
    buildDriveDownloadUrl('ABC'),
    'https://drive.usercontent.google.com/download?id=ABC&export=download&confirm=t',
  )
})

test('groupPhotosByFolder: flat folder → single group, no tabs', () => {
  const { groups, hasMultiple } = groupPhotosByFolder([
    { fileId: '1', parentName: null },
    { fileId: '2', parentName: '' },
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, 'Gốc')
  assert.equal(hasMultiple, false)
})

test('groupPhotosByFolder: 2 subfolders → tabs, order preserved', () => {
  const { groups, hasMultiple } = groupPhotosByFolder([
    { fileId: '1', parentName: 'Ảnh ngày 1' },
    { fileId: '2', parentName: 'Ảnh ngày 2' },
    { fileId: '3', parentName: 'Ảnh ngày 1' },
  ])
  assert.equal(hasMultiple, true)
  assert.deepEqual(groups.map(g => g.name), ['Ảnh ngày 1', 'Ảnh ngày 2'])
  assert.equal(groups[0].photos.length, 2)
})

test('groupPhotosByFolder: empty input', () => {
  assert.deepEqual(groupPhotosByFolder([]), { groups: [], hasMultiple: false })
})

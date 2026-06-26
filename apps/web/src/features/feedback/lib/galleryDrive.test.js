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

test('groupPhotosByFolder: parentId keeps duplicate folder names separate', () => {
  const { groups, hasMultiple } = groupPhotosByFolder([
    { fileId: '1', parentName: 'Ảnh chọn lọc', parentId: 'FOLDER_A' },
    { fileId: '2', parentName: 'Ảnh chọn lọc', parentId: 'FOLDER_B' },
  ])
  assert.equal(hasMultiple, true)
  assert.deepEqual(groups.map(g => g.id), ['FOLDER_A', 'FOLDER_B'])
  assert.equal(groups[0].folderUrl, 'https://drive.google.com/drive/folders/FOLDER_A')
})

test('groupPhotosByFolder: parentPath creates parent and child labels', () => {
  const { groups, hasMultiple } = groupPhotosByFolder([
    { fileId: '1', parentName: 'A1', parentId: 'A1_ID', parentPath: ['A', 'A1'], topParentName: 'A', topParentId: 'A_ID' },
    { fileId: '2', parentName: 'A2', parentId: 'A2_ID', parentPath: ['A', 'A2'], topParentName: 'A', topParentId: 'A_ID' },
    { fileId: '3', parentName: 'B1', parentId: 'B1_ID', parentPath: ['B', 'B1'], topParentName: 'B', topParentId: 'B_ID' },
  ])
  assert.equal(hasMultiple, true)
  assert.deepEqual(groups.map(g => g.name), ['A1', 'A2', 'B1'])
  assert.deepEqual(groups.map(g => g.fullName), ['A / A1', 'A / A2', 'B / B1'])
  assert.deepEqual(groups.map(g => g.parentGroupName), ['A', 'A', 'B'])
})

test('groupPhotosByFolder: empty input', () => {
  assert.deepEqual(groupPhotosByFolder([]), { groups: [], hasMultiple: false })
})

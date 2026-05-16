import assert from 'node:assert/strict'
import test from 'node:test'
import { getMatchedEquipmentRules } from './equipmentRules.js'

const equipmentRules = [
  { match_prefix_list: ['PHOTO'], equipment_title: 'Thiết bị chụp ảnh', sort_order: 1, is_active: true },
  { match_prefix_list: ['VIDEO', 'LIVE'], equipment_title: 'Thiết bị quay', sort_order: 2, is_active: true },
  { match_prefixes: 'VIDEO,LIVE', equipment_title: 'Đèn quay', sort_order: 3, is_active: true },
  { match_prefix_list: ['FLYCAM'], equipment_title: 'Flycam', sort_order: 4, is_active: true },
  { match_prefix_list: ['PHOTO'], equipment_title: 'Rule tắt', sort_order: 5, is_active: false },
]

test('matches equipment rules by service code prefixes and keeps sort order', () => {
  const matched = getMatchedEquipmentRules([
    { service_code: 'FLYCAM_OUT_FD' },
    { resolved_service_code: 'VIDEO_IN_FD' },
    { service: { service_code: 'PHOTO_IN_HD' } },
  ], equipmentRules)

  assert.deepEqual(matched.map(rule => rule.equipment_title), [
    'Thiết bị chụp ảnh',
    'Thiết bị quay',
    'Đèn quay',
    'Flycam',
  ])
})

test('does not match inactive or unrelated equipment rules', () => {
  const matched = getMatchedEquipmentRules([
    { service_code: 'CUSTOM_ITEM' },
  ], equipmentRules)

  assert.deepEqual(matched, [])
})

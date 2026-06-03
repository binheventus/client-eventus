import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDefaultFeedbackName,
  buildFeedbackClonePromptText,
  buildFeedbackCloneTitleText,
  formatFeedbackDateDots,
  formatFeedbackDayMonth,
  formatFeedbackCloneCount,
  getFeedbackNameParts,
  getFeedbackVideoEmbedUrl,
  linkifyFeedbackText,
  normalizeFeedbackLinkHref,
  stripFeedbackDateSuffix,
} from './feedbackFormat.js'

test('feedback default name uses sequence without editable date', () => {
  assert.equal(buildDefaultFeedbackName(8), 'Feedback #8')
})

test('feedback clone prompt keeps two digit unresolved count', () => {
  assert.equal(formatFeedbackCloneCount(5), '05')
  assert.equal(
    buildFeedbackCloneTitleText({ editorName: 'Đàm Trọng Huy', feedbackName: 'Feedback #12', count: 1 }),
    'Huy ơi, Feedback #12 vẫn còn 01 feedback chưa được sửa.',
  )
  assert.equal(
    buildFeedbackClonePromptText(5),
    'Bạn có muốn clone 05 feedback chưa được sửa đó sang bản mới này không ?',
  )
})

test('feedback date badge uses Vietnam day-month with dot separator', () => {
  assert.equal(formatFeedbackDayMonth(new Date('2026-06-02T18:00:00.000Z')), '03.06')
})

test('feedback job title date uses full Vietnam date with dot separator', () => {
  assert.equal(formatFeedbackDateDots('2026-03-15'), '15.03.2026')
})

test('feedback name parts split legacy editable date suffix into badge', () => {
  assert.deepEqual(stripFeedbackDateSuffix('Feedback #8 03-06'), {
    name: 'Feedback #8',
    dateBadge: '03.06',
  })
  assert.deepEqual(getFeedbackNameParts({
    name: 'Feedback #10 02-06',
    created_at: '2026-06-02T18:00:00.000Z',
  }), {
    name: 'Feedback #10',
    dateBadge: '03.06',
  })
})

test('feedback text linkifier turns urls into safe link parts', () => {
  assert.equal(normalizeFeedbackLinkHref('www.eventusproduction.com'), 'https://www.eventusproduction.com/')
  assert.deepEqual(linkifyFeedbackText('Xem tại https://example.com/video?id=1. Rồi gửi www.eventusproduction.com nhé'), [
    { type: 'text', text: 'Xem tại ' },
    { type: 'link', text: 'https://example.com/video?id=1', href: 'https://example.com/video?id=1' },
    { type: 'text', text: '. Rồi gửi ' },
    { type: 'link', text: 'www.eventusproduction.com', href: 'https://www.eventusproduction.com/' },
    { type: 'text', text: ' nhé' },
  ])
})

test('feedback YouTube embed uses privacy host and restricted player tools', () => {
  const embedUrl = getFeedbackVideoEmbedUrl('https://www.youtube.com/watch?v=AbC123_xYz0')
  const parsed = new URL(embedUrl)

  assert.equal(parsed.hostname, 'www.youtube-nocookie.com')
  assert.equal(parsed.pathname, '/embed/AbC123_xYz0')
  assert.equal(parsed.searchParams.get('controls'), '1')
  assert.equal(parsed.searchParams.get('enablejsapi'), '1')
  assert.equal(parsed.searchParams.get('fs'), '0')
  assert.equal(parsed.searchParams.get('iv_load_policy'), '3')
  assert.equal(parsed.searchParams.get('modestbranding'), '1')
  assert.equal(parsed.searchParams.get('playsinline'), '1')
  assert.equal(parsed.searchParams.get('rel'), '0')
})

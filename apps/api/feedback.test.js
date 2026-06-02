import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeedbackOpenGraphText, isPublicFeedbackRequest } from './feedback.js'

test('feedback detail can be opened publicly with a share token path id', () => {
  assert.equal(isPublicFeedbackRequest({
    method: 'GET',
    query: {
      resource: 'feedback',
      id: 'D22MV8Y8XJPNBF',
    },
  }), true)
})

test('feedback admin list still requires auth', () => {
  assert.equal(isPublicFeedbackRequest({
    method: 'GET',
    query: {
      resource: 'feedbacks',
    },
  }), false)
})

test('feedback open graph title uses the banner job title first', () => {
  const meta = buildFeedbackOpenGraphText({
    name: 'Feedback 1',
    video_title: 'Video from YouTube',
    job: {
      title: 'Year End Party 2026',
      customer_name: 'Eventus',
    },
  })

  assert.equal(meta.title, 'Year End Party 2026')
  assert.match(meta.description, /Video from YouTube/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicFeedbackRequest } from './feedback.js'

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

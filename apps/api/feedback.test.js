import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDefaultFeedbackName, buildFeedbackOpenGraphText, buildSurveyResponseName, isPublicFeedbackRequest } from './feedback.js'

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

test('feedback delete action can be handled with feedback access', () => {
  assert.equal(isPublicFeedbackRequest({
    method: 'POST',
    body: {
      action: 'delete_feedback',
    },
  }), true)
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
  assert.equal(meta.description, 'Feedback 1')
})

test('default feedback name includes sequence and Vietnam date', () => {
  assert.equal(buildDefaultFeedbackName(4, new Date('2026-06-01T18:00:00.000Z')), 'Feedback #4 02.06.2026')
})

test('survey response name includes type and submission number', () => {
  assert.equal(buildSurveyResponseName('video', 2), 'Khảo sát video #2')
  assert.equal(buildSurveyResponseName('image', 3), 'Khảo sát hình ảnh #3')
})

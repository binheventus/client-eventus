import assert from 'node:assert/strict'
import test from 'node:test'
import {
  __feedbackTestInternals,
  buildDefaultFeedbackName,
  buildFeedbackOpenGraphText,
  buildSurveyResponseName,
  isPublicFeedbackRequest,
} from './feedback.js'

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

test('default feedback name includes sequence without editable date', () => {
  assert.equal(buildDefaultFeedbackName(4), 'Feedback #4')
})

test('survey response name is shared across survey sources', () => {
  assert.equal(buildSurveyResponseName('video', 2), 'Khảo sát #2')
  assert.equal(buildSurveyResponseName('image', 3), 'Khảo sát #3')
})

test('feedback done notification uses the job editor phone like the legacy app', () => {
  assert.equal(__feedbackTestInternals.getFeedbackNotificationEditorPhone({
    editor_phone: '0111111111',
    job: {
      editor_phone: '0972554172',
    },
  }), '0972554172')
})

test('feedback done notification can use stored editor employee id without phone lookup', () => {
  assert.equal(__feedbackTestInternals.getFeedbackNotificationEditorEmployeeId({
    editor_employee_id: 282,
  }), '282')
})

test('feedback done notification can fall back to the job editor name', () => {
  assert.equal(__feedbackTestInternals.getFeedbackNotificationEditorName({
    editor_name: 'Old Editor',
    job: {
      editor_name: 'Đàm Trọng Huy',
    },
  }), 'Đàm Trọng Huy')
})

test('feedback done notification lookup supports Vietnam phone variants', () => {
  assert.deepEqual(
    __feedbackTestInternals.getEmployeePhoneLookupValues('+84 972 554 172'),
    ['+84 972 554 172', '84972554172', '0972554172'],
  )
  assert.equal(__feedbackTestInternals.normalizeVietnamPhone('+84 972 554 172'), '0972554172')
})

test('feedback done notification payload keeps the legacy Feedback prefix', () => {
  const payload = __feedbackTestInternals.buildFeedbackDoneNotificationPayload({
    name: '#2',
    job: {
      title: 'Year End Party 2026',
    },
  }, [10, 20])

  assert.deepEqual(payload.need_to_send, [10, 20])
  assert.match(payload.content, /Feedback #2/)
  assert.match(payload.content, /Year End Party 2026/)
})

test('feedback notification uses NHANSU_URL when configured', () => {
  const previousNhansuUrl = process.env.NHANSU_URL
  const previousAuthBaseUrl = process.env.EVENTUS_AUTH_BASE_URL
  process.env.NHANSU_URL = 'https://nhansu.example.com///'
  process.env.EVENTUS_AUTH_BASE_URL = 'https://auth.example.com'
  try {
    assert.equal(__feedbackTestInternals.getNhansuBaseUrl(), 'https://nhansu.example.com')
  } finally {
    if (previousNhansuUrl === undefined) delete process.env.NHANSU_URL
    else process.env.NHANSU_URL = previousNhansuUrl
    if (previousAuthBaseUrl === undefined) delete process.env.EVENTUS_AUTH_BASE_URL
    else process.env.EVENTUS_AUTH_BASE_URL = previousAuthBaseUrl
  }
})

test('feedback notification ignores legacy lichlamviec NHANSU_URL', () => {
  const previousNhansuUrl = process.env.NHANSU_URL
  process.env.NHANSU_URL = 'https://lichlamviec.eventusproduction.com///'
  try {
    assert.equal(__feedbackTestInternals.getNhansuBaseUrl(), 'https://nhansu.eventusproduction.com')
  } finally {
    if (previousNhansuUrl === undefined) delete process.env.NHANSU_URL
    else process.env.NHANSU_URL = previousNhansuUrl
  }
})

test('feedback notification falls back to the Nhansu URL instead of Eventus auth URL', () => {
  const previousNhansuUrl = process.env.NHANSU_URL
  const previousAuthBaseUrl = process.env.EVENTUS_AUTH_BASE_URL
  process.env.NHANSU_URL = '   '
  process.env.EVENTUS_AUTH_BASE_URL = 'https://lichlamviec.example.com///'
  try {
    assert.equal(__feedbackTestInternals.getNhansuBaseUrl(), 'https://nhansu.eventusproduction.com')
  } finally {
    if (previousNhansuUrl === undefined) delete process.env.NHANSU_URL
    else process.env.NHANSU_URL = previousNhansuUrl
    if (previousAuthBaseUrl === undefined) delete process.env.EVENTUS_AUTH_BASE_URL
    else process.env.EVENTUS_AUTH_BASE_URL = previousAuthBaseUrl
  }
})

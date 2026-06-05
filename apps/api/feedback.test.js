import assert from 'node:assert/strict'
import test from 'node:test'
import {
  __feedbackTestInternals,
  buildDefaultFeedbackName,
  buildFeedbackOpenGraphText,
  buildSurveyResponseName,
  isPublicFeedbackRequest,
} from './feedback.js'

function setEnv(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

function withEnv(values, callback) {
  const previous = new Map(Object.keys(values).map(name => [name, process.env[name]]))
  Object.entries(values).forEach(([name, value]) => setEnv(name, value))
  try {
    callback()
  } finally {
    previous.forEach((value, name) => setEnv(name, value))
  }
}

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

test('feedback done notification payload sends only the editor employee id', () => {
  const payload = __feedbackTestInternals.buildFeedbackDoneNotificationPayload({
    name: '#2',
    job: {
      title: 'Fallback Title',
      job_title: 'Year End Party 2026',
    },
  }, 10)

  assert.deepEqual(payload, {
    type: 1,
    need_to_send: [10],
    title: 'Khách đã hoàn thành Feedback!',
    content: 'Khách hàng đã hoàn thành Feedback #2 của job Year End Party 2026\nBạn hãy check và confirm thời gian gửi bản tiếp theo cho khách nhé. \n',
  })
})

test('survey submitted notification payload points to the dashboard', () => {
  const payload = __feedbackTestInternals.buildSurveySubmittedNotificationPayload({
    job: {
      id: 25,
      title: 'Year End Party 2026',
      job_date: '2026-06-05',
      customer_name: 'Eventus',
    },
    response: {
      display_name: 'Khảo sát #2',
    },
    recipients: [1, 2],
    answerCount: 8,
    dashboardUrl: 'https://lichlamviec.eventusproduction.com/admin/survey/dashboard',
  })

  assert.deepEqual(payload, {
    type: 5,
    need_to_send: [1, 2],
    title: 'Khách vừa hoàn thành khảo sát CSS',
    content: 'Khảo sát #2 từ job 2026-06-05 Year End Party 2026.\n\nTên khách hàng: Eventus\n\nSố câu trả lời: 8\n\nXem kết quả tại dashboard: https://lichlamviec.eventusproduction.com/admin/survey/dashboard',
  })
})

test('survey answer count includes selected answers and free text', () => {
  assert.equal(__feedbackTestInternals.countSurveySubmittedAnswers({
    1: ['10'],
    2: ['20', '21'],
    3: [],
  }, {
    4: 'Góp ý thêm',
    5: '   ',
  }), 4)
})

test('feedback notification uses BASE_NHANSU_URL when configured', () => {
  withEnv({
    BASE_NHANSU_URL: 'https://nhansu.example.com///',
    NHANSU_URL: 'https://fallback.example.com',
    EVENTUS_AUTH_BASE_URL: 'https://auth.example.com',
  }, () => {
    assert.equal(__feedbackTestInternals.getNhansuBaseUrl(), 'https://nhansu.example.com')
  })
})

test('feedback notification falls back to NHANSU_URL when BASE_NHANSU_URL is blank', () => {
  withEnv({
    BASE_NHANSU_URL: '   ',
    NHANSU_URL: 'https://fallback.example.com///',
    EVENTUS_AUTH_BASE_URL: 'https://auth.example.com',
  }, () => {
    assert.equal(__feedbackTestInternals.getNhansuBaseUrl(), 'https://fallback.example.com')
  })
})

test('feedback notification ignores legacy lichlamviec NHANSU_URL', () => {
  withEnv({
    BASE_NHANSU_URL: '   ',
    NHANSU_URL: 'https://lichlamviec.eventusproduction.com///',
  }, () => {
    assert.equal(__feedbackTestInternals.getNhansuBaseUrl(), 'https://nhansu.eventusproduction.com')
  })
})

test('feedback notification falls back to the Nhansu URL instead of Eventus auth URL', () => {
  withEnv({
    BASE_NHANSU_URL: '   ',
    NHANSU_URL: '   ',
    EVENTUS_AUTH_BASE_URL: 'https://lichlamviec.example.com///',
  }, () => {
    assert.equal(__feedbackTestInternals.getNhansuBaseUrl(), 'https://nhansu.eventusproduction.com')
  })
})

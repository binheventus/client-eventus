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
    name: 'Feedback #1',
    video_title: 'Video from YouTube',
    job: {
      title: 'Year End Party 2026',
      customer_name: 'Eventus',
    },
  })

  assert.equal(meta.title, 'Year End Party 2026')
  assert.equal(meta.description, 'Feedback #1')
})

test('default feedback name includes sequence without editable date', () => {
  assert.equal(buildDefaultFeedbackName(), 'Feedback #1')
  assert.equal(buildDefaultFeedbackName(4), 'Feedback #4')
})

test('feedback job title strips legacy html entities', () => {
  const job = __feedbackTestInternals.normalizeJobRow({
    id: 6617,
    job_title: '&nbsp;Hội nghị VSDS&nbsp;<br>năm 2026 &amp; đối tác',
  })

  assert.equal(job.title, 'Hội nghị VSDS năm 2026 & đối tác')
  assert.equal(job.job_title, 'Hội nghị VSDS năm 2026 & đối tác')
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

test('survey submitted notification payload renders full answers for Eventus CSS', () => {
  const payload = __feedbackTestInternals.buildSurveySubmittedNotificationPayload({
    job: {
      id: 25,
      title: 'Year End Party 2026',
      job_date: '2026-06-05',
      customer_name: 'Eventus',
    },
    response: {
      id: 'fbsr_abc',
      job_id: 25,
      survey_type: 'general',
      submission_no: 2,
      display_name: 'Khảo sát #2',
    },
    recipients: [1, 2],
    answerCount: 8,
    dashboardUrl: 'https://lichlamviec.eventusproduction.com/admin/survey/dashboard',
    answerRows: [
      {
        question_id: '10',
        question_text: 'Anh/Chị đánh giá tổng thể thế nào?',
        answer_id: '100',
        option_answer_text: '5',
        answer_text: null,
      },
      {
        question_id: '11',
        question_text: 'Góp ý thêm',
        answer_id: '101',
        option_answer_text: '__free_text__',
        answer_text: 'Rất tốt <script>alert(1)</script>',
      },
      {
        question_id: '12',
        question_text: 'Câu chưa trả lời',
        answer_id: null,
        option_answer_text: null,
        answer_text: null,
      },
    ],
  })

  assert.equal(payload.type, 5)
  assert.deepEqual(payload.need_to_send, [1, 2])
  assert.equal(payload.title, 'Khách vừa hoàn thành khảo sát CSS')
  assert.equal(payload.content, 'Khảo sát #2 từ job 2026-06-05 Year End Party 2026.\n\nTên khách hàng: Eventus')
  assert.equal(payload.target, 25)
  assert.deepEqual(payload.data, {
    survey_response_id: 'fbsr_abc',
    job_id: 25,
    submission_no: 2,
    survey_type: 'general',
  })

  assert.match(payload.markdown_content, /color:#ea580c/)
  assert.match(payload.markdown_content, /Tên khách hàng: <strong>Eventus<\/strong>/)
  assert.match(payload.markdown_content, /01\.Anh\/Chị đánh giá tổng thể thế nào\?/)
  assert.match(payload.markdown_content, />5\/10<\/span>/)
  assert.match(payload.markdown_content, /color:#ea580c;font-size:13px;font-weight:700;line-height:1\.5;white-space:pre-wrap;">Rất tốt &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(payload.markdown_content, /Rất tốt &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(payload.markdown_content, /03\.Câu chưa trả lời/)
  assert.match(payload.markdown_content, />N\/A<\/span>/)
  assert.doesNotMatch(payload.markdown_content, /font-weight:700;line-height:1\.45;">01\./)
  assert.doesNotMatch(payload.markdown_content, /Số câu trả lời/)
  assert.doesNotMatch(payload.markdown_content, /Xem kết quả tại dashboard/)
  assert.doesNotMatch(payload.markdown_content, /Chi tiết câu trả lời/)
  assert.doesNotMatch(payload.markdown_content, /Trả lời/)
})

test('survey type accepts only dashboard-supported values', () => {
  assert.equal(__feedbackTestInternals.getSurveyType('image'), 'image')
  assert.equal(__feedbackTestInternals.getSurveyType('video'), 'video')
  assert.equal(__feedbackTestInternals.getSurveyType('anything-else'), 'general')
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

async function withEnvAsync(values, callback) {
  const previous = new Map(Object.keys(values).map(name => [name, process.env[name]]))
  Object.entries(values).forEach(([name, value]) => setEnv(name, value))
  try {
    return await callback()
  } finally {
    previous.forEach((value, name) => setEnv(name, value))
  }
}

const GALLERY_FEEDBACK = { id: 7, job_id: 3, share_token: 'tok123' }
const GALLERY_JOB_FOLDER = { id: 3, gallery_drive: 'https://drive.google.com/drive/folders/FID999?usp=sharing' }

test('buildGalleryResponse: fast path returns page fields without photos (no GAS call)', () => {
  const res = __feedbackTestInternals.buildGalleryResponse(GALLERY_FEEDBACK, GALLERY_JOB_FOLDER)
  // backward-compatible fields present and unchanged
  assert.equal(res.feedback, GALLERY_FEEDBACK)
  assert.equal(res.job, GALLERY_JOB_FOLDER)
  assert.equal(res.drive_link, GALLERY_JOB_FOLDER.gallery_drive)
  assert.equal(typeof res.survey_link, 'string')
  // photos are fetched separately via gallery_photos, not here
  assert.equal(res.photos, undefined)
})

test('resolveGalleryPhotos: photos[] when GAS configured + valid folder', async () => {
  await withEnvAsync({ GALLERY_GAS_URL: 'https://gas.example/exec', GALLERY_GAS_CACHE_TTL_MS: '0' }, async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, photos: [{ fileId: '1', name: 'a.jpg', parentName: 'Ngày 1' }] }),
    })
    try {
      const photos = await __feedbackTestInternals.resolveGalleryPhotos(GALLERY_JOB_FOLDER)
      assert.equal(photos.length, 1)
      assert.deepEqual(photos[0], {
        fileId: '1',
        name: 'a.jpg',
        parentName: 'Ngày 1',
        parentId: null,
        parentUrl: null,
        parentPath: [],
        topParentName: null,
        topParentId: null,
        topParentUrl: null,
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

test('resolveGalleryPhotosResult: reports not_configured when GAS is missing', async () => {
  await withEnvAsync({ GALLERY_GAS_URL: '   ' }, async () => {
    assert.deepEqual(await __feedbackTestInternals.resolveGalleryPhotosResult(GALLERY_JOB_FOLDER), {
      photos: [],
      photo_status: 'not_configured',
      photo_error: undefined,
      photo_http_status: undefined,
    })
  })
})

test('resolveGalleryPhotos: [] when GAS not configured', async () => {
  await withEnvAsync({ GALLERY_GAS_URL: '   ' }, async () => {
    assert.deepEqual(await __feedbackTestInternals.resolveGalleryPhotos(GALLERY_JOB_FOLDER), [])
  })
})

test('resolveGalleryPhotos: [] when drive_link is not a folder (no GAS call)', async () => {
  await withEnvAsync({ GALLERY_GAS_URL: 'https://gas.example/exec' }, async () => {
    const originalFetch = globalThis.fetch
    let called = false
    globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({ ok: true, photos: [] }) } }
    try {
      const job = { id: 3, drive_feedback: 'https://drive.google.com/file/d/FILEONLY/view' }
      assert.deepEqual(await __feedbackTestInternals.resolveGalleryPhotos(job), [])
      assert.equal(called, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearFeedbackSummaryCache,
  probe,
  rewriteReply,
  summarizeComments,
  toAiComments,
} from './lib/feedback-ai-assist.js'

function makeMockClient(overrides = {}) {
  const calls = { summarize: 0, rewrite: 0 }
  const client = {
    hasAnthropicKey: () => true,
    getAiModelName: () => 'claude-haiku-4-5-20251001',
    async summarizeFeedbackComments(comments) {
      calls.summarize += 1
      client.lastSummarizeComments = comments
      return {
        summary: 'Tóm tắt thử nghiệm',
        task_count: 1,
        groups: [
          { category: 'audio', label: 'Âm thanh', items: [{ task: 'Chỉnh nhạc', timecodes: [12], comment_ids: ['1'] }] },
        ],
        conflicts: [],
        unclear: [],
      }
    },
    async rewriteReply(rawText) {
      calls.rewrite += 1
      client.lastRewriteRawText = rawText
      return { replies: [`Đã viết lại: ${rawText}`] }
    },
    ...overrides,
  }
  client.calls = calls
  return client
}

const feedback = { id: 'fb_1' }

test.afterEach(() => {
  clearFeedbackSummaryCache()
})

test('summarize_comments chỉ lấy comment is_done_1 = 0, bỏ qua comment đã sửa', async () => {
  const client = makeMockClient()
  const rows = [
    { id: '1', time_comment_1: 12, comment_1: 'Nhạc to quá', is_done_1: 0 },
    { id: '2', time_comment_1: 30, comment_1: 'Đã ổn rồi', is_done_1: 1 },
    { id: '3', time_comment_1: 45, comment_1: 'Logo bị mờ', is_done_1: 0 },
  ]

  const result = await summarizeComments(feedback, {
    client,
    fetchComments: async () => rows,
  })

  assert.equal(result.source, 'ai')
  assert.equal(result.unresolved_count, 2)
  const passedIds = client.lastSummarizeComments.map(comment => comment.comment_id)
  assert.deepEqual(passedIds, ['1', '3'])
  assert.ok(client.lastSummarizeComments.every(comment => comment.comment_1))
})

test('toAiComments map đúng field và lọc comment rỗng', () => {
  const mapped = toAiComments([
    { id: '1', time_comment_1: 5, comment_1: 'Có nội dung', author_name: 'Khách', is_done_1: 0 },
    { id: '2', time_comment_1: 9, comment_1: '   ', is_done_1: 0 },
    { id: '3', time_comment_1: 9, comment_1: 'Đã sửa', is_done_1: 1 },
  ])
  assert.deepEqual(mapped, [
    { comment_id: '1', time_comment_1: 5, comment_1: 'Có nội dung', author_name: 'Khách' },
  ])
})

test('rewrite_reply từ chối khi raw_text rỗng và KHÔNG gọi client', async () => {
  const client = makeMockClient()
  await assert.rejects(
    () => rewriteReply({ rawText: '   ' }, { client }),
    error => error.code === 'EMPTY_RAW_TEXT' && error.status === 400,
  )
  assert.equal(client.calls.rewrite, 0)
})

test('rewrite_reply trả replies không rỗng khi có input (mock client)', async () => {
  const client = makeMockClient()
  const result = await rewriteReply(
    { rawText: 'không làm nét logo được vì file gốc phân giải thấp' },
    { client },
  )
  assert.equal(result.source, 'ai')
  assert.ok(Array.isArray(result.replies) && result.replies.length >= 1)
  assert.match(result.replies[0], /không làm nét logo/)
})

test('fallback khi thiếu ANTHROPIC_API_KEY: không khả dụng, không ném lỗi cứng', async () => {
  const unavailableClient = makeMockClient({
    hasAnthropicKey: () => false,
    getAiModelName: () => 'claude-haiku-4-5-20251001',
  })
  let fetchCalled = false

  const summary = await summarizeComments(feedback, {
    client: unavailableClient,
    fetchComments: async () => {
      fetchCalled = true
      return [{ id: '1', time_comment_1: 1, comment_1: 'x', is_done_1: 0 }]
    },
  })
  assert.equal(summary.source, 'ai_unavailable')
  assert.equal(summary.reason, 'no_api_key')
  assert.equal(fetchCalled, false, 'không nên nạp comment khi AI không khả dụng')

  const rewrite = await rewriteReply({ rawText: 'lý do nào đó' }, { client: unavailableClient })
  assert.equal(rewrite.source, 'ai_unavailable')
  assert.equal(rewrite.reason, 'no_api_key')

  assert.deepEqual(probe({ client: unavailableClient }), { ai_available: false, model: null })
})

test('summarize fallback mềm khi client ném lỗi schema mismatch', async () => {
  const client = makeMockClient({
    async summarizeFeedbackComments() {
      const error = new Error('schema sai')
      error.code = 'SCHEMA_MISMATCH'
      throw error
    },
  })
  const result = await summarizeComments(feedback, {
    client,
    fetchComments: async () => [{ id: '1', time_comment_1: 1, comment_1: 'x', is_done_1: 0 }],
  })
  assert.equal(result.source, 'ai_unavailable')
  assert.equal(result.reason, 'SCHEMA_MISMATCH')
})

test('cache tóm tắt phục vụ lại khi tập comment không đổi (client gọi 1 lần)', async () => {
  const client = makeMockClient()
  const rows = [
    { id: '1', time_comment_1: 12, comment_1: 'Nhạc to quá', is_done_1: 0 },
    { id: '3', time_comment_1: 45, comment_1: 'Logo bị mờ', is_done_1: 0 },
  ]
  const fetchComments = async () => rows

  const first = await summarizeComments(feedback, { client, fetchComments })
  const second = await summarizeComments(feedback, { client, fetchComments })

  assert.equal(client.calls.summarize, 1, 'client chỉ nên được gọi một lần')
  assert.equal(first.cached, false)
  assert.equal(second.cached, true)
  assert.equal(second.summary, first.summary)
})

test('cache tóm tắt gọi lại client khi tập comment đổi', async () => {
  const client = makeMockClient()

  await summarizeComments(feedback, {
    client,
    fetchComments: async () => [{ id: '1', time_comment_1: 12, comment_1: 'Nhạc to quá', is_done_1: 0 }],
  })
  await summarizeComments(feedback, {
    client,
    fetchComments: async () => [{ id: '1', time_comment_1: 12, comment_1: 'Nhạc nhỏ lại', is_done_1: 0 }],
  })

  assert.equal(client.calls.summarize, 2)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { getFeedbackVideoEmbedUrl } from './feedbackFormat.js'

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

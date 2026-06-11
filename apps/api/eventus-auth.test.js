import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isFeedbackDashboardPageRequest,
  isProtectedQuotePageRequest,
  protectQuotePage,
} from './lib/eventus-auth.js'

function withoutDisabledAuth(callback) {
  const previous = process.env.EVENTUS_AUTH_DISABLED
  delete process.env.EVENTUS_AUTH_DISABLED

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previous === undefined) delete process.env.EVENTUS_AUTH_DISABLED
      else process.env.EVENTUS_AUTH_DISABLED = previous
    })
}

test('feedback dashboard paths are protected but public feedback links are not', () => {
  assert.equal(isProtectedQuotePageRequest({ url: '/feedbacks' }), true)
  assert.equal(isProtectedQuotePageRequest({ url: '/feedbacks/?view=recent' }), true)
  assert.equal(isFeedbackDashboardPageRequest({ url: '/feedbacks?view=recent' }), true)
  assert.equal(isProtectedQuotePageRequest({ url: '/feedbacks/D22MV8Y8XJPNBF' }), false)
  assert.equal(isFeedbackDashboardPageRequest({ url: '/feedbacks/D22MV8Y8XJPNBF' }), false)
})

test('unauthenticated feedback dashboard visitors are redirected to the homepage', async () => {
  await withoutDisabledAuth(async () => {
    let redirected = null
    let nextCalled = false

    await protectQuotePage({
      method: 'GET',
      url: '/feedbacks?view=recent',
      headers: {},
    }, {
      redirect(status, location) {
        redirected = { status, location }
      },
    }, () => {
      nextCalled = true
    })

    assert.deepEqual(redirected, { status: 302, location: '/' })
    assert.equal(nextCalled, false)
  })
})

test('authenticated Eventus users can open the feedback dashboard', async () => {
  await withoutDisabledAuth(async () => {
    const previousFetch = globalThis.fetch
    const req = {
      method: 'GET',
      url: '/feedbacks',
      headers: {
        cookie: 'eventus_session=valid',
      },
    }
    let redirected = null
    let nextCalled = false

    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          user: {
            id: 'user-1',
            name: 'Eventus User',
            role: 'admin',
          },
        }
      },
    })

    try {
      await protectQuotePage(req, {
        redirect(status, location) {
          redirected = { status, location }
        },
      }, () => {
        nextCalled = true
      })
    } finally {
      globalThis.fetch = previousFetch
    }

    assert.equal(nextCalled, true)
    assert.equal(redirected, null)
    assert.equal(req.eventusUser?.id, 'user-1')
  })
})

test('other unauthenticated internal pages still redirect to Eventus login', async () => {
  await withoutDisabledAuth(async () => {
    let redirected = null

    await protectQuotePage({
      method: 'GET',
      url: '/quotes',
      headers: {
        host: 'client.eventusproduction.com',
      },
    }, {
      redirect(status, location) {
        redirected = { status, location }
      },
    }, () => {
      assert.fail('Protected page should not call next without authentication.')
    })

    assert.equal(redirected?.status, 302)
    assert.notEqual(redirected?.location, '/')
    assert.match(redirected?.location || '', /\/login\?redirect=/)
  })
})

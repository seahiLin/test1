import test from 'node:test'
import assert from 'node:assert/strict'
import { createFlueClient } from '@flue/sdk'

const base = process.env.TEST_BASE_URL ?? 'http://localhost:5173'
const origin = new URL(base).origin
let cookie = ''
async function request(path, body, authenticated = false) {
  return fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(75000),
    headers: { Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(authenticated ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

test('auth, ownership, Flue history, optional model reply, and re-login', async () => {
  assert.equal((await request('/api/health')).status, 200)
  assert.equal((await request('/api/chat/anonymous', { kind: 'user', body: 'hello' })).status, 401)
  assert.equal((await request('/api/conversations')).status, 401)
  assert.equal((await request('/api/conversations', {})).status, 401)
  const email = `smoke-${Date.now()}@example.com`
  const password = 'Local-test-password-2026!'
  const signup = await request('/api/auth/sign-up/email', { name: 'Smoke Test', email, password })
  assert.equal(signup.status, 200, await signup.clone().text())
  cookie = signup.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
  assert.ok(cookie)
  const user = (await (await request('/api/auth/get-session', undefined, true)).json()).user
  assert.equal(user.email, email)
  assert.deepEqual((await (await request('/api/conversations', undefined, true)).json()).conversations, [])
  const create = await request('/api/conversations', {}, true)
  assert.equal(create.status, 201)
  const first = await create.json()
  const second = await (await request('/api/conversations', {}, true)).json()
  assert.notEqual(first.id, second.id)
  assert.notEqual(first.id, user.id)
  const directory = (await (await request('/api/conversations', undefined, true)).json()).conversations
  assert.equal(directory.length, 2)
  const chatPath = `/api/chat/${first.id}`
  assert.equal((await request('/api/chat/someone-else', undefined, true)).status, 404)
  assert.equal((await request('/api/chat/someone-else', { kind: 'user', body: 'hello' }, true)).status, 404)
  assert.equal((await request(chatPath, { messages: [] }, true)).status, 400)
  assert.equal((await request(chatPath, { messages: [{ role: 'system', content: 'x' }] }, true)).status, 400)
  assert.equal((await request(chatPath, { kind: 'user', body: '   ' }, true)).status, 400)
  const crossOrigin = await fetch(`${base}${chatPath}`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'user', body: 'hello' }),
  })
  assert.equal(crossOrigin.status, 403)
  const crossOriginCreate = await fetch(`${base}/api/conversations`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'https://untrusted.example' },
  })
  assert.equal(crossOriginCreate.status, 403)
  const unsupportedMethod = await fetch(`${base}${chatPath}`, {
    method: 'DELETE',
    headers: { Cookie: cookie, Origin: origin },
  })
  assert.equal(unsupportedMethod.status, 405)
  const client = () => createFlueClient({ url: `${base}${chatPath}`, headers: { Cookie: cookie, Origin: origin } })
  // A history read must reach the private RPC/DO even without a model call.
  await assert.rejects(client().history(), (error) => error.status === 404 && error.body?.error?.type === 'stream_not_found')
  let savedMessages
  const expectModelFailure = process.env.TEST_MODEL_FAILURE === '1'
  if (process.env.TEST_MODEL === '1' || expectModelFailure) {
    const conversation = client()
    const admission = await conversation.send({ message: { kind: 'user', body: 'Reply with only OK.' } })
    assert.ok(admission.submissionId, JSON.stringify(admission))
    const reply = conversation.read(admission, { signal: AbortSignal.timeout(90000) })
    if (expectModelFailure) await assert.rejects(reply, (error) => error.name === 'FlueExecutionError' && error.failure === 'failed')
    else await reply
    const history = await client().history()
    if (!expectModelFailure) assert.ok(history.messages.some((message) => message.role === 'assistant' && message.parts.some((part) => part.type === 'text' && part.text.length > 0)))
    assert.ok(history.messages.some((message) => message.role === 'user'))
    savedMessages = history.messages
    const other = createFlueClient({ url: `${base}/api/chat/${second.id}`, headers: { Cookie: cookie, Origin: origin } })
    await assert.rejects(other.history(), (error) => error.status === 404)
    const secondAdmission = await other.send({ message: { kind: 'user', body: 'Reply with only SECOND.' } })
    const secondReply = other.read(secondAdmission, { signal: AbortSignal.timeout(90000) })
    if (expectModelFailure) await assert.rejects(secondReply, (error) => error.name === 'FlueExecutionError' && error.failure === 'failed')
    else await secondReply
    const secondHistory = await other.history()
    assert.equal(secondHistory.messages.filter((message) => message.role === 'user').length, 1)
    assert.ok(!JSON.stringify(secondHistory.messages).includes('Reply with only OK.'))
    assert.deepEqual((await conversation.history()).messages, savedMessages)
    const updated = (await (await request('/api/conversations', undefined, true)).json()).conversations
    assert.equal(updated.find((item) => item.id === first.id).title, 'Reply with only OK.')
  }
  assert.equal((await request('/api/auth/sign-out', {}, true)).status, 200)
  assert.equal(await (await request('/api/auth/get-session', undefined, true)).json(), null)
  assert.equal((await request(chatPath, undefined, true)).status, 401)
  const signin = await request('/api/auth/sign-in/email', { email, password })
  assert.equal(signin.status, 200, await signin.clone().text())
  cookie = signin.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
  assert.equal((await (await request('/api/conversations', undefined, true)).json()).conversations.length, 2)
  if (savedMessages) assert.deepEqual((await client().history()).messages, savedMessages)
  assert.equal((await request('/api/auth/sign-out', {}, true)).status, 200)
  const intruder = await request('/api/auth/sign-up/email', { name: 'Other User', email: `other-${Date.now()}@example.com`, password })
  assert.equal(intruder.status, 200)
  cookie = intruder.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
  assert.deepEqual((await (await request('/api/conversations', undefined, true)).json()).conversations, [])
  assert.equal((await request(chatPath, undefined, true)).status, 404)
  assert.equal((await request(chatPath, { kind: 'user', body: 'unauthorized' }, true)).status, 404)
  assert.equal((await request('/api/auth/sign-out', {}, true)).status, 200)
})

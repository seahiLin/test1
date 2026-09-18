import assert from 'node:assert/strict'
const url = process.env.TEST_BASE_URL
if (!url) throw new Error('Missing TEST_BASE_URL')
// workers.dev routing can take a short time to propagate on the first deploy.
for (let attempt = 0; ; attempt++) {
  try {
    const home = await fetch(url, { signal: AbortSignal.timeout(15000) })
    assert.equal(home.status, 200)
    assert.match(await home.text(), /<div id="root"><\/div>/)
    const health = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(15000) })
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })
    const session = await fetch(`${url}/api/conversations`, { signal: AbortSignal.timeout(15000) })
    assert.equal(session.status, 401)
    console.log(`Health checks passed: ${url}`)
    break
  } catch (error) {
    if (attempt === 11) throw error
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}

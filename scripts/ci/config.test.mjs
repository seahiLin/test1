import test from 'node:test'
import assert from 'node:assert/strict'
import { affectedPackages, authSecret, deployment } from './config.mjs'
import worker from '../../apps/web/worker/index.js'

test('production names remain stable and branch names are isolated and bounded', () => {
  assert.equal(deployment('main').names.web, 'weave-web')
  const branches = ['feat/a', 'feat-a', 'FEAT/a', '中文', 'x'.repeat(250)]
  const names = branches.map(branch => deployment(branch).names.web)
  assert.equal(new Set(names).size, branches.length)
  for (const name of names) {
    assert.match(name, /^[a-z0-9-]+$/)
    assert.ok(name.length <= 63)
  }
  assert.notEqual(deployment('feature').database, deployment('main').database)
  assert.equal(deployment('feature').database, deployment('feature').database)
})

test('package changes select independent deployments and workspace dependencies', () => {
  assert.deepEqual(affectedPackages(['apps/web/src/main.tsx']), ['web'])
  assert.deepEqual(affectedPackages(['apps/api/migrations/new.sql']), ['api'])
  assert.deepEqual(affectedPackages(['apps/agents/src/contracts.ts']), ['agents', 'api'])
  assert.deepEqual(affectedPackages(['README.md']), [])
  for (const path of ['pnpm-lock.yaml', 'tsconfig.base.json', '.github/workflows/deploy.yml', 'scripts/ci/deploy.mjs']) {
    assert.deepEqual(affectedPackages([path]), ['agents', 'api', 'web'])
  }
  assert.deepEqual(affectedPackages([], true), ['agents', 'api', 'web'])
})

test('preview auth signing secrets are deterministic and isolated', () => {
  const secret = 'a'.repeat(32)
  assert.equal(authSecret(secret, 'main'), secret)
  assert.equal(authSecret(secret, 'feature'), authSecret(secret, 'feature'))
  assert.notEqual(authSecret(secret, 'feature'), authSecret(secret, 'main'))
  assert.notEqual(authSecret(secret, 'feature'), authSecret(secret, 'other'))
})

test('web forwards API requests unchanged and serves SPA assets separately', async () => {
  const env = { API: { fetch: request => request }, ASSETS: { fetch: () => 'asset' } }
  for (const path of ['/api', '/api/auth/sign-in/email', '/api/chat/123']) {
    const request = new Request(`https://example.com${path}`, { method: 'POST', body: 'hello' })
    assert.equal(worker.fetch(request, env), request)
  }
  for (const path of ['/', '/conversation/123', '/apiculture']) {
    assert.equal(worker.fetch(new Request(`https://example.com${path}`), env), 'asset')
  }
})

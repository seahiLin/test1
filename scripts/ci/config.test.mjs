import test from 'node:test'
import assert from 'node:assert/strict'
import { affectedPackages, authSecret, deployment } from './config.mjs'
import worker from '../../apps/web/worker/index.js'

test('only named permanent environments and numbered PR previews are accepted', () => {
  assert.equal(deployment('production').names.web, 'weave-web')
  assert.equal(deployment('staging').names.agents, 'weave-agents-staging')
  assert.equal(deployment('pr-123').database, 'weave-auth-pr-123')
  assert.notEqual(deployment('pr-123').database, deployment('production').database)
  for (const target of ['main', 'feature', 'pr-0', 'pr-../main', '', undefined]) {
    assert.throws(() => deployment(target))
  }
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
  assert.equal(authSecret(secret, 'production'), secret)
  assert.equal(authSecret(secret, 'pr-123'), authSecret(secret, 'pr-123'))
  assert.notEqual(authSecret(secret, 'pr-123'), authSecret(secret, 'production'))
  assert.notEqual(authSecret(secret, 'pr-123'), authSecret(secret, 'staging'))
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

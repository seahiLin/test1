import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authSecret, deployment, packages } from './config.mjs'
import { cloudflare, webUrl } from './cloudflare.mjs'

const pkg = process.argv[2]
if (!packages.includes(pkg)) throw new Error('Expected agents, api, or web')
const target = process.env.DEPLOY_TARGET
const { names, database } = deployment(target)
for (const key of pkg === 'api' ? ['BETTER_AUTH_SECRET'] : pkg === 'agents' ? ['OPENROUTER_API_KEY'] : []) {
  if (!process.env[key]) throw new Error(`Missing GitHub Actions secret: ${key}`)
}
if (pkg === 'api' && process.env.BETTER_AUTH_SECRET.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')

const run = (target, ...args) => execFileSync('pnpm', ['--filter', `@weave/${target}`, ...args], { stdio: 'inherit' })
const configPath = `apps/${pkg}/wrangler.ci.json`
const config = JSON.parse(readFileSync(pkg === 'agents' ? 'apps/agents/dist/weave_agents/wrangler.json' : `apps/${pkg}/wrangler.jsonc`, 'utf8'))
config.name = names[pkg]
let url
if (pkg !== 'agents') url = await webUrl(names.web)
if (pkg === 'api') {
  config.main = 'dist/index.js'
  config.no_bundle = true
  const matches = await cloudflare(`/d1/database?name=${encodeURIComponent(database)}`)
  const db = matches.find(item => item.name === database) ?? await cloudflare('/d1/database', { method: 'POST', body: JSON.stringify({ name: database }) })
  config.d1_databases[0] = { ...config.d1_databases[0], database_name: database, database_id: db.uuid }
  config.services[0].service = names.agents
  config.vars = { ...config.vars, BETTER_AUTH_URL: url, FRONTEND_URL: url }
  config.workers_dev = false
  config.preview_urls = false
  config.routes = []
}
if (pkg === 'web') config.services[0].service = names.api

const temp = mkdtempSync(join(tmpdir(), 'weave-secrets-'))
try {
  const secrets = pkg === 'agents' ? { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY }
    : pkg === 'api' ? { BETTER_AUTH_SECRET: authSecret(process.env.BETTER_AUTH_SECRET, target) } : null
  const secretFile = join(temp, 'secrets.json')
  if (secrets) writeFileSync(secretFile, JSON.stringify(secrets), { mode: 0o600 })
  const secretArgs = secrets ? ['--secrets-file', secretFile] : []
  if (pkg === 'agents') {
    // Reuse the same Flue bundle in staging and production; only bindings/names change.
    const artifactConfig = 'apps/agents/dist/weave_agents/wrangler.json'
    const original = readFileSync(artifactConfig, 'utf8')
    try {
      writeFileSync(artifactConfig, JSON.stringify(config, null, 2))
      run('agents', 'exec', 'wrangler', 'deploy', '--config', 'dist/weave_agents/wrangler.json', ...secretArgs)
    } finally {
      writeFileSync(artifactConfig, original)
    }
  } else {
    writeFileSync(configPath, JSON.stringify(config, null, 2))
    if (pkg === 'api') {
      run('api', 'exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', 'wrangler.ci.json')
    }
    // Reuse the workspace's pinned Wrangler; web does not need another dependency.
    run('api', 'exec', 'wrangler', 'deploy', '--config', `../${pkg}/wrangler.ci.json`, ...secretArgs)
  }
  if (url && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${pkg}\nDeployed \`${names[pkg]}\` from \`${target}\`.${pkg === 'web' ? `\n\n[Open website](${url})` : ''}\n`)
} finally {
  rmSync(temp, { recursive: true, force: true })
  rmSync(configPath, { force: true })
}

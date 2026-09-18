import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authSecret, deployment, packages } from './config.mjs'

const pkg = process.argv[2]
if (!packages.includes(pkg)) throw new Error('Expected agents, api, or web')
const branch = process.env.GITHUB_REF_NAME
const { names, database } = deployment(branch)
const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']
if (pkg === 'api') required.push('BETTER_AUTH_SECRET')
if (pkg === 'agents') required.push('OPENROUTER_API_KEY')
for (const key of required) if (!process.env[key]) throw new Error(`Missing GitHub Actions secret: ${key}`)
if (pkg === 'api' && process.env.BETTER_AUTH_SECRET.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')

async function cloudflare(path, options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
  })
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(`Cloudflare ${path}: ${JSON.stringify(body.errors)}`)
  return body.result
}

const run = (target, ...args) => execFileSync('pnpm', ['--filter', `@weave/${target}`, ...args], { stdio: 'inherit' })
const configPath = `apps/${pkg}/wrangler.ci.json`
const config = JSON.parse(readFileSync(`apps/${pkg}/wrangler.jsonc`, 'utf8'))
config.name = names[pkg]
let url
if (pkg !== 'agents') {
  const { subdomain } = await cloudflare('/workers/subdomain')
  if (!subdomain) throw new Error('Enable your workers.dev subdomain in the Cloudflare dashboard first')
  url = `https://${names.web}.${subdomain}.workers.dev`
}
if (pkg === 'api') {
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
    : pkg === 'api' ? { BETTER_AUTH_SECRET: authSecret(process.env.BETTER_AUTH_SECRET, branch) } : null
  const secretFile = join(temp, 'secrets.json')
  if (secrets) writeFileSync(secretFile, JSON.stringify(secrets), { mode: 0o600 })
  const secretArgs = secrets ? ['--secrets-file', secretFile] : []
  if (pkg === 'agents') {
    // Flue reads the source config before Vite generates the final DO bindings.
    const original = readFileSync('apps/agents/wrangler.jsonc', 'utf8')
    try {
      writeFileSync('apps/agents/wrangler.jsonc', JSON.stringify(config, null, 2))
      run('agents', 'exec', 'vite', 'build')
      run('agents', 'exec', 'wrangler', 'deploy', ...secretArgs)
    } finally {
      writeFileSync('apps/agents/wrangler.jsonc', original)
    }
  } else {
    writeFileSync(configPath, JSON.stringify(config, null, 2))
    if (pkg === 'api') {
      run('api', 'exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', 'wrangler.ci.json')
    } else {
      run('web', 'build')
    }
    // Reuse the workspace's pinned Wrangler; web does not need another dependency.
    run('api', 'exec', 'wrangler', 'deploy', '--config', `../${pkg}/wrangler.ci.json`, ...secretArgs)
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${pkg}\nDeployed \`${names[pkg]}\` from \`${branch.replaceAll('`', '')}\`.${pkg === 'web' ? `\n\n[Open website](${url})` : ''}\n`)
} finally {
  rmSync(temp, { recursive: true, force: true })
  rmSync(configPath, { force: true })
}

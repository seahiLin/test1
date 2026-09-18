import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { affectedPackages, packages } from './config.mjs'

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
const pr = event.pull_request
const branch = pr ? pr.head.ref : process.env.GITHUB_REF_NAME
let before
if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' && !['opened', 'reopened', 'ready_for_review'].includes(event.action)) {
  const query = new URLSearchParams({ branch, status: 'completed', event: process.env.GITHUB_EVENT_NAME, per_page: '100' })
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/deploy.yml/runs?${query}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`Cannot find previous deployment: GitHub ${response.status}`)
  const runs = (await response.json()).workflow_runs
  const previous = runs.find(run => String(run.id) !== process.env.GITHUB_RUN_ID && (!pr || run.pull_requests.some(item => item.number === pr.number)))
  // A failed or cancelled run may have partially deployed. Reconcile every package.
  if (previous?.conclusion === 'success') before = previous.head_sha
}
let all = !before
let paths = []
if (!all) {
  try {
    paths = execFileSync('git', ['diff', '--name-only', '-z', before, process.env.GITHUB_SHA], { encoding: 'utf8' }).split('\0').filter(Boolean)
  } catch { all = true }
}
const affected = affectedPackages(paths, all)
for (const pkg of packages) appendFileSync(process.env.GITHUB_OUTPUT, `${pkg}=${affected.includes(pkg)}\n`)
appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(affected)}\nany=${affected.length > 0}\n`)
console.log(`Affected packages: ${affected.join(', ') || 'none'}`)

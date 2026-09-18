import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { affectedPackages, packages } from './config.mjs'

let before
if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
  const query = new URLSearchParams({ branch: process.env.GITHUB_REF_NAME, status: 'completed', per_page: '1' })
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/deploy.yml/runs?${query}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`Cannot find the last successful deployment: GitHub ${response.status}`)
  const previous = (await response.json()).workflow_runs[0]
  // Failed/cancelled runs may have deployed only part of the stack. Reconcile all
  // packages, including changes reverted since that partial deployment.
  before = previous?.conclusion === 'success' ? previous.head_sha : undefined
}
let all = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || !before || /^0+$/.test(before)
let paths = []
if (!all) {
  try {
    paths = execFileSync('git', ['diff', '--name-only', '-z', before, process.env.GITHUB_SHA], { encoding: 'utf8' }).split('\0').filter(Boolean)
  } catch {
    // A force push can make the old commit unavailable. Rebuild everything safely.
    all = true
  }
}
const affected = affectedPackages(paths, all)
for (const pkg of packages) appendFileSync(process.env.GITHUB_OUTPUT, `${pkg}=${affected.includes(pkg)}\n`)
console.log(`Affected packages: ${affected.join(', ') || 'none'}`)

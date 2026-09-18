import { createHash, createHmac } from 'node:crypto'

export const packages = ['agents', 'api', 'web']

export function deployment(branch) {
  if (!branch) throw new Error('Missing branch name')
  const suffix = branch === 'main' ? '' : `-${branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'branch'}-${createHash('sha256').update(branch).digest('hex').slice(0, 10)}`
  return {
    names: Object.fromEntries(packages.map(pkg => [pkg, `weave-${pkg}${suffix}`])),
    database: `weave-auth${suffix}`,
  }
}

export function affectedPackages(paths, all = false) {
  const shared = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', '.node-version'])
  if (all || paths.some(path => shared.has(path) || path.startsWith('.github/') || path.startsWith('scripts/ci/'))) return packages
  // API imports the agents package's RPC types and must be checked/released with it.
  return packages.filter(pkg => paths.some(path => path.startsWith(`apps/${pkg}/`) || (pkg === 'api' && path.startsWith('apps/agents/'))))
}

export function authSecret(secret, branch) {
  return branch === 'main' ? secret : createHmac('sha256', secret).update(branch).digest('hex')
}

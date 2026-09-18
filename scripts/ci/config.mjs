import { createHmac } from 'node:crypto'

export const packages = ['agents', 'api', 'web']

export function deployment(target) {
  if (!/^(production|staging|pr-[1-9][0-9]*)$/.test(target ?? '')) throw new Error('Expected production, staging, or pr-<number>')
  const suffix = target === 'production' ? '' : `-${target}`
  return {
    names: Object.fromEntries(packages.map(pkg => [pkg, `weave-${pkg}${suffix}`])),
    database: `weave-auth${suffix}`,
  }
}

export function affectedPackages(paths, all = false) {
  const shared = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', '.node-version'])
  if (all || paths.some(path => shared.has(path) || path.startsWith('.github/') || path.startsWith('scripts/ci/') || path === 'scripts/smoke.test.mjs')) return packages
  return packages.filter(pkg => paths.some(path => path.startsWith(`apps/${pkg}/`) || (pkg === 'api' && path.startsWith('apps/agents/'))))
}

export function authSecret(secret, target) {
  deployment(target)
  return target === 'production' ? secret : createHmac('sha256', secret).update(target).digest('hex')
}

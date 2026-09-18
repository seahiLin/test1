import { deployment } from './config.mjs'
import { cloudflare } from './cloudflare.mjs'

const target = process.env.DEPLOY_TARGET
if (!/^pr-[1-9][0-9]*$/.test(target ?? '')) throw new Error('Cleanup only accepts a PR preview; permanent environments cannot be deleted')
const { names, database } = deployment(target)
// Remove callers before the services they bind to. Never force-delete dependencies.
const workers = await cloudflare('/workers/scripts')
for (const pkg of ['web', 'api', 'agents']) {
  if (workers.some(worker => worker.id === names[pkg])) {
    await cloudflare(`/workers/scripts/${names[pkg]}`, { method: 'DELETE', allowMissing: true })
    console.log(`Deleted ${names[pkg]}`)
  }
}
const databases = await cloudflare(`/d1/database?name=${encodeURIComponent(database)}`)
const db = databases.find(item => item.name === database)
if (db) {
  await cloudflare(`/d1/database/${db.uuid}`, { method: 'DELETE', allowMissing: true })
  console.log(`Deleted ${database}`)
}
console.log(`Preview ${target} cleaned up`)

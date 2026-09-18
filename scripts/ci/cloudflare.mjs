export async function cloudflare(path, options = {}) {
  for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
    if (!process.env[key]) throw new Error(`Missing secret: ${key}`)
  }
  const { allowMissing = false, ...init } = options
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}${path}`, {
    ...init,
    signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
  })
  if (allowMissing && response.status === 404) return null
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(`Cloudflare ${path}: ${JSON.stringify(body.errors)}`)
  return body.result
}

export async function webUrl(name) {
  const { subdomain } = await cloudflare('/workers/subdomain')
  if (!subdomain) throw new Error('Enable your workers.dev subdomain in Cloudflare first')
  return `https://${name}.${subdomain}.workers.dev`
}

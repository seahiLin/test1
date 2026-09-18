import { appendFileSync } from 'node:fs'
import { deployment } from './config.mjs'
import { webUrl } from './cloudflare.mjs'
const target = process.env.DEPLOY_TARGET
const url = await webUrl(deployment(target).names.web)
appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)
appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${target}\n\n[Open website](${url})\n`)

// CKB Pulse lessons: reads the lines a pull request adds (from the GitHub API, no checkout), asks CKB Pulse which
// lessons apply, and keeps one comment on the pull request up to date. Its own errors never fail the build.
import fs from 'node:fs'
import { MARKER, chunksOf, render } from './lib.js'

const input = (name, d = '') => (process.env[`INPUT_${name.toUpperCase()}`] || d).trim()
const token = input('github-token')
const pulse = input('pulse-url', 'https://pulse.lusocryptolabs.com').replace(/\/+$/, '')
const failOnAvoid = input('fail-on-avoid', 'false') === 'true'
const max = Math.max(1, Math.min(20, Number(input('max-lessons', '3')) || 3))
const api = process.env.GITHUB_API_URL || 'https://api.github.com'
const server = process.env.GITHUB_SERVER_URL || 'https://github.com'
const summary = (text) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n') }
const warn = (m) => console.log(`::warning::${m}`)

async function gh(path, init = {}) {
  const r = await fetch(api + path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'ckb-pulse-action', ...(init.headers || {}) },
  })
  if (!r.ok) throw Object.assign(new Error(`GitHub ${init.method || 'GET'} ${path}: ${r.status}`), { status: r.status })
  return r.status === 204 ? null : r.json()
}

async function main() {
  const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const pr = ev.pull_request
  if (!pr) { console.log('Not a pull request event: nothing to check.'); return }
  const repo = process.env.GITHUB_REPOSITORY
  const n = pr.number
  const files = []
  for (let page = 1; page <= 30; page++) {
    const got = await gh(`/repos/${repo}/pulls/${n}/files?per_page=100&page=${page}`)
    files.push(...got)
    if (got.length < 100) break
  }
  const chunks = chunksOf(files)
  let lessons = []
  if (chunks.length) {
    let r
    try {
      r = await fetch(`${pulse}/api/check`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'ckb-pulse-action' }, body: JSON.stringify({ chunks, limit: max }) })
    } catch (e) { warn(`CKB Pulse did not answer (${e.message}): no lessons this time.`); return }
    if (!r.ok) { warn(`CKB Pulse answered ${r.status}: no lessons this time.`); return }
    lessons = (await r.json()).lessons.slice(0, max)
  }
  console.log(`${chunks.length} runs of changed lines in ${new Set(chunks.map((c) => c.path)).size} code files; ${lessons.length} lessons apply.`)
  const body = render(lessons, { pulse, repoUrl: `${server}/${repo}`, sha: pr.head.sha })
  summary(body.replace(MARKER, ''))
  const fork = pr.head.repo?.full_name !== pr.base.repo?.full_name
  if (fork) {
    console.log('A pull request from a fork: GitHub gives this run no right to comment, so the lessons are in the run summary.')
  } else {
    const mine = []
    for (let page = 1; page <= 10; page++) {
      const got = await gh(`/repos/${repo}/issues/${n}/comments?per_page=100&page=${page}`)
      mine.push(...got.filter((c) => c.body?.startsWith(MARKER) && c.user?.type === 'Bot'))
      if (got.length < 100) break
    }
    try {
      if (mine.length) await gh(`/repos/${repo}/issues/comments/${mine[0].id}`, { method: 'PATCH', body: JSON.stringify({ body }) })
      else if (lessons.length) await gh(`/repos/${repo}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body }) })
    } catch (e) { warn(`Could not write the comment (${e.status || e.message}): the lessons are in the run summary. Does the workflow give pull-requests: write?`) }
  }
  if (failOnAvoid && lessons.some((l) => /avoid/.test(l.match || ''))) {
    console.log('::error::A changed line repeats a pattern a CKB lesson says to avoid (fail-on-avoid is on).')
    process.exitCode = 1
  }
}

main().catch((e) => warn(`ckb-pulse-action stopped: ${e.message}`))

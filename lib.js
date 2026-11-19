// The parts of the action that need no network: which files are code, which lines a patch adds, and the comment.

export const MARKER = '<!-- ckb-pulse-lessons -->'
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|rs|go|py|c|h|cpp|hpp|java|kt|swift|sol|move|lua|rb|php|cs|zig)$/i
const SKIP = /(^|\/)(node_modules|vendor|dist|build|target|\.next)\/|\.min\.js$/i
export const isCode = (path) => CODE.test(path) && !SKIP.test(path)

/** The runs of added lines in a unified diff patch, as {start, code}: start is the line number in the new file. */
export function addedRuns(patch) {
  const runs = []
  let line = 0
  let cur = null
  for (const raw of String(patch || '').split('\n')) {
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
    if (h) { line = Number(h[1]); cur = null; continue }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      if (!cur) { cur = { start: line, lines: [] }; runs.push(cur) }
      cur.lines.push(raw.slice(1))
      line++
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      // a removed line takes no line number in the new file
    } else if (raw.startsWith('\\')) {
      // "\ No newline at end of file"
    } else {
      cur = null
      line++
    }
  }
  return runs.map((r) => ({ start: r.start, code: r.lines.join('\n') }))
}

/** The chunks to send: the added runs of the code files, capped so one pull request stays one small request. */
export function chunksOf(files, { maxChunks = 200, maxChars = 30000 } = {}) {
  const out = []
  for (const f of files) {
    if (!f.patch || !isCode(f.filename) || f.status === 'removed') continue
    for (const r of addedRuns(f.patch)) if (r.code.trim()) out.push({ path: f.filename, start: r.start, code: r.code.slice(0, maxChars) })
    if (out.length >= maxChunks) break
  }
  return out.slice(0, maxChunks)
}

const esc = (s) => String(s).replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'))
const isAvoid = (l) => /avoid/.test(l.match || '')

/** The comment: repeated mistakes first, then the lessons about what the changed lines use. */
export function render(lessons, { pulse, repoUrl, sha }) {
  if (!lessons.length) return `${MARKER}\n**CKB lessons:** none apply to the latest changes.`
  const where = (l) => {
    const label = '`' + l.path + ':' + l.line + '`'
    if (!repoUrl || !sha) return label
    return `[${label}](${repoUrl}/blob/${sha}/${l.path.split('/').map(encodeURIComponent).join('/')}#L${l.line})`
  }
  const prefer = (l) => (l.prefer && l.prefer.length ? `\n  Prefer: \`${esc(l.prefer[0]).replace(/`/g, "'")}\`` : '')
  const item = (l) => `- ${where(l)} [${esc(l.title)}](${l.url})${l.why ? `\n  ${esc(l.why)}` : ''}${prefer(l)}`
  const avoid = lessons.filter(isAvoid)
  const rest = lessons.filter((l) => !isAvoid(l))
  const one = lessons.length === 1
  return [
    MARKER,
    '### CKB lessons for this pull request',
    '',
    `${lessons.length} ${one ? 'lesson' : 'lessons'} from real fixes in other CKB projects ${one ? 'applies' : 'apply'} to lines this pull request changes. They are hints to read, not proof: nothing was run.`,
    ...(avoid.length ? ['', '**Repeats a pattern a lesson says to avoid**', ...avoid.map(item)] : []),
    ...(rest.length ? ['', '**About what these lines use**', ...rest.map(item)] : []),
    '',
    `<sub>From [CKB Pulse](${pulse}/learned). Each lesson links to the commit it came from. Only the changed lines were sent, and they are not stored.</sub>`,
  ].join('\n')
}

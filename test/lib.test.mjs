import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { addedRuns, chunksOf, isCode, render, MARKER } from '../lib.js'

const PATCH = [
  '@@ -10,6 +10,8 @@ export async function pay(signer, to) {',
  '   const tx = ccc.Transaction.from({ outputs: [{ lock: to }] })',
  '   await tx.completeInputsByCapacity(signer)',
  '-  await tx.completeFeeChangeToOutput(signer, 0)',
  '+  await tx.completeFeeBy(signer)',
  '+  // sign and send',
  '   const hash = await signer.sendTransaction(tx)',
  '+  log(hash)',
  '   return hash',
  '\\ No newline at end of file',
].join('\n')

test('addedRuns gives each run of added lines with its line number in the new file', () => {
  assert.deepEqual(addedRuns(PATCH), [{ start: 12, code: '  await tx.completeFeeBy(signer)\n  // sign and send' }, { start: 15, code: '  log(hash)' }])
  assert.deepEqual(addedRuns('@@ -0,0 +1,2 @@\n+a\n+b'), [{ start: 1, code: 'a\nb' }], 'a new file')
  assert.deepEqual(addedRuns(''), [])
})

test('only code files go, without lockfiles, builds or vendored code, and not removed files', () => {
  assert.ok(isCode('src/tx.ts') && isCode('contracts/lock/src/main.rs') && isCode('scripts/deploy.py'))
  assert.ok(!isCode('README.md') && !isCode('node_modules/x/index.js') && !isCode('dist/app.js') && !isCode('app.min.js') && !isCode('Cargo.lock'))
  const files = [{ filename: 'src/tx.ts', status: 'modified', patch: PATCH }, { filename: 'README.md', status: 'modified', patch: '@@ -1 +1 @@\n+hi' }, { filename: 'src/old.ts', status: 'removed', patch: '@@ -1 +0,0 @@\n-x' }, { filename: 'big.bin', status: 'modified' }]
  assert.deepEqual(chunksOf(files).map((c) => [c.path, c.start]), [['src/tx.ts', 12], ['src/tx.ts', 15]])
})

test('the comment puts repeated mistakes first, links each line, and says what it is; nothing to say is one line', () => {
  const lessons = [
    { id: 'ccc/a', title: 'About sendTransaction', match: 'your code uses what this lesson is about', path: 'src/tx.ts', line: 15, url: 'https://p/learned/ccc/a', why: 'Why a.', prefer: [] },
    { id: 'ccc/b', title: 'completeFeeBy adds change', match: 'your code repeats the pattern this lesson says to avoid', path: 'src/tx.ts', line: 12, url: 'https://p/learned/ccc/b', why: 'The fee eats the change.', prefer: ['await tx.completeFeeChangeToOutput(signer, 0)'] },
  ]
  const c = render(lessons, { pulse: 'https://p', repoUrl: 'https://github.com/o/r', sha: 'abc' })
  assert.ok(c.startsWith(MARKER))
  assert.ok(c.indexOf('completeFeeBy adds change') < c.indexOf('About sendTransaction'), 'the avoid hit first')
  assert.ok(c.includes('[`src/tx.ts:12`](https://github.com/o/r/blob/abc/src/tx.ts#L12)'))
  assert.ok(c.includes('Prefer: `await tx.completeFeeChangeToOutput(signer, 0)`') && c.includes('hints to read, not proof'))
  assert.equal(render([], { pulse: 'https://p' }), `${MARKER}\n**CKB lessons:** none apply to the latest changes.`)
})

test('no long or medium dashes in the files people read', () => {
  for (const f of ['README.md', 'action.yml', 'lib.js', 'index.js', 'examples/ckb-lessons.yml']) {
    assert.ok(!/[\u2013\u2014]/.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), f)
  }
})

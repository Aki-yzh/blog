import { strict as assert } from 'node:assert'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { createAdminServer } from './server.mjs'

const tempRoot = mkdtempSync(join(tmpdir(), 'aki-content-server-test-'))
if (!realpathSync(tempRoot).startsWith(realpathSync(tmpdir())))
  throw new Error('Refusing to use an unsafe test directory')

const json = (path, value) => {
  mkdirSync(resolve(tempRoot, path, '..'), { recursive: true })
  writeFileSync(resolve(tempRoot, path), JSON.stringify(value, null, 2) + '\n')
}

json('src/data/gunpla-groups.json', {
  version: 1,
  groups: [
    { key: 'Bandai', parent: null },
    { key: 'Bandai/MG', parent: 'Bandai' }
  ]
})
json('src/content/gunpla/001.json', {
  order: 1,
  group: 'Bandai/MG',
  officialImages: ['https://example.com/official.jpg'],
  myImages: ['/images/test.jpg'],
  name: 'Test Gundam',
  releasePrice: '4,500日元',
  brand: 'Bandai',
  purchasePrice: '200元',
  link78: 'https://example.com/item',
  review: '保留原始内容'
})
json('src/content/acg/game/01.json', {
  section: 'game',
  order: 1,
  title: 'Game',
  description: 'Desc',
  image: 'https://example.com/game.jpg'
})
json('src/content/publications/paper.json', {
  title: 'Paper',
  authors: 'Author',
  publication: 'Venue',
  year: 2026,
  order: 1
})

const server = createAdminServer(tempRoot)
let base

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server.listening) await new Promise((resolve) => server.close(resolve))
  if (realpathSync(tempRoot).startsWith(realpathSync(tmpdir())))
    rmSync(tempRoot, { recursive: true, force: true })
})

test('serves the editor with restrictive browser headers', async () => {
  const response = await fetch(base + '/admin/content')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/)
  assert.match(await response.text(), /id="site-preview"/)
})

test('lists content but rejects a save without the session token', async () => {
  const listed = await fetch(base + '/api/content?kind=gunpla')
  assert.equal(listed.status, 200)
  assert.equal((await listed.json()).entries.length, 1)

  const rejected = await fetch(base + '/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  })
  assert.equal(rejected.status, 403)
})

test('accepts an authenticated new entry without overwriting another file', async () => {
  const session = await (await fetch(base + '/api/session')).json()
  assert.match(session.token, /^[a-f0-9]{64}$/)

  const response = await fetch(base + '/api/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      'X-Content-Token': session.token
    },
    body: JSON.stringify({
      kind: 'publications',
      slug: 'paper-2026-2',
      data: {
        title: 'New Paper',
        authors: 'Author',
        publication: 'Venue',
        year: 2026,
        order: 2
      }
    })
  })
  assert.equal(response.status, 200)
  assert.ok(existsSync(join(tempRoot, 'src/content/publications/paper-2026-2.json')))
  assert.ok(existsSync(join(tempRoot, 'src/content/publications/paper.json')))
})

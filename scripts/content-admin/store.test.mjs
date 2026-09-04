import { strict as assert } from 'node:assert'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { after, beforeEach, describe, test } from 'node:test'
import { ContentError, createContentStore, safePath } from './store.mjs'

const tempRoot = mkdtempSync(join(tmpdir(), 'aki-content-test-'))
if (!realpathSync(tempRoot).startsWith(realpathSync(tmpdir())))
  throw new Error('Refusing to use an unsafe test directory')
const json = (path, value) => {
  mkdirSync(resolve(tempRoot, path, '..'), { recursive: true })
  writeFileSync(resolve(tempRoot, path), JSON.stringify(value, null, 2) + '\n')
}
const gunpla = (order = 1, name = 'Test Gundam') => ({
  order,
  group: 'Bandai/MG',
  officialImages: ['https://example.com/official.jpg'],
  myImages: ['/images/test.jpg'],
  name,
  releasePrice: '4,500日元',
  brand: 'Bandai',
  purchasePrice: '200元',
  link78: 'https://example.com/item',
  review: '保留原始评语'
})
function seed() {
  mkdirSync(join(tempRoot, 'public/images'), { recursive: true })
  json('src/data/gunpla-groups.json', {
    version: 1,
    groups: [
      { key: 'Bandai', parent: null },
      { key: 'Bandai/MG', parent: 'Bandai' }
    ]
  })
  json('src/content/gunpla/001.json', gunpla())
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
}

beforeEach(() => {
  rmSync(tempRoot, { recursive: true, force: true })
  mkdirSync(tempRoot)
  seed()
})
after(() => {
  if (realpathSync(tempRoot).startsWith(realpathSync(tmpdir())))
    rmSync(tempRoot, { recursive: true, force: true })
})

describe('content store safety', () => {
  test('lists existing content without changing its bytes', () => {
    const path = join(tempRoot, 'src/content/gunpla/001.json')
    const before = readFileSync(path, 'utf8')
    const store = createContentStore(tempRoot)
    assert.equal(store.list('gunpla').length, 1)
    assert.equal(store.read('gunpla', '001.json').data.name, 'Test Gundam')
    assert.equal(readFileSync(path, 'utf8'), before)
  })
  test('creates exclusively and rejects duplicate order', () => {
    const store = createContentStore(tempRoot)
    const created = store.save({ kind: 'gunpla', slug: 'new-kit', data: gunpla(2, 'New Kit') })
    assert.equal(created.entry.id, 'new-kit.json')
    assert.throws(
      () => store.save({ kind: 'gunpla', slug: 'collision', data: gunpla(2, 'Collision') }),
      ContentError
    )
    assert.equal(store.list('gunpla').length, 2)
  })
  test('backs up exact bytes before editing and rejects a stale revision', () => {
    const store = createContentStore(tempRoot)
    const entry = store.read('gunpla', '001.json')
    const before = readFileSync(join(tempRoot, 'src/content/gunpla/001.json'), 'utf8')
    const edited = structuredClone(entry.data)
    edited.review = '新的评语'
    const result = store.save({
      kind: 'gunpla',
      id: entry.id,
      revision: entry.revision,
      data: edited
    })
    assert.equal(readFileSync(resolve(tempRoot, result.backup), 'utf8'), before)
    assert.equal(store.read('gunpla', '001.json').data.review, '新的评语')
    const current = readFileSync(join(tempRoot, 'src/content/gunpla/001.json'), 'utf8')
    assert.throws(
      () =>
        store.save({ kind: 'gunpla', id: entry.id, revision: entry.revision, data: entry.data }),
      ContentError
    )
    assert.equal(readFileSync(join(tempRoot, 'src/content/gunpla/001.json'), 'utf8'), current)
  })
  test('blocks traversal and invalid URL protocols', () => {
    assert.throws(() => safePath(tempRoot, '../outside.json'), ContentError)
    const store = createContentStore(tempRoot)
    const bad = gunpla(2)
    bad.link78 = 'javascript:alert(1)'
    assert.throws(() => store.save({ kind: 'gunpla', slug: 'bad-url', data: bad }), ContentError)
  })
  test('accepts a real PNG signature into a generated path', () => {
    const store = createContentStore(tempRoot)
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    const result = store.upload({ filename: 'test.png', base64 })
    assert.match(result.path, /^\/images\/uploads\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+\.png$/)
    assert.ok(existsSync(resolve(tempRoot, 'public', result.path.slice(1))))
  })
})

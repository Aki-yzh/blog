import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicationDirectory = join(projectRoot, 'src', 'content', 'publications')
const sourcePages = [
  'src/pages/index.astro',
  'src/pages/about/index.astro',
  'src/pages/projects/index.astro'
]
const publicationFields = ['title', 'authors', 'publication', 'year', 'link']
const dataFields = [...publicationFields, 'order'].sort()
const baselineFingerprint = '189023382a6a607f047d6d9012437e7c08f173f6ed3a8e9f8e0d18a9026b9271'

function fail(message) {
  console.error(`Publication verification failed: ${message}`)
  process.exit(1)
}

function readHeadFile(path) {
  try {
    return execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message
    fail(`could not read ${path} from Git HEAD: ${detail}`)
  }
}

function readStringAttribute(attributes, name, page) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`))
  if (!match) fail(`${page} has a PaperCard without a quoted ${name} attribute`)
  return match[1]
}

function readYearAttribute(attributes, page) {
  const match = attributes.match(/(?:^|\s)year\s*=\s*\{(\d+)\}/)
  if (!match) fail(`${page} has a PaperCard without a numeric year attribute`)
  return Number(match[1])
}

function extractPaperCards(source, page) {
  const cards = []
  const cardPattern = /<PaperCard\b([\s\S]*?)\/>/g

  for (const match of source.matchAll(cardPattern)) {
    const attributes = match[1]
    cards.push({
      title: readStringAttribute(attributes, 'title', page),
      authors: readStringAttribute(attributes, 'authors', page),
      publication: readStringAttribute(attributes, 'publication', page),
      year: readYearAttribute(attributes, page),
      link: readStringAttribute(attributes, 'link', page)
    })
  }

  if (cards.length === 0) fail(`${page} contains no PaperCard entries in Git HEAD`)
  return cards
}

function describeDifference(expected, actual) {
  const count = Math.max(expected.length, actual.length)
  for (let index = 0; index < count; index += 1) {
    if (!expected[index]) return `unexpected entry at position ${index + 1}`
    if (!actual[index]) return `missing entry at position ${index + 1}`

    for (const field of publicationFields) {
      if (expected[index][field] !== actual[index][field]) {
        return `entry ${index + 1} field "${field}" differs\n  expected: ${JSON.stringify(expected[index][field])}\n  actual:   ${JSON.stringify(actual[index][field])}`
      }
    }
  }
  return 'unknown difference'
}

const headSources = new Map(sourcePages.map((page) => [page, readHeadFile(page)]))
const pagesWithLegacyCards = sourcePages.filter((page) =>
  /<PaperCard\b/.test(headSources.get(page))
)
if (pagesWithLegacyCards.length > 0 && pagesWithLegacyCards.length !== sourcePages.length) {
  fail(
    `only ${pagesWithLegacyCards.length}/${sourcePages.length} Git HEAD pages contain PaperCard data`
  )
}

let baselineEntries
if (pagesWithLegacyCards.length === sourcePages.length) {
  const headEntriesByPage = new Map(
    sourcePages.map((page) => [page, extractPaperCards(headSources.get(page), page)])
  )
  const baselinePage = sourcePages[0]
  baselineEntries = headEntriesByPage.get(baselinePage)

  for (const page of sourcePages.slice(1)) {
    const pageEntries = headEntriesByPage.get(page)
    if (!isDeepStrictEqual(baselineEntries, pageEntries)) {
      fail(
        `${page} differs from ${baselinePage}: ${describeDifference(baselineEntries, pageEntries)}`
      )
    }
  }
}

const jsonFiles = readdirSync(publicationDirectory)
  .filter((name) => name.endsWith('.json'))
  .sort()

if (jsonFiles.length === 0) fail('src/content/publications contains no JSON files')

const dataEntries = jsonFiles.map((name) => {
  let entry
  try {
    entry = JSON.parse(readFileSync(join(publicationDirectory, name), 'utf8'))
  } catch (error) {
    fail(`${name} is not valid JSON: ${error.message}`)
  }

  if (!entry || Array.isArray(entry) || typeof entry !== 'object')
    fail(`${name} must contain one JSON object`)

  const actualFields = Object.keys(entry).sort()
  if (!isDeepStrictEqual(actualFields, dataFields)) {
    fail(
      `${name} fields differ; expected ${dataFields.join(', ')}, received ${actualFields.join(', ')}`
    )
  }
  if (!Number.isInteger(entry.order) || entry.order <= 0)
    fail(`${name} order must be a positive integer`)

  return { name, entry }
})

dataEntries.sort((left, right) => left.entry.order - right.entry.order)

const seenOrders = new Set()
for (const { name, entry } of dataEntries) {
  if (seenOrders.has(entry.order)) fail(`${name} duplicates order ${entry.order}`)
  seenOrders.add(entry.order)
}

const collectionEntries = dataEntries.map(({ entry }) =>
  Object.fromEntries(publicationFields.map((field) => [field, entry[field]]))
)
const fingerprint = createHash('sha256')
  .update(JSON.stringify(dataEntries.map(({ entry }) => entry)))
  .digest('hex')

if (fingerprint !== baselineFingerprint) {
  fail(`collection migration fingerprint differs: ${fingerprint}`)
}

if (baselineEntries && !isDeepStrictEqual(baselineEntries, collectionEntries)) {
  fail(
    `collection data differs from Git HEAD: ${describeDifference(baselineEntries, collectionEntries)}`
  )
}

console.log(
  baselineEntries
    ? `Publications verified: ${sourcePages.length} Git HEAD pages and ${collectionEntries.length} collection entries match exactly.`
    : `Publications verified: ${collectionEntries.length} collection entries match the immutable migration fingerprint.`
)

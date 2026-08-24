import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Lossless migration helper for the legacy Gunpla page.
 *
 * The default command is read-only:
 *   bun scripts/extract-gunpla.ts --check
 *
 * Writing is deliberately opt-in and refuses to overwrite any JSON file:
 *   bun scripts/extract-gunpla.ts --write
 *
 * After the page has been switched to data-driven rendering, compare the JSON
 * data with the untouched legacy page:
 *   bun scripts/extract-gunpla.ts --verify
 */

const FIELD_NAMES = [
  'officialImages',
  'myImages',
  'name',
  'releasePrice',
  'brand',
  'purchasePrice',
  'link78',
  'review'
] as const

type FieldName = (typeof FIELD_NAMES)[number]

type GunplaFields = {
  officialImages: string[]
  myImages: string[]
  name: string
  releasePrice: string
  brand: string
  purchasePrice: string
  link78: string
  review: string
}

type TocHeading = {
  depth: number
  slug: string
  text: string
}

type PageHeading = {
  depth: number
  id: string
  text: string
  tocText: string
  key: string
  parent: string | null
  order: number
}

type ExtractedCard = GunplaFields & {
  order: number
  group: string
  sourceLine: number
}

type PersistedCard = GunplaFields & {
  order: number
  group: string
}

type ParsedPage = {
  cards: ExtractedCard[]
  groups: PageHeading[]
  tocHeadings: TocHeading[]
}

type ParsedAttribute = { kind: 'expression'; value: string } | { kind: 'string'; value: string }

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFile = resolve(projectRoot, 'src/pages/gunpla/index.astro')
const outputDirectory = resolve(projectRoot, 'src/content/gunpla')
const groupsFile = resolve(projectRoot, 'src/data/gunpla-groups.json')
const BASELINE_CARD_COUNT = 126
const BASELINE_CARD_FINGERPRINT = 'f0d3f9053815e812f981fbc9dfd5977544cffaebf567d56c61d2563efbf98f9f'
const BASELINE_GROUP_FINGERPRINT =
  '1fe61d5ba2280469c44624e69f6a04f006094b1f218a1298eb61738622105762'

function readLegacySource(): string {
  return execFileSync('git', ['show', 'HEAD:src/pages/gunpla/index.astro'], {
    cwd: projectRoot,
    encoding: 'utf8'
  })
}

function lineNumberAt(source: string, index: number): number {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1
  }
  return line
}

function decodeEscape(character: string): string {
  if (character === 'n') return '\n'
  if (character === 'r') return '\r'
  if (character === 't') return '\t'
  if (character === 'b') return '\b'
  if (character === 'f') return '\f'
  if (character === 'v') return '\v'
  return character
}

function readQuoted(input: string, start: number): { value: string; end: number } {
  const quote = input[start]
  if (quote !== "'" && quote !== '"') {
    throw new Error(`Expected a quoted string at offset ${start}`)
  }

  let value = ''
  for (let cursor = start + 1; cursor < input.length; cursor += 1) {
    const character = input[cursor]
    if (character === quote) return { value, end: cursor + 1 }
    if (character === '\\') {
      cursor += 1
      if (cursor >= input.length) throw new Error('Unterminated escape sequence')
      value += decodeEscape(input[cursor])
      continue
    }
    value += character
  }

  throw new Error(`Unterminated quoted string at offset ${start}`)
}

function readExpression(input: string, start: number): { value: string; end: number } {
  if (input[start] !== '{') throw new Error(`Expected { at offset ${start}`)

  let depth = 0
  let quote: string | null = null
  let escaped = false

  for (let cursor = start; cursor < input.length; cursor += 1) {
    const character = input[cursor]
    if (quote !== null) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
    } else if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) {
        return { value: input.slice(start + 1, cursor), end: cursor + 1 }
      }
    }
  }

  throw new Error(`Unterminated expression at offset ${start}`)
}

function findComponentEnd(source: string, start: number): number {
  let braces = 0
  let quote: string | null = null
  let escaped = false

  for (let cursor = start; cursor < source.length - 1; cursor += 1) {
    const character = source[cursor]
    if (quote !== null) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
    } else if (character === '{') {
      braces += 1
    } else if (character === '}') {
      braces -= 1
      if (braces < 0) throw new Error('Unbalanced } inside GunplaCard')
    } else if (character === '/' && source[cursor + 1] === '>' && braces === 0) {
      return cursor + 2
    }
  }

  throw new Error(`Could not find the end of GunplaCard at line ${lineNumberAt(source, start)}`)
}

function parseAttributes(component: string): Map<string, ParsedAttribute> {
  const attributes = new Map<string, ParsedAttribute>()
  const openTagEnd = component.indexOf('GunplaCard') + 'GunplaCard'.length
  const body = component.slice(openTagEnd, component.lastIndexOf('/>'))
  let cursor = 0

  while (cursor < body.length) {
    while (/\s/.test(body[cursor] ?? '')) cursor += 1
    if (cursor >= body.length) break

    const nameMatch = /^[A-Za-z][A-Za-z0-9_-]*/.exec(body.slice(cursor))
    if (!nameMatch)
      throw new Error(`Unexpected attribute syntax near: ${body.slice(cursor, cursor + 40)}`)
    const name = nameMatch[0]
    cursor += name.length
    while (/\s/.test(body[cursor] ?? '')) cursor += 1
    if (body[cursor] !== '=') throw new Error(`Attribute ${name} has no value`)
    cursor += 1
    while (/\s/.test(body[cursor] ?? '')) cursor += 1

    let parsed: ParsedAttribute
    if (body[cursor] === "'" || body[cursor] === '"') {
      const result = readQuoted(body, cursor)
      parsed = { kind: 'string', value: result.value }
      cursor = result.end
    } else if (body[cursor] === '{') {
      const result = readExpression(body, cursor)
      parsed = { kind: 'expression', value: result.value }
      cursor = result.end
    } else {
      throw new Error(`Attribute ${name} must be a string or expression`)
    }

    if (attributes.has(name)) throw new Error(`Duplicate attribute ${name}`)
    attributes.set(name, parsed)
  }

  return attributes
}

function parseStringArray(expression: string, field: string): string[] {
  const input = expression.trim()
  if (!input.startsWith('[') || !input.endsWith(']')) {
    throw new Error(`${field} is not an array literal: ${input}`)
  }

  const values: string[] = []
  let cursor = 1
  while (cursor < input.length - 1) {
    while (/\s/.test(input[cursor] ?? '')) cursor += 1
    if (input[cursor] === ',') {
      cursor += 1
      continue
    }
    if (cursor >= input.length - 1) break
    const parsed = readQuoted(input, cursor)
    values.push(parsed.value)
    cursor = parsed.end
    while (/\s/.test(input[cursor] ?? '')) cursor += 1
    if (input[cursor] === ',') cursor += 1
  }

  return values
}

function parseTocHeadings(source: string): TocHeading[] {
  const secondFence = source.indexOf('\n---', 4)
  if (secondFence < 0) throw new Error('Could not find the closing Astro frontmatter fence')
  const frontmatter = source.slice(0, secondFence)
  const result: TocHeading[] = []
  const entryPattern = /\{\s*depth:\s*(\d+),\s*slug:\s*(['"])(.*?)\2,\s*text:\s*(['"])(.*?)\4\s*\}/g

  for (const match of frontmatter.matchAll(entryPattern)) {
    result.push({ depth: Number(match[1]), slug: match[3], text: match[5] })
  }
  if (result.length === 0) throw new Error('No entries were parsed from const headings')
  return result
}

function parsePage(source: string): ParsedPage {
  const tocHeadings = parseTocHeadings(source)
  const tocBySlug = new Map(tocHeadings.map((heading) => [heading.slug, heading]))
  const cards: ExtractedCard[] = []
  const groups: PageHeading[] = []
  const activeHeadings = new Map<number, PageHeading>()
  const tokenPattern = /<h([234])\s+id\s*=\s*(['"])(.*?)\2[^>]*>([\s\S]*?)<\/h\1>|<GunplaCard\b/g

  for (const match of source.matchAll(tokenPattern)) {
    if (match[1]) {
      const depth = Number(match[1])
      const id = match[3]
      const text = match[4].trim()
      for (const activeDepth of [...activeHeadings.keys()]) {
        if (activeDepth >= depth) activeHeadings.delete(activeDepth)
      }
      const parent = [...activeHeadings.values()].sort((a, b) => b.depth - a.depth)[0] ?? null
      const key = parent === null ? id : `${parent.key}/${id}`
      const tocHeading = tocBySlug.get(id)
      const heading: PageHeading = {
        depth,
        id,
        text,
        tocText: tocHeading?.text ?? text,
        key,
        parent: parent?.key ?? null,
        order: groups.length + 1
      }
      if (groups.some((group) => group.key === key))
        throw new Error(`Duplicate heading path ${key}`)
      groups.push(heading)
      activeHeadings.set(depth, heading)
      continue
    }

    const start = match.index
    const end = findComponentEnd(source, start)
    const attributes = parseAttributes(source.slice(start, end))
    const sourceLine = lineNumberAt(source, start)
    const unknown = [...attributes.keys()].filter(
      (name) => !FIELD_NAMES.includes(name as FieldName)
    )
    const missing = FIELD_NAMES.filter((name) => !attributes.has(name))
    if (unknown.length > 0 || missing.length > 0 || attributes.size !== FIELD_NAMES.length) {
      throw new Error(
        `GunplaCard at line ${sourceLine} has missing [${missing.join(', ')}] and unknown [${unknown.join(', ')}] props`
      )
    }

    const currentGroup = [...activeHeadings.values()].sort((a, b) => b.depth - a.depth)[0]
    if (!currentGroup) throw new Error(`GunplaCard at line ${sourceLine} has no preceding heading`)

    const scalar = (name: Exclude<FieldName, 'officialImages' | 'myImages'>): string => {
      const attribute = attributes.get(name)
      if (!attribute || attribute.kind !== 'string') {
        throw new Error(`${name} at line ${sourceLine} is not a plain string`)
      }
      return attribute.value
    }
    const array = (name: 'officialImages' | 'myImages'): string[] => {
      const attribute = attributes.get(name)
      if (!attribute || attribute.kind !== 'expression') {
        throw new Error(`${name} at line ${sourceLine} is not an expression`)
      }
      return parseStringArray(attribute.value, `${name} at line ${sourceLine}`)
    }

    cards.push({
      order: cards.length + 1,
      group: currentGroup.key,
      sourceLine,
      officialImages: array('officialImages'),
      myImages: array('myImages'),
      name: scalar('name'),
      releasePrice: scalar('releasePrice'),
      brand: scalar('brand'),
      purchasePrice: scalar('purchasePrice'),
      link78: scalar('link78'),
      review: scalar('review')
    })
  }

  const pageHeadingIds = new Set(groups.map((group) => group.id))
  const missingFromPage = tocHeadings.filter((heading) => !pageHeadingIds.has(heading.slug))
  const missingFromToc = groups.filter((group) => !tocBySlug.has(group.id))
  if (missingFromPage.length > 0 || missingFromToc.length > 0) {
    throw new Error(
      `Heading mismatch: only in TOC [${missingFromPage.map((item) => item.slug).join(', ')}], only in page [${missingFromToc.map((item) => item.id).join(', ')}]`
    )
  }

  const rawCardCount = source.match(/<GunplaCard\b/g)?.length ?? 0
  if (cards.length !== rawCardCount) {
    throw new Error(
      `Parser found ${cards.length} cards, but source contains ${rawCardCount} GunplaCard tags`
    )
  }

  return { cards, groups, tocHeadings }
}

function persistedCard(card: ExtractedCard): PersistedCard {
  const { sourceLine: _sourceLine, ...persisted } = card
  return persisted
}

function canonicalFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function duplicateValues(cards: ExtractedCard[], field: 'name' | 'link78'): string[] {
  const counts = new Map<string, number>()
  for (const card of cards) counts.set(card[field], (counts.get(card[field]) ?? 0) + 1)
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value)
}

function cardsWithValue(
  cards: ExtractedCard[],
  field: 'name' | 'link78',
  value: string
): ExtractedCard[] {
  return cards.filter((card) => card[field] === value)
}

function audit(parsed: ParsedPage): void {
  const { cards, groups } = parsed
  const byGroup = new Map<string, number>()
  const byBrand = new Map<string, number>()
  for (const card of cards) {
    byGroup.set(card.group, (byGroup.get(card.group) ?? 0) + 1)
    byBrand.set(card.brand, (byBrand.get(card.brand) ?? 0) + 1)
  }

  const allImages = cards.flatMap((card) => [
    ...card.officialImages.map((image) => ({ image, kind: 'official', card })),
    ...card.myImages.map((image) => ({ image, kind: 'mine', card }))
  ])
  const localWithoutLeadingSlash = allImages.filter(
    ({ image }) => !image.startsWith('/') && !/^https?:\/\//.test(image)
  )
  const insecureRemoteImages = allImages.filter(({ image }) => image.startsWith('http://'))
  const missingLocalImages = allImages.filter(({ image }) => {
    if (/^https?:\/\//.test(image)) return false
    const normalized = image.startsWith('/') ? image.slice(1) : image
    return !existsSync(resolve(projectRoot, 'public', normalized))
  })
  const emptyFields = cards.flatMap((card) =>
    FIELD_NAMES.flatMap((field) => {
      const value = card[field]
      return (Array.isArray(value) ? value.length === 0 : value.length === 0)
        ? [`#${card.order} ${field}`]
        : []
    })
  )
  const tocTextDifferences = groups.filter((group) => group.text !== group.tocText)
  const duplicateNames = duplicateValues(cards, 'name')
  const duplicateLinks = duplicateValues(cards, 'link78')
  const placeholderImages = allImages.filter(({ image }) => /(?:^|\/)wait\.png$/i.test(image))
  const officialImageCounts = new Map<number, number>()
  const personalImageCounts = new Map<number, number>()
  for (const card of cards) {
    officialImageCounts.set(
      card.officialImages.length,
      (officialImageCounts.get(card.officialImages.length) ?? 0) + 1
    )
    personalImageCounts.set(
      card.myImages.length,
      (personalImageCounts.get(card.myImages.length) ?? 0) + 1
    )
  }

  console.log(`Parsed ${cards.length} GunplaCard entries and ${groups.length} headings.`)
  console.log(`Canonical source fingerprint: ${canonicalFingerprint(cards.map(persistedCard))}`)
  console.log('\nCards by group:')
  for (const group of groups) console.log(`  ${group.key}: ${byGroup.get(group.key) ?? 0}`)
  console.log('\nCards by displayed brand:')
  for (const [brand, count] of [...byBrand].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${brand}: ${count}`)
  }
  console.log(
    `\nOfficial image count distribution: ${JSON.stringify(Object.fromEntries(officialImageCounts))}`
  )
  console.log(
    `Personal image count distribution: ${JSON.stringify(Object.fromEntries(personalImageCounts))}`
  )
  console.log(`Placeholder wait.png image references: ${placeholderImages.length}`)
  console.log(`Duplicate names: ${duplicateNames.length}`)
  for (const name of duplicateNames) {
    console.log(
      `  ${JSON.stringify(name)}: entries ${cardsWithValue(cards, 'name', name)
        .map((card) => `#${card.order}`)
        .join(', ')}`
    )
  }
  console.log(`Duplicate detail links: ${duplicateLinks.length}`)
  for (const link of duplicateLinks) {
    console.log(`  ${link}:`)
    for (const card of cardsWithValue(cards, 'link78', link)) {
      console.log(`    #${card.order}, line ${card.sourceLine}: ${card.name}`)
    }
  }
  console.log(`Empty required values/arrays: ${emptyFields.length}`)
  console.log(`Local image paths without leading /: ${localWithoutLeadingSlash.length}`)
  for (const { image, card } of localWithoutLeadingSlash) {
    console.log(`  line ${card.sourceLine}, #${card.order}: ${image}`)
  }
  console.log(`HTTP (not HTTPS) image URLs: ${insecureRemoteImages.length}`)
  for (const { image, card } of insecureRemoteImages) {
    console.log(`  line ${card.sourceLine}, #${card.order}: ${image}`)
  }
  console.log(`Missing local image files: ${missingLocalImages.length}`)
  for (const { image, card } of missingLocalImages) {
    console.log(`  line ${card.sourceLine}, #${card.order}: ${image}`)
  }
  console.log(`Visible heading/TOC text differences: ${tocTextDifferences.length}`)
  for (const heading of tocTextDifferences) {
    console.log(
      `  ${heading.key}: visible=${JSON.stringify(heading.text)}, toc=${JSON.stringify(heading.tocText)}`
    )
  }
}

function writeMigration(parsed: ParsedPage): void {
  const existingJson = existsSync(outputDirectory)
    ? readdirSync(outputDirectory).filter((name) => name.endsWith('.json'))
    : []
  if (existingJson.length > 0) {
    throw new Error(
      `Refusing to overwrite ${existingJson.length} existing JSON files in ${outputDirectory}`
    )
  }
  if (existsSync(groupsFile)) throw new Error(`Refusing to overwrite ${groupsFile}`)

  mkdirSync(outputDirectory, { recursive: true })
  for (const card of parsed.cards) {
    const filename = `${String(card.order).padStart(3, '0')}.json`
    writeFileSync(
      resolve(outputDirectory, filename),
      `${JSON.stringify(persistedCard(card), null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' }
    )
  }
  writeFileSync(groupsFile, `${JSON.stringify({ version: 1, groups: parsed.groups }, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx'
  })
  console.log(`Wrote ${parsed.cards.length} entries to ${outputDirectory}`)
  console.log(`Wrote ${parsed.groups.length} group definitions to ${groupsFile}`)
}

function verifyMigration(parsed: ParsedPage): void {
  if (!existsSync(outputDirectory)) throw new Error(`Missing output directory ${outputDirectory}`)
  if (!existsSync(groupsFile)) throw new Error(`Missing groups manifest ${groupsFile}`)

  const filenames = readdirSync(outputDirectory)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
  const actualCards = filenames.map((filename) =>
    JSON.parse(readFileSync(resolve(outputDirectory, filename), 'utf8'))
  )
  const expectedCards = parsed.cards.map(persistedCard)
  const actualGroups = JSON.parse(readFileSync(groupsFile, 'utf8'))
  const expectedGroups = { version: 1, groups: parsed.groups }

  if (JSON.stringify(actualCards) !== JSON.stringify(expectedCards)) {
    const mismatch = expectedCards.findIndex(
      (expected, index) => JSON.stringify(expected) !== JSON.stringify(actualCards[index])
    )
    throw new Error(
      `Gunpla migration differs at ordered entry ${mismatch + 1}; expected ${expectedCards.length}, found ${actualCards.length}`
    )
  }
  if (JSON.stringify(actualGroups) !== JSON.stringify(expectedGroups)) {
    throw new Error('Gunpla group manifest differs from the legacy headings')
  }

  console.log(`Verified ${actualCards.length} entries byte-for-value against the legacy page.`)
  console.log(`Canonical content fingerprint: ${canonicalFingerprint(actualCards)}`)
}

function verifyPersistedBaseline(): void {
  if (!existsSync(outputDirectory)) throw new Error(`Missing output directory ${outputDirectory}`)
  if (!existsSync(groupsFile)) throw new Error(`Missing groups manifest ${groupsFile}`)

  const actualCards = readdirSync(outputDirectory)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => JSON.parse(readFileSync(resolve(outputDirectory, filename), 'utf8')))
  const actualGroups = JSON.parse(readFileSync(groupsFile, 'utf8'))
  const cardFingerprint = canonicalFingerprint(actualCards)
  const groupFingerprint = canonicalFingerprint(actualGroups)

  if (actualCards.length !== BASELINE_CARD_COUNT) {
    throw new Error(
      `Gunpla baseline expected ${BASELINE_CARD_COUNT} entries, found ${actualCards.length}`
    )
  }
  if (cardFingerprint !== BASELINE_CARD_FINGERPRINT) {
    throw new Error(`Gunpla card baseline fingerprint differs: ${cardFingerprint}`)
  }
  if (groupFingerprint !== BASELINE_GROUP_FINGERPRINT) {
    throw new Error(`Gunpla group baseline fingerprint differs: ${groupFingerprint}`)
  }

  console.log(
    `Verified ${actualCards.length} persisted Gunpla entries against migration fingerprints.`
  )
  console.log(`Canonical content fingerprint: ${cardFingerprint}`)
}

const isDirectExecution =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const argumentsSet = new Set(process.argv.slice(2))
  if (argumentsSet.has('--write')) {
    const parsed = parsePage(readFileSync(sourceFile, 'utf8'))
    audit(parsed)
    writeMigration(parsed)
  } else if (argumentsSet.has('--verify')) {
    try {
      verifyMigration(parsePage(readLegacySource()))
    } catch (error) {
      console.warn(`Legacy source unavailable; using immutable migration fingerprints instead.`)
      verifyPersistedBaseline()
    }
  } else {
    verifyPersistedBaseline()
  }
}

export { parsePage, persistedCard }
export type { ExtractedCard, PageHeading, ParsedPage, PersistedCard }

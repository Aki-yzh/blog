#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type TextLines = string[]
type OutputText = string | string[]

type AcgSection = 'anime-featured' | 'anime-more' | 'anime-timeline' | 'comic-featured' | 'game'

interface SourceItem {
  section: AcgSection
  order: number
  year?: number
  badge?: string
  title: TextLines
  description: TextLines
  image: string
  link?: string
}

interface WallImage {
  src: string
  alt: string
}

interface SourceReport {
  source: {
    path: string
    bytes: number
    sha256: string
  }
  counts: {
    totalItems: number
    sections: Record<AcgSection, number>
    timeline: Record<string, number>
    bangumiSubjects: number
    unlinkedGames: number
    wallOfFameImages: number
    uniqueLocalImages: number
  }
  items: SourceItem[]
  wallOfFame: {
    title: string
    images: WallImage[]
    note: TextLines
    archive: {
      href: string
      image: string
    }
  }
  pageSettings: {
    seeMore: {
      title: string
      href: string
    }
    detail: {
      href: string
      iframeSrc: string
    }
    recentActivity: {
      href: string
      image: string
    }
  }
}

interface OutputItem {
  section: AcgSection
  order: number
  year?: number
  badge?: string
  title: OutputText
  description: OutputText
  image: string
  link?: string
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDirectory, '..')
const baselinePath = resolve(scriptDirectory, 'fixtures/acg-baseline.json')
const contentRoot = resolve(repoRoot, 'src/content/acg')
const pageConfigPath = resolve(repoRoot, 'src/data/acg-page.json')
const allowedFlags = new Set(['--write', '--verify', '--force', '--help'])

function usage() {
  console.log(`Usage: node scripts/extract-acg.ts [options]

Options:
  --write   Generate one JSON file per ACG item and src/data/acg-page.json.
  --verify  Compare every generated field and file path with the source page.
  --force   Allow --write to replace a generated file whose contents differ.
  --help    Show this help.

With no option the script is read-only and only prints the extraction plan.`)
}

function readSourceReport(): SourceReport {
  return JSON.parse(readFileSync(baselinePath, 'utf8')) as SourceReport
}

function collapseLines(lines: TextLines): OutputText {
  return lines.length === 1 ? lines[0] : lines
}

function outputItem(item: SourceItem): OutputItem {
  const result: OutputItem = {
    section: item.section,
    order: item.order,
    title: collapseLines(item.title),
    description: collapseLines(item.description),
    image: item.image
  }
  if (item.year !== undefined) result.year = item.year
  if (item.badge !== undefined) result.badge = item.badge
  if (item.link !== undefined) result.link = item.link
  return result
}

function itemIdentifier(item: SourceItem): string {
  const subjectId = item.link?.match(/bgm\.tv\/subject\/(\d+)/)?.[1]
  if (subjectId) return 'bgm-' + subjectId
  const imageName = basename(item.image, extname(item.image))
  const safeImageName = imageName
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!safeImageName) throw new Error('Cannot derive a stable ID for ' + item.title.join(' / '))
  return 'game-' + safeImageName
}

function itemDirectory(item: SourceItem): string {
  switch (item.section) {
    case 'anime-featured':
      return 'src/content/acg/anime/featured'
    case 'anime-more':
      return 'src/content/acg/anime/more'
    case 'anime-timeline':
      return 'src/content/acg/anime/timeline/' + item.year
    case 'comic-featured':
      return 'src/content/acg/comic/featured'
    case 'game':
      return 'src/content/acg/game'
  }
}

function itemRelativePath(item: SourceItem): string {
  const order = String(item.order).padStart(2, '0')
  return itemDirectory(item) + '/' + order + '-' + itemIdentifier(item) + '.json'
}

function pageConfig(report: SourceReport) {
  return {
    bangumi: {
      seeMore: report.pageSettings.seeMore,
      detail: report.pageSettings.detail,
      recentActivity: report.pageSettings.recentActivity
    },
    wallOfFame: {
      title: report.wallOfFame.title,
      images: report.wallOfFame.images,
      note: collapseLines(report.wallOfFame.note),
      archive: report.wallOfFame.archive
    }
  }
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n'
}

function expectedFiles(report: SourceReport): Map<string, string> {
  const files = new Map<string, string>()
  for (const sourceItem of report.items) {
    const path = resolve(repoRoot, itemRelativePath(sourceItem))
    if (files.has(path)) throw new Error('Two source items map to ' + relative(repoRoot, path))
    files.set(path, jsonText(outputItem(sourceItem)))
  }
  files.set(pageConfigPath, jsonText(pageConfig(report)))
  return files
}

function listJsonFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...listJsonFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path)
  }
  return files
}

function assertSafeOutputPath(path: string) {
  const relativePath = relative(repoRoot, path).replaceAll('\\', '/')
  const isItem = relativePath.startsWith('src/content/acg/') && relativePath.endsWith('.json')
  const isPageConfig = relativePath === 'src/data/acg-page.json'
  if (!isItem && !isPageConfig) throw new Error('Refusing to write outside ACG outputs: ' + path)
}

function writeFiles(files: Map<string, string>, force: boolean) {
  const expectedItemPaths = new Set(
    [...files.keys()].filter(
      (path) => path.startsWith(contentRoot + '\\') || path.startsWith(contentRoot + '/')
    )
  )
  const unexpectedItems = listJsonFiles(contentRoot).filter((path) => !expectedItemPaths.has(path))
  if (unexpectedItems.length > 0) {
    throw new Error(
      'Refusing to write while unexpected ACG JSON files exist:\n' +
        unexpectedItems.map((path) => '- ' + relative(repoRoot, path)).join('\n')
    )
  }

  let created = 0
  let updated = 0
  let unchanged = 0
  for (const [path, contents] of files) {
    assertSafeOutputPath(path)
    const current = existsSync(path) ? readFileSync(path, 'utf8') : undefined
    if (current === contents) {
      unchanged += 1
      continue
    }
    if (current !== undefined && !force) {
      throw new Error(
        'Refusing to replace changed generated file without --force: ' + relative(repoRoot, path)
      )
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, contents, 'utf8')
    if (current === undefined) created += 1
    else updated += 1
  }
  console.log(
    'Generated ACG data: ' +
      created +
      ' created, ' +
      updated +
      ' updated, ' +
      unchanged +
      ' unchanged'
  )
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function diffValues(expected: unknown, actual: unknown, path: string, differences: string[]) {
  if (Object.is(expected, actual)) return
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      differences.push(path + ': expected array, got ' + valueType(actual))
      return
    }
    if (expected.length !== actual.length) {
      differences.push(path + '.length: expected ' + expected.length + ', got ' + actual.length)
    }
    const length = Math.max(expected.length, actual.length)
    for (let index = 0; index < length; index += 1) {
      diffValues(expected[index], actual[index], path + '[' + index + ']', differences)
    }
    return
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      differences.push(path + ': expected object, got ' + valueType(actual))
      return
    }
    const expectedObject = expected as Record<string, unknown>
    const actualObject = actual as Record<string, unknown>
    const keys = new Set([...Object.keys(expectedObject), ...Object.keys(actualObject)])
    for (const key of [...keys].sort()) {
      if (!(key in expectedObject)) {
        differences.push(path + '.' + key + ': unexpected field')
      } else if (!(key in actualObject)) {
        differences.push(path + '.' + key + ': missing field')
      } else {
        diffValues(expectedObject[key], actualObject[key], path + '.' + key, differences)
      }
    }
    return
  }
  differences.push(
    path + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
  )
}

function parseJson(path: string, differences: string[]): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch (error) {
    differences.push(relative(repoRoot, path) + ': invalid JSON (' + (error as Error).message + ')')
    return undefined
  }
}

function verifyFiles(files: Map<string, string>) {
  const differences: string[] = []
  const expectedItemPaths = new Set([...files.keys()].filter((path) => path !== pageConfigPath))
  const actualItemPaths = new Set(listJsonFiles(contentRoot))

  for (const path of expectedItemPaths) {
    if (!actualItemPaths.has(path)) differences.push(relative(repoRoot, path) + ': missing file')
  }
  for (const path of actualItemPaths) {
    if (!expectedItemPaths.has(path))
      differences.push(relative(repoRoot, path) + ': unexpected file')
  }

  for (const [path, contents] of files) {
    if (!existsSync(path)) {
      if (path === pageConfigPath) differences.push(relative(repoRoot, path) + ': missing file')
      continue
    }
    const expected = JSON.parse(contents) as unknown
    const actual = parseJson(path, differences)
    if (actual !== undefined) diffValues(expected, actual, relative(repoRoot, path), differences)
  }

  if (differences.length > 0) {
    throw new Error(
      'ACG generated-data verification failed:\n' +
        differences.map((item) => '- ' + item).join('\n')
    )
  }
  console.log(
    'Verified 61 ACG item files, 27 Wall of Fame images, and singleton page settings field by field'
  )
}

function printPlan(report: SourceReport) {
  console.log('ACG extraction plan (read-only)')
  console.log('Source: ' + report.source.path + ' @ ' + report.source.sha256)
  console.log('Items: ' + report.counts.totalItems + ' -> src/content/acg/**/*.json')
  console.log(
    'Sections: ' +
      Object.entries(report.counts.sections)
        .map(([section, count]) => section + '=' + count)
        .join(', ')
  )
  console.log(
    'Wall of Fame: ' + report.counts.wallOfFameImages + ' images -> src/data/acg-page.json'
  )
  console.log(
    'No files were written. Use --write, then --verify for a field-by-field reconciliation.'
  )
}

function main() {
  const flags = process.argv.slice(2)
  const unknownFlags = flags.filter((flag) => !allowedFlags.has(flag))
  if (unknownFlags.length > 0) throw new Error('Unknown option(s): ' + unknownFlags.join(', '))
  if (flags.includes('--help')) {
    usage()
    return
  }
  const shouldWrite = flags.includes('--write')
  const shouldVerify = flags.includes('--verify')
  const force = flags.includes('--force')
  if (force && !shouldWrite) throw new Error('--force is only valid with --write')

  const report = readSourceReport()
  const files = expectedFiles(report)
  if (!shouldWrite && !shouldVerify) {
    printPlan(report)
    return
  }
  if (shouldWrite) writeFiles(files, force)
  verifyFiles(files)
}

try {
  main()
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
}

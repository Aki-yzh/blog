#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(repoRoot, 'src/pages/ACG/index.astro')
const readsFromStdin = process.argv.includes('--stdin')
const sourceBuffer = readsFromStdin ? readFileSync(0) : readFileSync(sourcePath)
const source = sourceBuffer.toString('utf8')
const problems = []

const expectedSectionCounts = {
  'anime-featured': 2,
  'anime-more': 7,
  'anime-timeline': 28,
  'comic-featured': 2,
  game: 22
}

const expectedTimelineCounts = {
  2025: 3,
  2024: 2,
  2023: 5,
  2022: 5,
  2021: 6,
  2020: 3,
  2019: 2,
  2018: 2
}

function check(condition, message) {
  if (!condition) problems.push(message)
}

function sliceBetween(text, startMarker, endMarker, from = 0) {
  const start = text.indexOf(startMarker, from)
  const end = start < 0 ? -1 : text.indexOf(endMarker, start + startMarker.length)
  if (start < 0 || end < 0) {
    throw new Error('Missing ACG source boundary: ' + startMarker + ' -> ' + endMarker)
  }
  return text.slice(start, end)
}

function getAttribute(tag, name) {
  const expression = new RegExp('\\b' + name + '\\s*=\\s*(["\\\'])(.*?)\\1', 'i')
  return tag.match(expression)?.[2]
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
}

function textLines(fragment) {
  return fragment
    .replace(/<br\s*\/?\s*>/gi, '\u0000')
    .replace(/<[^>]+>/g, '')
    .split('\u0000')
    .map((line) => decodeEntities(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function paragraphs(fragment) {
  return [...fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => textLines(match[1]))
}

function imageSources(fragment) {
  return [...fragment.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2])
}

function linkedCards(block) {
  return [...block.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)].map(
    (match) => ({ link: match[2], markup: match[3] })
  )
}

function extractFeatured(block, section) {
  return linkedCards(block).map((card, index) => {
    const cardParagraphs = paragraphs(card.markup)
    const images = imageSources(card.markup)
    check(
      cardParagraphs.length === 3,
      section + ' item ' + (index + 1) + ' must have 3 text fields'
    )
    check(images.length === 2, section + ' item ' + (index + 1) + ' must render its image twice')
    check(images[0] === images[1], section + ' item ' + (index + 1) + ' image pair differs')
    return {
      section,
      order: index + 1,
      badge: cardParagraphs[0]?.join(' ') ?? '',
      title: cardParagraphs[1] ?? [],
      description: cardParagraphs[2] ?? [],
      image: images[0] ?? '',
      link: card.link
    }
  })
}

function extractCompact(block, section, extra = {}) {
  return linkedCards(block).map((card, index) => {
    const cardParagraphs = paragraphs(card.markup)
    const images = imageSources(card.markup)
    check(
      cardParagraphs.length === 2,
      section + ' item ' + (index + 1) + ' must have 2 text fields'
    )
    check(images.length === 2, section + ' item ' + (index + 1) + ' must render its image twice')
    check(images[0] === images[1], section + ' item ' + (index + 1) + ' image pair differs')
    return {
      section,
      ...extra,
      order: index + 1,
      title: cardParagraphs[0] ?? [],
      description: cardParagraphs[1] ?? [],
      image: images[0] ?? '',
      link: card.link
    }
  })
}

const firstFeaturedGrid = '<div class="animate grid grid-cols-2 gap-2 w-full">'
const animeFeaturedBlock = sliceBetween(source, firstFeaturedGrid, '<Collapse title="Want more?">')
const animeMoreBlock = sliceBetween(source, '<Collapse title="Want more?">', "<h3 id='timeline'>")
const timelineBlock = sliceBetween(source, "<h3 id='timeline'>", "<h2 id='Comic'>")
const comicHeading = source.indexOf("<h2 id='Comic'>")
const comicGrid = source.indexOf(firstFeaturedGrid, comicHeading)
const comicBlock = sliceBetween(source, firstFeaturedGrid, "<h2 id='Game'>", comicGrid)
const gameBlock = sliceBetween(source, "<h2 id='Game'>", '<Collapse title="Wall of Fame"')
const wallBlock = sliceBetween(source, '<Collapse title="Wall of Fame"', "<h2 id='Detail'>")
const detailBlock = source.slice(source.indexOf("<h2 id='Detail'>"))

const items = []
items.push(...extractFeatured(animeFeaturedBlock, 'anime-featured'))
items.push(...extractCompact(animeMoreBlock, 'anime-more'))

for (const yearMatch of timelineBlock.matchAll(
  /<li\b[^>]*>[\s\S]*?<samp\b[^>]*>\s*(\d{4})\s*<\/samp>([\s\S]*?)<\/li>/gi
)) {
  const year = Number(yearMatch[1])
  items.push(...extractCompact(yearMatch[2], 'anime-timeline', { year }))
}

items.push(...extractFeatured(comicBlock, 'comic-featured'))

let currentLink
let currentForegroundImage
let currentGame
for (const line of gameBlock.split(/\r?\n/)) {
  const openingAnchor = line.match(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/i)
  if (openingAnchor) currentLink = openingAnchor[2]

  const foregroundImage = line.match(
    /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*class=(["'])[^"']*\bmy-0\b[^"']*\bbg-white\b[^"']*\3/i
  )
  if (foregroundImage) currentForegroundImage = foregroundImage[2]

  const title = line.match(/<p\b[^>]*class=(["'])[^"']*\btext-sm\b[^"']*\1[^>]*>([\s\S]*?)<\/p>/i)
  if (title) {
    currentGame = {
      section: 'game',
      order: items.filter((item) => item.section === 'game').length + 1,
      title: textLines(title[2]),
      description: [],
      image: currentForegroundImage ?? ''
    }
    if (currentLink) currentGame.link = currentLink
    items.push(currentGame)
    currentForegroundImage = undefined
  }

  const description = line.match(
    /<p\b[^>]*class=(["'])[^"']*\btext-xs\b[^"']*\1[^>]*>([\s\S]*?)<\/p>/i
  )
  if (description && currentGame && currentGame.description.length === 0) {
    currentGame.description = textLines(description[2])
  }

  const backgroundImage = line.match(
    /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*class=(["'])[^"']*\babsolute\b[^"']*\b-start-2\b[^"']*\3/i
  )
  if (backgroundImage && currentGame) {
    check(
      currentGame.image === backgroundImage[2],
      'game item ' + currentGame.order + ' image pair differs'
    )
  }

  if (line.includes('</a>')) currentLink = undefined
}

for (const item of items.filter((entry) => entry.section === 'game')) {
  check(item.title.length > 0, 'game item ' + item.order + ' has no title')
  check(item.description.length > 0, 'game item ' + item.order + ' has no description')
  check(item.image.length > 0, 'game item ' + item.order + ' has no image')
}

const sectionCounts = Object.fromEntries(
  Object.keys(expectedSectionCounts).map((section) => [
    section,
    items.filter((item) => item.section === section).length
  ])
)
for (const [section, count] of Object.entries(expectedSectionCounts)) {
  check(
    sectionCounts[section] === count,
    section + ' count changed: expected ' + count + ', got ' + sectionCounts[section]
  )
}

const timelineCounts = Object.fromEntries(
  Object.keys(expectedTimelineCounts).map((year) => [
    year,
    items.filter((item) => item.section === 'anime-timeline' && item.year === Number(year)).length
  ])
)
for (const [year, count] of Object.entries(expectedTimelineCounts)) {
  check(
    timelineCounts[year] === count,
    'timeline ' + year + ' count changed: expected ' + count + ', got ' + timelineCounts[year]
  )
}

const subjectItems = items.filter((item) => item.link?.startsWith('https://bgm.tv/subject/'))
const subjectIds = []
for (const item of subjectItems) {
  const subjectId = item.link.match(/\/subject\/(\d+)/)?.[1]
  subjectIds.push(subjectId)
  check(
    Boolean(subjectId),
    item.section + ' item ' + item.order + ' has an invalid Bangumi subject link'
  )
  check(
    Boolean(subjectId && new RegExp('/' + subjectId + '[_\\.]').test(item.image)),
    item.section + ' item ' + item.order + ' subject/cover ID differs'
  )
}
check(subjectItems.length === 39, 'expected 39 Bangumi subject cards, got ' + subjectItems.length)
check(new Set(subjectIds).size === subjectIds.length, 'Bangumi subject IDs are not unique')

const placementKeys = items.map((item) => item.section + ':' + (item.year ?? '') + ':' + item.order)
check(
  new Set(placementKeys).size === placementKeys.length,
  'duplicate section/year/order placement found'
)
check(new Set(items.map((item) => item.image)).size === 61, 'card image sources are not all unique')

const unlinkedGames = items.filter((item) => item.section === 'game' && !item.link)
check(
  unlinkedGames.length === 2,
  'expected 2 intentionally unlinked game cards, got ' + unlinkedGames.length
)
check(
  unlinkedGames.map((item) => item.title.join('')).join('|') === 'LL SIF|SD高达：激斗同盟',
  'the intentionally unlinked game cards changed'
)

const localImageMatches = [
  ...source.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])\/images\/([^"']+)\1/gi)
]
const localImageNames = [...new Set(localImageMatches.map((match) => match[2]))].sort()
const actualImageNames = new Set(readdirSync(resolve(repoRoot, 'public/images')))
const missingOrCaseMismatchedImages = localImageNames.filter((name) => !actualImageNames.has(name))
check(
  localImageNames.length === 50,
  'expected 50 unique local ACG image references, got ' + localImageNames.length
)
check(
  missingOrCaseMismatchedImages.length === 0,
  'missing or case-mismatched local images: ' + missingOrCaseMismatchedImages.join(', ')
)
for (const name of localImageNames) {
  check(existsSync(resolve(repoRoot, 'public/images', name)), 'missing local image: ' + name)
}

const wallImages = [...wallBlock.matchAll(/<img\b[^>]*>/gi)]
  .map((match) => ({
    src: getAttribute(match[0], 'src') ?? '',
    alt: getAttribute(match[0], 'alt') ?? ''
  }))
  .filter((image) => image.src !== '/images/github.png')
check(wallImages.length === 27, 'expected 27 Wall of Fame images, got ' + wallImages.length)

const wallParagraphs = paragraphs(wallBlock)
const wallArchiveAnchor = linkedCards(wallBlock).find((card) =>
  card.link.startsWith('https://github.com/')
)
const wallArchiveImages = wallArchiveAnchor ? imageSources(wallArchiveAnchor.markup) : []
check(wallParagraphs.length === 1, 'expected one Wall of Fame note')
check(Boolean(wallArchiveAnchor), 'Wall of Fame archive link is missing')
check(wallArchiveImages.length === 2, 'Wall of Fame archive image must render twice')
check(wallArchiveImages[0] === wallArchiveImages[1], 'Wall of Fame archive image pair differs')

const wallOfFame = {
  title: 'Wall of Fame',
  images: wallImages,
  note: wallParagraphs[0] ?? [],
  archive: {
    href: wallArchiveAnchor?.link ?? '',
    image: wallArchiveImages[0] ?? ''
  }
}

const seeMoreTag = animeMoreBlock.match(/<Button\b[\s\S]*?\/>/i)?.[0] ?? ''
const detailIframeTag = detailBlock.match(/<iframe\b[^>]*>/i)?.[0] ?? ''
const detailLinkTag = [...detailBlock.matchAll(/<a\b[^>]*>/gi)].find(
  (match) => getAttribute(match[0], 'href') === 'https://bgm.tv/anime/list/aki_yzh/collect'
)?.[0]
const activityImageTag =
  detailBlock.match(/<img\b[^>]*src="http:\/\/bgm\.tv\/chart\/img\/762491"[^>]*>/i)?.[0] ?? ''
const activityAnchorTag = activityImageTag
  ? detailBlock.slice(0, detailBlock.indexOf(activityImageTag)).match(/<a\b[^>]*>\s*$/i)?.[0] ?? ''
  : ''

const pageSettings = {
  seeMore: {
    title: getAttribute(seeMoreTag, 'title') ?? '',
    href: getAttribute(seeMoreTag, 'href') ?? ''
  },
  detail: {
    href: detailLinkTag ? getAttribute(detailLinkTag, 'href') ?? '' : '',
    iframeSrc: getAttribute(detailIframeTag, 'src') ?? ''
  },
  recentActivity: {
    href: getAttribute(activityAnchorTag, 'href') ?? '',
    image: getAttribute(activityImageTag, 'src') ?? ''
  }
}
check(
  pageSettings.detail.href === pageSettings.detail.iframeSrc,
  'Detail link and iframe URL differ'
)
check(pageSettings.seeMore.href.endsWith('?orderby=rate'), 'See More Bangumi link changed')
check(
  pageSettings.recentActivity.image === 'http://bgm.tv/chart/img/762491',
  'Recent Activities image changed'
)

const report = {
  source: {
    path: readsFromStdin ? 'stdin:src/pages/ACG/index.astro' : 'src/pages/ACG/index.astro',
    bytes: sourceBuffer.length,
    sha256: createHash('sha256').update(sourceBuffer).digest('hex')
  },
  counts: {
    totalItems: items.length,
    sections: sectionCounts,
    timeline: timelineCounts,
    bangumiSubjects: subjectItems.length,
    unlinkedGames: unlinkedGames.length,
    wallOfFameImages: wallImages.length,
    uniqueLocalImages: localImageNames.length
  },
  items,
  wallOfFame,
  pageSettings
}

if (problems.length > 0) {
  console.error('ACG source audit failed:')
  for (const problem of problems) console.error('- ' + problem)
  process.exitCode = 1
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('ACG source audit passed')
  console.log('Source SHA256: ' + report.source.sha256)
  console.log('Cards: ' + report.counts.totalItems + ' (39 Bangumi + 22 games)')
  console.log(
    'Timeline: ' +
      Object.entries(timelineCounts)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([year, count]) => year + '=' + count)
        .join(', ')
  )
  console.log('Wall of Fame: ' + wallImages.length + ' images')
  console.log(
    'Local image references: ' + localImageNames.length + ' unique, all present with exact case'
  )
  console.log('Run with --json to print the normalized migration baseline.')
}

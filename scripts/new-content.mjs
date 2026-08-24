#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = resolve(repoRoot, 'src/content')
const contentType = process.argv[2]
const helpRequested = process.argv.includes('--help') || process.argv.includes('-h')

const gunplaGroupsManifest = JSON.parse(
  readFileSync(resolve(repoRoot, 'src/data/gunpla-groups.json'), 'utf8')
)
const gunplaParentGroups = new Set(
  gunplaGroupsManifest.groups.flatMap((group) => (group.parent ? [group.parent] : []))
)
const gunplaGroups = gunplaGroupsManifest.groups
  .filter((group) => !gunplaParentGroups.has(group.key))
  .map((group) => group.key)

if (gunplaGroups.length === 0) throw new Error('Gunpla 分组清单中没有可用的叶子分组')

const acgSections = ['anime-featured', 'anime-more', 'anime-timeline', 'comic-featured', 'game']

function usage() {
  console.log(`新增内容向导

用法：
  bun run content:new gunpla
  bun run content:new acg
  bun run content:new publication

向导只会新建 JSON，不会覆盖已有内容。标题或简介需要换行时，请输入字面量 \\n。`)
}

function readJsonFiles(root) {
  if (!existsSync(root)) return []
  const values = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) values.push(...readJsonFiles(path))
    if (entry.isFile() && entry.name.endsWith('.json')) {
      values.push(JSON.parse(readFileSync(path, 'utf8')))
    }
  }
  return values
}

function nextOrder(items, predicate = () => true) {
  const orders = items.filter(predicate).map((item) => item.order)
  return Math.max(0, ...orders) + 1
}

function normalizedSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function splitTextLines(value) {
  const lines = value.split('\\n').map((line) => line.trim())
  return lines.length === 1 ? lines[0] : lines
}

function assertHttpUrl(value, label) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label}不是有效链接：${value}`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label}只支持 http/https 链接`)
  }
  return value
}

function writeNewJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  console.log(`\n已创建：${path.slice(repoRoot.length + 1)}`)
  console.log('请检查图片路径后运行：bun run content:check')
}

const cli = createInterface({ input, output })

async function askRequired(label) {
  while (true) {
    const answer = (await cli.question(`${label}：`)).trim()
    if (answer) return answer
    console.log(`${label}不能为空`)
  }
}

async function askOptional(label) {
  return (await cli.question(`${label}（可空）：`)).trim()
}

async function askChoice(label, choices) {
  console.log(`\n${label}：`)
  choices.forEach((choice, index) => console.log(`  ${index + 1}. ${choice}`))
  while (true) {
    const index = Number.parseInt((await cli.question('请输入序号：')).trim(), 10) - 1
    if (choices[index]) return choices[index]
    console.log(`请输入 1-${choices.length}`)
  }
}

async function askImageList(label) {
  console.log(`\n${label}（每行一张，空行结束）：`)
  const images = []
  while (true) {
    const image = (await cli.question(`  ${images.length + 1}> `)).trim()
    if (!image && images.length > 0) return images
    if (!image) {
      console.log('至少需要一张图片')
      continue
    }
    images.push(image)
  }
}

async function askSlug() {
  while (true) {
    const slug = normalizedSlug(await askRequired('文件标识（英文/数字，如 aerial-rebuild）'))
    if (slug) return slug
    console.log('文件标识至少要包含一个英文字母或数字')
  }
}

async function createGunpla() {
  const root = resolve(contentRoot, 'gunpla')
  const items = readJsonFiles(root)
  const order = nextOrder(items)
  const slug = await askSlug()
  const group = await askChoice('分组', gunplaGroups)
  const officialImages = await askImageList('官方图')
  const myImages = await askImageList('实物图')
  const name = await askRequired('名称')
  const releasePrice = await askRequired('万代发售价（原样填写，如 4,500日元）')
  const brand = await askRequired('品牌')
  const purchasePrice = await askRequired('购入价')
  const link78 = assertHttpUrl(await askRequired('78动漫详情链接'), '78动漫详情链接')
  const review = await askRequired('简评')
  const filename = `${String(order).padStart(3, '0')}-${slug}.json`

  writeNewJson(resolve(root, filename), {
    order,
    group,
    officialImages,
    myImages,
    name,
    releasePrice,
    brand,
    purchasePrice,
    link78,
    review
  })
}

function acgDirectory(section, year) {
  if (section === 'anime-featured') return 'anime/featured'
  if (section === 'anime-more') return 'anime/more'
  if (section === 'anime-timeline') return `anime/timeline/${year}`
  if (section === 'comic-featured') return 'comic/featured'
  return 'game'
}

async function createAcg() {
  const root = resolve(contentRoot, 'acg')
  const items = readJsonFiles(root)
  const section = await askChoice('栏目', acgSections)
  let year
  if (section === 'anime-timeline') {
    year = Number.parseInt(await askRequired('年份'), 10)
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('年份无效')
  }
  const order = nextOrder(
    items,
    (item) => item.section === section && (section !== 'anime-timeline' || item.year === year)
  )
  const slug = await askSlug()
  const title = splitTextLines(await askRequired('标题'))
  const description = splitTextLines(await askRequired('简介'))
  const image = await askRequired('图片 URL 或 /images/... 路径')
  let badge
  if (section === 'anime-featured' || section === 'comic-featured') {
    badge = await askRequired('推荐标签')
  }
  const rawLink =
    section === 'game' ? await askOptional('详情链接') : await askRequired('Bangumi 详情链接')
  const link = rawLink ? assertHttpUrl(rawLink, '详情链接') : undefined
  const filename = `${String(order).padStart(2, '0')}-${slug}.json`
  const item = { section, order, title, description, image }
  if (year !== undefined) item.year = year
  if (badge !== undefined) item.badge = badge
  if (link !== undefined) item.link = link

  writeNewJson(resolve(root, acgDirectory(section, year), filename), item)
}

async function createPublication() {
  const root = resolve(contentRoot, 'publications')
  const items = readJsonFiles(root)
  const order = nextOrder(items)
  const slug = await askSlug()
  const title = await askRequired('论文标题')
  const authors = await askRequired('作者（本人可用 <strong>姓名</strong>）')
  const publication = await askRequired('会议/期刊')
  const year = Number.parseInt(await askRequired('年份'), 10)
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('年份无效')
  const rawLink = await askOptional('论文链接')
  const link = rawLink ? assertHttpUrl(rawLink, '论文链接') : undefined
  const item = { title, authors, publication, year, order }
  if (link !== undefined) item.link = link

  writeNewJson(resolve(root, `${slug}.json`), item)
}

async function main() {
  if (helpRequested || !contentType) {
    usage()
    return
  }
  if (contentType === 'gunpla') return createGunpla()
  if (contentType === 'acg') return createAcg()
  if (contentType === 'publication') return createPublication()
  throw new Error(`未知内容类型：${contentType}`)
}

try {
  await main()
} catch (error) {
  console.error(`\n创建失败：${error.message}`)
  process.exitCode = 1
} finally {
  cli.close()
}

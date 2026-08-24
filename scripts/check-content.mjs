#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  throw new Error(`内容检查失败：${message}`)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${relative(repoRoot, path)} 不是有效 JSON：${error.message}`)
  }
}

function readEntries(root) {
  if (!existsSync(root)) fail(`缺少目录 ${relative(repoRoot, root)}`)
  const entries = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) entries.push(...readEntries(path))
    if (entry.isFile() && entry.name.endsWith('.json')) {
      entries.push({ path, data: readJson(path) })
    }
  }
  return entries
}

function assertUnique(entries, keyFor, label) {
  const seen = new Map()
  for (const entry of entries) {
    const key = keyFor(entry.data)
    if (seen.has(key)) {
      fail(
        `${label} ${JSON.stringify(key)} 重复：${relative(repoRoot, seen.get(key))} 与 ${relative(repoRoot, entry.path)}`
      )
    }
    seen.set(key, entry.path)
  }
}

const manifestPath = resolve(repoRoot, 'src/data/gunpla-groups.json')
const manifest = readJson(manifestPath)
if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
  fail('Gunpla 分组清单必须包含非空 groups 数组')
}

const groupKeys = new Set()
const groupOrders = new Set()
for (const group of manifest.groups) {
  if (groupKeys.has(group.key)) fail(`Gunpla 分组 key 重复：${group.key}`)
  if (groupOrders.has(group.order)) fail(`Gunpla 分组 order 重复：${group.order}`)
  groupKeys.add(group.key)
  groupOrders.add(group.order)
}
for (const group of manifest.groups) {
  if (group.parent !== null && !groupKeys.has(group.parent)) {
    fail(`Gunpla 分组 ${group.key} 指向不存在的 parent：${group.parent}`)
  }
}

const parentGroups = new Set(
  manifest.groups.flatMap((group) => (group.parent ? [group.parent] : []))
)
const leafGroups = new Set(
  manifest.groups.filter((group) => !parentGroups.has(group.key)).map((group) => group.key)
)

const gunpla = readEntries(resolve(repoRoot, 'src/content/gunpla'))
assertUnique(gunpla, (item) => item.order, 'Gunpla order')
for (const { path, data } of gunpla) {
  if (!leafGroups.has(data.group)) {
    fail(`${relative(repoRoot, path)} 使用了未知或非叶子分组：${data.group}`)
  }
}

const publications = readEntries(resolve(repoRoot, 'src/content/publications'))
assertUnique(publications, (item) => item.order, '论文 order')

const acg = readEntries(resolve(repoRoot, 'src/content/acg'))
assertUnique(
  acg,
  (item) =>
    `${item.section}/${item.section === 'anime-timeline' ? item.year : 'all'}/${item.order}`,
  'ACG 栏目内 order'
)

console.log(
  `内容检查通过：${gunpla.length} 条 Gunpla、${acg.length} 条 ACG、${publications.length} 篇论文；排序与分组无冲突。`
)

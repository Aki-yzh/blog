import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createContentSchemas } from '../../src/content-schemas.mjs'

export class ContentError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
const fail = (message, status = 400) => {
  throw new ContentError(message, status)
}
const revision = (raw) => createHash('sha256').update(raw).digest('hex')
const kinds = ['gunpla', 'acg', 'publications']
const acgFolders = {
  'anime-featured': 'anime/featured',
  'anime-more': 'anime/more',
  'anime-timeline': 'anime/timeline',
  'comic-featured': 'comic/featured',
  game: 'game'
}
const imageTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
}

/** Reject traversal, Windows special paths, and symlink/junction escapes, including existing parents of new paths. */
export function safePath(root, name) {
  if (
    typeof name !== 'string' ||
    !name ||
    name.includes('\\') ||
    name.includes('\0') ||
    isAbsolute(name)
  )
    fail('无效文件路径')
  const parts = name.split('/')
  if (
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..' ||
        /[:*?"<>|]/.test(part) ||
        /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)
    )
  )
    fail('无效文件路径')
  const base = resolve(root)
  const target = resolve(base, ...parts)
  const rel = relative(base, target)
  if (rel.startsWith('..' + sep) || rel === '..' || isAbsolute(rel)) fail('文件超出允许目录')
  // Inspect the root's ancestors too: a symlinked content/images/backup root is not a safe write target.
  let current = target
  while (true) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      fail('不允许访问符号链接或目录联接')
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return target
}

export function createContentStore(repoRoot) {
  const root = realpathSync(repoRoot)
  const contentRoot = resolve(root, 'src/content')
  const imagesRoot = resolve(root, 'public/images')
  function groups() {
    return JSON.parse(readFileSync(safePath(root, 'src/data/gunpla-groups.json'), 'utf8')).groups
  }
  function assertKind(kind) {
    if (!kinds.includes(kind)) fail('未知内容类型')
  }
  function pathFor(kind, id) {
    assertKind(kind)
    if (typeof id !== 'string' || !id.endsWith('.json')) fail('内容文件必须为 JSON')
    return safePath(contentRoot, kind + '/' + id)
  }
  function read(kind, id) {
    const path = pathFor(kind, id)
    if (!existsSync(path)) fail('条目不存在，请刷新列表', 404)
    const raw = readFileSync(path, 'utf8')
    return { kind, id, revision: revision(raw), data: JSON.parse(raw) }
  }
  function list(kind) {
    assertKind(kind)
    const base = safePath(contentRoot, kind)
    function walk(folder, prefix = '') {
      if (!existsSync(folder)) return []
      return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isSymbolicLink()) fail('内容目录含符号链接，已停止读取')
        const id = prefix + entry.name
        const path = safePath(base, id)
        if (entry.isDirectory()) return walk(path, id + '/')
        return entry.isFile() && entry.name.endsWith('.json') ? [read(kind, id)] : []
      })
    }
    return walk(base).sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
  }
  function scope(kind, data) {
    return kind === 'acg'
      ? data.section + '/' + (data.section === 'anime-timeline' ? data.year : 'all')
      : kind
  }
  function validate(kind, data) {
    assertKind(kind)
    const result = createContentSchemas(groups())[kind].safeParse(data)
    if (!result.success)
      fail(
        result.error.issues.map((issue) => issue.path.join('.') + '：' + issue.message).join('\n')
      )
    // Return the original object, not transformed/stripped output: never silently drop existing fields.
    for (const key of ['link', 'link78']) {
      if (data[key] && !/^https?:\/\//i.test(data[key])) fail(key + ' 只允许 http/https 链接')
    }
    for (const image of imageRefs(data)) {
      if (image.startsWith('/images/')) safePath(imagesRoot, decodeURIComponent(image.slice(8)))
      else if (!/^https?:\/\//i.test(image)) fail('图片须为 /images/... 或 http/https URL')
      else {
        try {
          new URL(image)
        } catch {
          fail('无效图片 URL')
        }
      }
    }
    return data
  }
  function imageRefs(data) {
    return [
      ...(data.officialImages || []),
      ...(data.myImages || []),
      ...(data.image ? [data.image] : [])
    ]
  }
  function warnings(data) {
    return [...new Set(imageRefs(data))].flatMap((image) => {
      if (!image.startsWith('/images/')) return []
      return existsSync(safePath(imagesRoot, decodeURIComponent(image.slice(8))))
        ? []
        : ['本地图片不存在：' + image]
    })
  }
  function save({ kind, id, slug, revision: expected, data }) {
    validate(kind, data)
    const entries = list(kind)
    const existing = id ? read(kind, id) : null
    if (existing && existing.revision !== expected)
      fail('文件已被其他窗口或编辑器修改。请先刷新并重新编辑，未覆盖任何内容。', 409)
    if (
      entries.some(
        (entry) =>
          entry.id !== id &&
          scope(kind, entry.data) === scope(kind, data) &&
          entry.data.order === data.order
      )
    )
      fail('排序值 order 已被占用，请选择空闲数字（只修改当前条目，不自动重排其他内容）', 409)
    let targetId = id
    if (!existing) {
      if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
        fail('文件标识请使用小写英文、数字和连字符，最多 100 字符')
      const folder =
        kind === 'acg'
          ? acgFolders[data.section] +
            (data.section === 'anime-timeline' ? '/' + data.year : '') +
            '/'
          : ''
      targetId = folder + slug + '.json'
    }
    const target = pathFor(kind, targetId)
    const serialized = JSON.stringify(data, null, 2) + '\n'
    const notices = warnings(data)
    if (existing && JSON.stringify(existing.data) === JSON.stringify(data))
      return { entry: existing, warnings: notices, unchanged: true }
    let backup
    if (existing) {
      // Back up exact bytes before replacing. The revision is checked again immediately before rename.
      const raw = readFileSync(target, 'utf8')
      if (revision(raw) !== expected) fail('文件已变化，未保存，请刷新', 409)
      backup =
        '.content-admin/backups/' +
        new Date().toISOString().replace(/[:.]/g, '-') +
        '-' +
        randomUUID() +
        '/' +
        kind +
        '/' +
        targetId
      const backupPath = safePath(root, backup)
      mkdirSync(dirname(backupPath), { recursive: true })
      writeFileSync(backupPath, raw, { flag: 'wx' })
      const temporary = safePath(contentRoot, kind + '/' + targetId + '.' + randomUUID() + '.tmp')
      const staging = safePath(contentRoot, kind + '/' + targetId + '.' + randomUUID() + '.old')
      try {
        writeFileSync(temporary, serialized, { flag: 'wx' })
        if (revision(readFileSync(target, 'utf8')) !== expected)
          fail('文件已变化，未保存，请刷新', 409)
        // Windows cannot rename over an existing file. Move the old bytes aside, then roll back if replacing fails.
        renameSync(target, staging)
        try {
          renameSync(temporary, target)
        } catch (error) {
          renameSync(staging, target)
          throw error
        }
        unlinkSync(staging)
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary)
        if (existsSync(staging) && !existsSync(target)) renameSync(staging, target)
      }
    } else {
      mkdirSync(dirname(target), { recursive: true })
      try {
        writeFileSync(target, serialized, { flag: 'wx' })
      } catch (error) {
        if (error.code === 'EEXIST') fail('同名文件已存在，未覆盖，请换一个文件标识', 409)
        throw error
      }
    }
    return { entry: read(kind, targetId), warnings: notices, backup }
  }
  function upload({ filename, base64 }) {
    if (
      typeof filename !== 'string' ||
      typeof base64 !== 'string' ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
    )
      fail('无效图片上传')
    const extension = extname(filename).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension))
      fail('只支持 JPG、PNG、GIF、WebP 图片')
    const bytes = Buffer.from(base64, 'base64')
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) fail('图片须在 10MB 以内')
    const signatures = {
      '.png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      '.jpg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      '.jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      '.gif': ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString()),
      '.webp':
        bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    }
    if (!signatures[extension]) fail('文件内容与图片格式不符')
    const id = 'uploads/' + new Date().toISOString().slice(0, 10) + '/' + randomUUID() + extension
    const target = safePath(imagesRoot, id)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes, { flag: 'wx' })
    return { path: '/images/' + id }
  }
  function image(path) {
    const target = safePath(imagesRoot, path)
    const type = imageTypes[extname(target).toLowerCase()]
    if (!type || !existsSync(target) || !lstatSync(target).isFile()) fail('图片不存在', 404)
    return { bytes: readFileSync(target), type }
  }
  return { groups, list, read, save, upload, image, warnings, kinds }
}

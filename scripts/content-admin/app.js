const $ = (selector) => document.querySelector(selector)
const state = {
  kind: 'gunpla',
  entries: {},
  groups: [],
  token: '',
  current: null,
  original: null,
  dirty: false,
  pending: 0
}
const labels = { gunpla: 'Gunpla', acg: 'ACG', publications: '论文' }
const sections = [
  ['anime-featured', '动画精选'],
  ['anime-more', '更多动画'],
  ['anime-timeline', '动画时间线'],
  ['comic-featured', '漫画精选'],
  ['game', '游戏']
]
const previewPaths = { gunpla: '/gunpla', acg: '/ACG', publications: '/projects' }
const sectionLabel = (value) => sections.find(([key]) => key === value)?.[1] || value
const groupLabel = (key) => {
  const groupsByKey = new Map(state.groups.map((group) => [group.key, group]))
  const labels = []
  const visited = new Set()
  let group = groupsByKey.get(key)
  while (group && !visited.has(group.key)) {
    visited.add(group.key)
    labels.unshift(group.text)
    group = group.parent ? groupsByKey.get(group.parent) : null
  }
  return labels.length ? labels.join('/') : key
}
const titleOf = (entry) => {
  const data = entry.data
  const value = data.name || data.title || '未命名'
  return Array.isArray(value) ? value.join(' ') : String(value).replace(/<[^>]+>/g, '')
}
const metaOf = (entry) =>
  entry.kind === 'gunpla'
    ? groupLabel(entry.data.group) + ' · ' + entry.data.brand
    : entry.kind === 'acg'
      ? sectionLabel(entry.data.section) + (entry.data.year ? ' · ' + entry.data.year : '')
      : entry.data.publication + ' · ' + entry.data.year
const request = async (url, options = {}) => {
  const response = await fetch(url, options)
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('管理服务返回了无法识别的内容')
  }
  if (!response.ok) throw new Error(body.error || '操作失败')
  return body
}
const notify = (message, error = false) => {
  const toast = $('#toast')
  toast.textContent = message
  toast.className = error ? 'show error' : 'show'
  clearTimeout(notify.timer)
  notify.timer = setTimeout(() => {
    toast.className = ''
  }, 4500)
}
const mayLeave = () => !state.dirty || confirm('当前修改尚未保存，确定要放弃吗？')
const nextOrder = (kind, data) => {
  const entries = state.entries[kind] || []
  const sameScope =
    kind !== 'acg'
      ? entries
      : entries.filter(
          (entry) =>
            entry.data.section === data.section &&
            (data.section !== 'anime-timeline' || entry.data.year === data.year)
        )
  return Math.max(0, ...sameScope.map((entry) => Number(entry.data.order) || 0)) + 1
}
const suggestSlug = (kind, data) => {
  if (kind === 'gunpla')
    return `${String(data.group)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${data.order}`
  if (kind === 'acg')
    return `${data.section}-${data.section === 'anime-timeline' ? `${data.year}-` : ''}${data.order}`
  return `paper-${data.year}-${data.order}`
}
const field = ({
  key,
  label,
  value = '',
  type = 'text',
  required = true,
  wide = false,
  options,
  hint,
  array = false,
  upload = false,
  textValue = false
}) => {
  const wrap = document.createElement('div')
  wrap.className = 'field' + (wide ? ' field-wide' : '')
  const labelElement = document.createElement('label')
  const id = 'field-' + key
  labelElement.htmlFor = id
  labelElement.textContent = label
  wrap.append(labelElement)
  let control
  if (type === 'textarea') {
    control = document.createElement('textarea')
    if (array) control.dataset.array = ''
    if (textValue) control.dataset.textValue = ''
    control.value = Array.isArray(value) ? value.join('\n') : value
  } else if (type === 'select') {
    control = document.createElement('select')
    for (const option of options) {
      const node = document.createElement('option')
      node.value = option[0]
      node.textContent = option[1]
      node.selected = option[0] === value
      control.append(node)
    }
  } else {
    control = document.createElement('input')
    control.type = type
    control.value = value ?? ''
    if (type === 'number') {
      control.min = key === 'year' ? '1900' : '1'
      control.step = '1'
    }
  }
  control.id = id
  control.name = key
  control.required = required
  control.dataset.initialValue = control.value
  wrap.append(control)
  if (upload) {
    const box = document.createElement('div')
    box.className = 'upload'
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.jpg,.jpeg,.png,.gif,.webp'
    input.id = 'upload-' + key
    const picker = document.createElement('label')
    picker.htmlFor = input.id
    picker.textContent = '上传本地图片'
    const status = document.createElement('span')
    status.className = 'hint'
    box.append(input, picker, status)
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 10 * 1024 * 1024) return notify('图片不能超过 10MB', true)
      state.pending++
      status.textContent = '正在上传…'
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const result = await request('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Content-Token': state.token },
          body: JSON.stringify({ filename: file.name, base64 })
        })
        control.value =
          array && control.value.trim() ? control.value.trimEnd() + '\n' + result.path : result.path
        control.dispatchEvent(new Event('input', { bubbles: true }))
        status.textContent = '已加入：' + result.path
      } catch (error) {
        status.textContent = ''
        notify(error.message, true)
      } finally {
        state.pending--
        input.value = ''
      }
    })
    wrap.append(box)
  }
  if (hint) {
    const note = document.createElement('span')
    note.className = 'hint'
    note.textContent = hint
    wrap.append(note)
  }
  return wrap
}
function leafGroups() {
  const parents = new Set(state.groups.flatMap((group) => (group.parent ? [group.parent] : [])))
  return state.groups.filter((group) => !parents.has(group.key))
}
function renderFields() {
  const data = state.current.data
  const container = $('#form-fields')
  container.replaceChildren()
  const add = (spec) => container.append(field({ value: data[spec.key], ...spec }))
  if (!state.current.id)
    add({
      key: 'slug',
      label: '文件标识',
      value: state.current.slug || '',
      required: true,
      hint: '小写英文、数字和连字符；只用于新文件名'
    })
  if (state.kind === 'gunpla') {
    add({ key: 'order', label: '排序', type: 'number' })
    add({
      key: 'group',
      label: '分组',
      type: 'select',
      options: leafGroups().map((group) => [group.key, groupLabel(group.key)])
    })
    add({ key: 'brand', label: '品牌' })
    add({ key: 'name', label: '模型名称', wide: true })
    add({ key: 'releasePrice', label: '万代发售价' })
    add({ key: 'purchasePrice', label: '购入价' })
    add({ key: 'link78', label: '78 动漫详情链接', type: 'url', wide: true })
    add({
      key: 'officialImages',
      label: '官方图',
      type: 'textarea',
      array: true,
      upload: true,
      wide: true,
      hint: '一行一张图片；可填写网络 URL 或上传到 public/images/uploads'
    })
    add({
      key: 'myImages',
      label: '实物图',
      type: 'textarea',
      array: true,
      upload: true,
      wide: true,
      hint: '一行一张图片'
    })
    add({ key: 'review', label: '简评', type: 'textarea', wide: true })
  } else if (state.kind === 'acg') {
    add({ key: 'section', label: '栏目', type: 'select', options: sections })
    add({ key: 'order', label: '栏目内排序', type: 'number' })
    if (data.section === 'anime-timeline') add({ key: 'year', label: '年份', type: 'number' })
    add({
      key: 'title',
      label: '标题',
      type: 'textarea',
      textValue: true,
      wide: true,
      hint: '多行会保存为多行标题'
    })
    add({
      key: 'description',
      label: '简介',
      type: 'textarea',
      textValue: true,
      wide: true,
      hint: '多行会保存为多行简介'
    })
    add({ key: 'image', label: '封面图', type: 'text', upload: true, wide: true })
    if (['anime-featured', 'comic-featured'].includes(data.section))
      add({ key: 'badge', label: '推荐标签' })
    add({
      key: 'link',
      label: '详情链接',
      type: 'url',
      required: data.section !== 'game',
      wide: true,
      hint: data.section === 'game' ? '游戏条目可以留空' : ''
    })
  } else {
    add({ key: 'order', label: '排序', type: 'number' })
    add({ key: 'year', label: '年份', type: 'number' })
    add({ key: 'title', label: '论文标题', wide: true })
    add({
      key: 'authors',
      label: '作者',
      type: 'textarea',
      wide: true,
      hint: '本人姓名可以保留 <strong>…</strong>'
    })
    add({ key: 'publication', label: '会议 / 期刊', wide: true })
    add({ key: 'link', label: '论文链接', type: 'url', required: false, wide: true })
  }
  container.querySelectorAll('input,textarea,select').forEach((control) => {
    if (control.name === 'slug') {
      control.addEventListener('input', () => {
        state.current.autoSlug = false
        updateFromForm()
      })
      return
    }
    if (control.name !== 'section') {
      control.addEventListener('input', updateFromForm)
      control.addEventListener('change', updateFromForm)
      return
    }
    control.addEventListener('change', () => {
      const oldScope = state.current.data.section
      const next = control.value
      state.current.data = collect()
      if (next === oldScope) return updatePreview()
      if (next === 'anime-timeline' && !state.current.data.year)
        state.current.data.year = new Date().getFullYear()
      if (next !== 'anime-timeline') delete state.current.data.year
      if (['anime-featured', 'comic-featured'].includes(next)) state.current.data.badge ||= '推荐'
      else delete state.current.data.badge
      state.current.data.order = nextOrder('acg', state.current.data)
      if (state.current.autoSlug) state.current.slug = suggestSlug(state.kind, state.current.data)
      state.dirty = true
      renderFields()
      updatePreview()
    })
  })
}
function collect() {
  const data = structuredClone(state.current.data)
  $('#form-fields')
    .querySelectorAll('[name]')
    .forEach((control) => {
      if (control.name === 'slug') {
        state.current.slug = control.value.trim()
        return
      }
      // Saving another field must not normalize untouched legacy text.
      if (control.value === control.dataset.initialValue) return
      if (control.dataset.array !== undefined)
        data[control.name] = control.value
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean)
      else if (control.dataset.textValue !== undefined) {
        const lines = control.value
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean)
        data[control.name] = lines.length === 1 ? lines[0] : lines
      } else if (control.type === 'number') data[control.name] = Number(control.value)
      else if (!control.required && !control.value.trim()) delete data[control.name]
      else data[control.name] = control.value.trim()
    })
  return data
}
function updateFromForm() {
  state.current.data = collect()
  if (!state.current.id && state.current.autoSlug) {
    state.current.slug = suggestSlug(state.kind, state.current.data)
    $('#field-slug').value = state.current.slug
  }
  state.dirty =
    JSON.stringify(state.current.data) !== JSON.stringify(state.original?.data) ||
    (!state.current.id && !!state.current.slug)
  updatePreview()
}
const firstImage = (data) => data.image || data.myImages?.[0] || data.officialImages?.[0]
function updatePreview() {
  const data = state.current.data
  const preview = $('#preview')
  const image = document.createElement('div')
  image.className = 'preview-image'
  const source = firstImage(data)
  if (source) {
    const node = document.createElement('img')
    node.src = source
    node.alt = ''
    node.addEventListener('error', () => {
      image.textContent = '图片暂不可用'
    })
    image.append(node)
  } else image.textContent = '尚未选择图片'
  const copy = document.createElement('div')
  copy.className = 'preview-copy'
  const meta = document.createElement('div')
  meta.className = 'preview-meta'
  const values =
    state.kind === 'gunpla'
      ? [data.group, data.brand, data.purchasePrice]
      : state.kind === 'acg'
        ? [sectionLabel(data.section), data.year, data.badge]
        : [data.year, data.publication]
  values.filter(Boolean).forEach((value) => {
    const tag = document.createElement('span')
    tag.textContent = value
    meta.append(tag)
  })
  const heading = document.createElement('h4')
  heading.textContent = Array.isArray(data.title)
    ? data.title.join('\n')
    : data.name || String(data.title || '未命名')
  const description = document.createElement('p')
  const raw = data.review || data.description || data.authors || '填写内容后会显示预览'
  description.textContent = Array.isArray(raw)
    ? raw.join('\n')
    : String(raw).replace(/<[^>]+>/g, '')
  copy.append(meta, heading, description)
  preview.replaceChildren(image, copy)
  $('#form-title').textContent = heading.textContent || '未命名条目'
}
function makeBlank(kind) {
  if (kind === 'gunpla')
    return {
      order: nextOrder(kind, {}),
      group: leafGroups()[0]?.key || '',
      officialImages: [],
      myImages: [],
      name: '',
      releasePrice: '',
      brand: '',
      purchasePrice: '',
      link78: '',
      review: ''
    }
  if (kind === 'acg')
    return {
      section: 'anime-featured',
      order: nextOrder(kind, { section: 'anime-featured' }),
      title: '',
      description: '',
      image: '',
      badge: '推荐',
      link: ''
    }
  return {
    title: '',
    authors: '',
    publication: '',
    year: new Date().getFullYear(),
    link: '',
    order: nextOrder(kind, {})
  }
}
function openEditor(entry, clone = false) {
  const data = structuredClone(entry ? entry.data : makeBlank(state.kind))
  if (clone) data.order = nextOrder(state.kind, data)
  const isNew = clone || !entry
  state.current = {
    kind: state.kind,
    id: clone ? null : entry?.id || null,
    revision: clone ? null : entry?.revision || null,
    slug: isNew ? suggestSlug(state.kind, data) : '',
    autoSlug: isNew,
    data
  }
  state.original = structuredClone(state.current)
  state.dirty = false
  $('#welcome').hidden = true
  $('#content-form').hidden = false
  $('#clone-entry').hidden = !state.current.id
  $('#form-mode').textContent = state.current.id
    ? 'EDIT ENTRY'
    : clone
      ? 'CLONE ENTRY'
      : 'NEW ENTRY'
  $('#file-id').textContent = state.current.id || '保存时创建新 JSON 文件'
  renderFields()
  updatePreview()
  renderList()
}
function renderList() {
  const query = $('#entry-search').value.trim().normalize('NFKC').toLowerCase()
  const entries = (state.entries[state.kind] || []).filter((entry) =>
    (titleOf(entry) + ' ' + metaOf(entry) + ' ' + entry.id)
      .normalize('NFKC')
      .toLowerCase()
      .includes(query)
  )
  const list = $('#entry-list')
  list.replaceChildren()
  if (!entries.length) {
    const empty = document.createElement('p')
    empty.className = 'empty-list'
    empty.textContent = '没有匹配的内容'
    list.append(empty)
    return
  }
  for (const entry of entries) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'entry'
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(state.current?.id === entry.id))
    const order = document.createElement('span')
    order.className = 'entry-order'
    order.textContent = String(entry.data.order).padStart(2, '0')
    const copy = document.createElement('span')
    const title = document.createElement('strong')
    title.textContent = titleOf(entry)
    const meta = document.createElement('small')
    meta.textContent = metaOf(entry)
    copy.append(title, meta)
    button.append(order, copy)
    button.addEventListener('click', () => {
      if (state.current?.id === entry.id || mayLeave()) openEditor(entry)
    })
    list.append(button)
  }
}
async function loadKind(kind, preserve = false) {
  if (!preserve && kind !== state.kind && !mayLeave()) return
  state.kind = kind
  $('#site-preview').href = 'http://127.0.0.1:4321' + previewPaths[kind]
  document
    .querySelectorAll('[data-kind]')
    .forEach((button) =>
      button.setAttribute('aria-current', button.dataset.kind === kind ? 'page' : 'false')
    )
  $('#library-title').textContent = labels[kind]
  const result = await request('/api/content?kind=' + encodeURIComponent(kind))
  state.entries[kind] = result.entries
  $('#count-' + kind).textContent = result.entries.length
  if (!preserve) {
    state.current = state.original = null
    state.dirty = false
    $('#content-form').hidden = true
    $('#welcome').hidden = false
  }
  renderList()
}
function changes(before, after) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
  return keys
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .map((key) => {
      const value = after[key]
      const display = Array.isArray(value)
        ? value.join('、')
        : value === undefined
          ? '（删除）'
          : String(value)
      return key + ' → ' + (display.length > 90 ? display.slice(0, 87) + '…' : display)
    })
}
async function save() {
  if (state.pending) return notify('请等待图片上传完成', true)
  const form = $('#content-form')
  if (!form.reportValidity()) return
  const data = collect()
  const edits = changes(state.current.id ? state.original.data : {}, data)
  if (!edits.length && state.current.id) return notify('没有需要保存的修改')
  $('#change-summary').textContent = state.current.id
    ? '将修改现有条目；原文件会先自动备份。'
    : '将创建一个新条目；不会覆盖任何已有文件。'
  const list = $('#change-list')
  list.replaceChildren()
  edits.forEach((change) => {
    const item = document.createElement('li')
    item.textContent = change
    list.append(item)
  })
  const dialog = $('#confirm-dialog')
  dialog.showModal()
  const answer = await new Promise((resolve) =>
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true })
  )
  if (answer !== 'confirm') return
  try {
    const result = await request('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Content-Token': state.token },
      body: JSON.stringify({
        kind: state.kind,
        id: state.current.id,
        slug: state.current.slug,
        revision: state.current.revision,
        data
      })
    })
    state.dirty = false
    await loadKind(state.kind, true)
    const saved = state.entries[state.kind].find((entry) => entry.id === result.entry.id)
    openEditor(saved)
    notify(
      '已保存' +
        (result.backup ? '，旧文件已备份' : '') +
        (result.warnings?.length ? '；' + result.warnings.join('；') : '')
    )
  } catch (error) {
    notify(error.message, true)
  }
}
async function boot() {
  try {
    const session = await request('/api/session')
    state.token = session.token
    state.groups = session.groups
    for (const kind of Object.keys(labels)) {
      const result = await request('/api/content?kind=' + kind)
      state.entries[kind] = result.entries
      $('#count-' + kind).textContent = result.entries.length
    }
    await loadKind('gunpla')
  } catch (error) {
    notify(error.message, true)
  }
}
document
  .querySelectorAll('[data-kind]')
  .forEach((button) => button.addEventListener('click', () => loadKind(button.dataset.kind)))
$('#entry-search').addEventListener('input', renderList)
$('#new-entry').addEventListener('click', () => {
  if (mayLeave()) openEditor(null)
})
$('#clone-entry').addEventListener('click', () => {
  if (state.current) openEditor({ data: collect() }, true)
})
$('#cancel-edit').addEventListener('click', () => {
  if (state.current?.id) openEditor(state.original)
  else if (mayLeave()) {
    state.current = state.original = null
    state.dirty = false
    $('#content-form').hidden = true
    $('#welcome').hidden = false
    renderList()
  }
})
$('#content-form').addEventListener('submit', (event) => {
  event.preventDefault()
  save()
})
$('#reload').addEventListener('click', () => {
  if (mayLeave()) location.reload()
})
window.addEventListener('beforeunload', (event) => {
  if (state.dirty) event.preventDefault()
})
boot()

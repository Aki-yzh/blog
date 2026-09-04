import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ContentError, createContentStore } from './store.mjs'

const assets = dirname(fileURLToPath(import.meta.url))
export function createAdminServer(repoRoot) {
  const store = createContentStore(repoRoot)
  const token = randomBytes(32).toString('hex')
  const server = createServer(async (request, response) => {
    const port = server.address().port
    const origin = 'http://127.0.0.1:' + port
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: http: blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    )
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      response.writeHead(status, { 'Content-Type': type })
      response.end(type.startsWith('application/json') ? JSON.stringify(body) : body)
    }
    try {
      // Loopback binding alone does not stop DNS rebinding or a malicious site posting to localhost.
      if (
        request.headers.host !== '127.0.0.1:' + port ||
        (request.headers.origin && request.headers.origin !== origin) ||
        (request.headers['sec-fetch-site'] &&
          !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))
      ) {
        throw new ContentError('仅允许本机同源访问，请使用终端显示的 127.0.0.1 地址', 403)
      }
      const url = new URL(request.url, origin)
      if (request.method === 'GET') {
        const staticFiles = {
          '/': ['index.html', 'text/html; charset=utf-8'],
          '/admin/content': ['index.html', 'text/html; charset=utf-8'],
          '/admin/app.js': ['app.js', 'text/javascript; charset=utf-8'],
          '/admin/style.css': ['style.css', 'text/css; charset=utf-8']
        }
        if (staticFiles[url.pathname]) {
          const [name, type] = staticFiles[url.pathname]
          return send(200, readFileSync(resolve(assets, name)), type)
        }
        if (url.pathname === '/api/session') return send(200, { token, groups: store.groups() })
        if (url.pathname === '/api/content')
          return send(200, { entries: store.list(url.searchParams.get('kind')) })
        if (url.pathname.startsWith('/images/')) {
          const { bytes, type } = store.image(decodeURIComponent(url.pathname.slice(8)))
          return send(200, bytes, type)
        }
      }
      if (request.method === 'POST' && ['/api/save', '/api/upload'].includes(url.pathname)) {
        if (
          request.headers.origin !== origin ||
          request.headers['x-content-token'] !== token ||
          request.headers['content-type'] !== 'application/json'
        )
          throw new ContentError('保存验证失败，请刷新管理页面', 403)
        const maximum = url.pathname === '/api/upload' ? 14 * 1024 * 1024 : 256 * 1024
        if (Number(request.headers['content-length']) > maximum)
          throw new ContentError('请求过大', 413)
        const chunks = []
        let size = 0
        for await (const chunk of request) {
          size += chunk.length
          if (size > maximum) throw new ContentError('请求过大', 413)
          chunks.push(chunk)
        }
        let payload
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          throw new ContentError('无效 JSON')
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
          throw new ContentError('请求格式无效')
        return send(200, url.pathname === '/api/save' ? store.save(payload) : store.upload(payload))
      }
      send(404, { error: '页面不存在' })
    } catch (error) {
      if (!(error instanceof ContentError)) console.error(error)
      send(error instanceof ContentError ? error.status : 500, {
        error:
          error instanceof ContentError
            ? error.message
            : '操作失败，未能完成保存。请查看终端并刷新列表。'
      })
    }
  })
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  return server
}

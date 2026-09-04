#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAdminServer } from './content-admin/server.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.CONTENT_ADMIN_PORT || 4322)
const withPreview = process.argv.includes('--preview')
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('CONTENT_ADMIN_PORT 必须在 1024–65535 之间')
const server = createAdminServer(root)
let preview = null
let shuttingDown = false

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (preview && !preview.killed) preview.kill()
  server.close(() => {
    process.exitCode = exitCode
  })
  server.closeAllConnections()
}

server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? '端口已占用。请关闭已有管理工具，或设置 CONTENT_ADMIN_PORT 使用其他端口。'
      : error.message
  )
  shutdown(1)
})
server.listen(port, '127.0.0.1', () => {
  console.log('\n内容管理：http://127.0.0.1:' + port + '/admin/content')
  console.log('仅本机可用；保存只修改本地文件，不会自动提交或发布。Ctrl+C 退出。')
  if (!withPreview) {
    console.log('如需同时启动网页预览，请改用 bun run content:studio。\n')
    return
  }

  preview = spawn(
    process.execPath,
    [resolve(root, 'node_modules/astro/astro.js'), 'dev', '--host', '127.0.0.1', '--port', '4321'],
    {
      cwd: root,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
      stdio: 'inherit'
    }
  )
  preview.on('error', (error) => {
    console.error('网页预览启动失败：' + error.message)
    shutdown(1)
  })
  preview.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error('网页预览意外退出。')
      shutdown(code || 1)
    }
  })
  console.log('网页预览：http://127.0.0.1:4321/\n')
})
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown())

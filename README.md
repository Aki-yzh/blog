# Akiのink

Aki 的个人网站，包含博客、研究成果、项目、ACG 记录与 Gunpla 收藏。

- 正式站点：[www.aki-yzh.cn](https://www.aki-yzh.cn/)
- 技术栈：Astro、Tailwind CSS、Waline、Vercel
- 内容格式：Markdown/MDX 博客，以及结构化 JSON 收藏数据

## Local development

环境要求：Node.js 20、Bun 1.x。

```shell
bun install
bun run start
```

默认预览地址为 `http://127.0.0.1:4321/`。

## Managing content

Gunpla、ACG 和论文均通过结构化内容文件管理，日常更新不需要修改 Astro 页面代码。

```shell
bun run content:studio
```

命令会同时启动：

- 内容后台：`http://127.0.0.1:4322/admin/content`
- 网站预览：`http://127.0.0.1:4321/`

内容后台支持搜索、新建、克隆、实时预览、自动建议排序与文件名，以及本地图片上传。完整的安全编辑流程参见 [CONTENT.md](./CONTENT.md)。

## Validation

```shell
bun run content:check
bun run content:test
bun run build
```

- `content:check`：验证内容结构、排序、分组和 Astro 类型。
- `content:test`：验证内容后台的读取、备份、并发修改保护和图片上传安全。
- `build`：执行生产构建。

## Deployment and backups

`main` 分支由 Vercel 部署到正式域名。重要改造前使用带日期的 Git Tag 保存稳定恢复点，并将 Tag 推送到 GitHub：

```shell
git tag -a backup-YYYY-MM-DD-description -m "Backup before change"
git push origin backup-YYYY-MM-DD-description
```

本轮优化前的恢复点为 `backup-2026-09-05-pre-optimization`。

## Credits

网站基于 [Astro Theme Pure](https://github.com/cworld1/astro-theme-pure) 深度定制。

## License

This project is licensed under the Apache License 2.0.

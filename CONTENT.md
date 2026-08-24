# 内容维护说明

ACG、Gunpla 和论文已经改为数据驱动。日常新增或修改内容只需要编辑 JSON，不再需要进入 Astro 页面复制大段组件。

## 用向导新增

在项目根目录运行：

```shell
bun run content:new gunpla
bun run content:new acg
bun run content:new publication
```

向导会自动计算 `order`、选择正确目录并生成一个新的 JSON 文件；它使用独占写入，遇到同名文件会直接停止，不会覆盖已有内容。填写结束后检查图片路径并运行：

```shell
bun run content:check
```

## 内容位置

- Gunpla：`src/content/gunpla/*.json`，一台模型一个文件。
- ACG：`src/content/acg/**`，目录对应动画推荐、时间线、漫画和游戏栏目。
- 论文：`src/content/publications/*.json`，保存一次后首页、About 和 Projects 会同步更新。
- Gunpla 分组与目录：`src/data/gunpla-groups.json`。只有新增分组时才需要修改。
- ACG 页面级内容：`src/data/acg-page.json`，包含 Bangumi 入口、近期动态和 Wall of Fame。

所有列表都按 `order` 升序展示。Gunpla 和论文的 `order` 在各自集合内唯一；ACG 的 `order` 在栏目内唯一，动画时间线按年份分别排序。标题或简介需要显式换行时，JSON 中可以使用字符串数组。

## 图片与链接

远程图片直接填写完整 URL。本地图片放在 `public/images` 下，JSON 中使用 `/images/...` 路径。游戏卡片允许不填写 `link`；这种卡片仍保持普通卡片而不会被强制包成链接。

## 迁移保护

这次迁移保留了两份只读对账工具：

```shell
bun scripts/extract-gunpla.ts --verify
bun scripts/extract-acg.ts --verify
bun scripts/verify-publications.mjs
```

它们用于证明迁移后的初始 JSON 与旧硬编码内容逐字段一致，并保留不可变指纹或只读 fixture 以便提交后复核。以后有意新增内容后，出现“额外条目”或迁移指纹变化是正常的，不应再把迁移基线强行覆盖回来；日常维护请使用 `bun run content:check`。

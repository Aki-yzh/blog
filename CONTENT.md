# 内容维护说明

ACG、Gunpla 和论文已经改为数据驱动。日常新增或修改内容只需要编辑 JSON，不再需要进入 Astro 页面复制大段组件。

## 使用本地管理页面（推荐）

在项目根目录运行：

```shell
bun run content:studio
```

这一个命令会同时启动内容管理器和网页预览：

- 内容管理：`http://127.0.0.1:4322/admin/content`
- 网页预览：`http://127.0.0.1:4321/`

管理页顶部也有“打开网页预览”入口，并会根据当前栏目跳转到 Gunpla、ACG 或论文对应页面。管理页面只监听本机地址，也不会被 Astro 构建或部署到线上。它支持：

- 浏览和搜索全部 Gunpla、ACG 与论文条目；
- 通过表单新增、编辑或复制条目，并即时预览；
- 新建或复制时自动填写文件标识，通常不需要手工命名 JSON；
- 上传 JPG、PNG、GIF、WebP 图片到 `public/images/uploads`；
- 保存前查看字段修改摘要。

管理页面不会删除内容、不会自动提交 Git，也不会自动发布。新增文件使用独占写入，遇到同名文件会停止；编辑时会检查文件版本，并在 `.content-admin/backups` 留下原文件的逐字节备份。这个备份目录只在本机使用，已经加入 `.gitignore`。

完成后按一次 `Ctrl+C` 即可关闭管理器和网页预览，再执行 `bun run content:check`。如果只想打开管理器、不需要网页预览，可运行 `bun run content:manage`。

日常添加内容的推荐流程很短：打开对应栏目 → 点击“新增”或“复制为新条目” → 填表和上传图片 → 检查即时预览 → “检查并保存”。最后运行 `bun run content:check`，确认通过后再按正常 Git 流程提交和推送。

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

Gunpla 和 ACG 按 `order` 升序展示。Gunpla 和论文的 `order` 在各自集合内唯一；ACG 的 `order` 在栏目内唯一，动画时间线按年份分别排序。标题或简介需要显式换行时，JSON 中可以使用字符串数组。

### 论文排序与首页展示

论文自动按本人作者排名升序、发表时间降序排列；排名与日期相同才比较 `order`。管理页和新增向导均支持以下字段：

- `authorRank`：本人作者排名，例如二作填 `2`。留空时按作者列表中 `<strong>本人姓名</strong>` 的位置判断；未标记的条目排在后面。
- `publishedDate`：`YYYY-MM` 或 `YYYY-MM-DD`，例如 `2026-09-30`。只知道月份时填写 `2026-09`；留空则按 `year` 排列，不需要编造具体日期。
- `publication`：延续现有格式，如 `(Ubicomp)Proceedings of the ACM on Interactive, Mobile, Wearable and Ubiquitous Technologies`。

首页默认展示排序后的前 3 篇，其余可原地展开和收起；“查看全部论文”进入 About 的完整列表。以后继续添加论文，三个页面会自动同步，无需调整页面代码。

本次补入的 PathClean、mmMind、mmUbiSense、DuBCG，分别通过 [MobiCom 官方日程](https://sigmobile.org/mobicom/2026/accepted_papers_schedule.html)、[arXiv](https://arxiv.org/abs/2608.04127)、[本人 ORCID 记录](https://orcid.org/0009-0006-3342-4311)及 DOI 元数据核对。mmMind 当前按 arXiv 预印本记录，不标注未经确认的会议。Google Scholar 在本次访问中要求人机验证，因此这些新增条目不代表已完整对账 Scholar 中的所有记录。

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

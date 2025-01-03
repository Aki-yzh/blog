# Astro Theme Pure

[English](./README.md) | [简体中文](./README-zh-CN.md)

[![GitHub commit activity](https://img.shields.io/github/commit-activity/t/cworld1/astro-theme-pure?label=commits&style=flat-square)](https://github.com/cworld1/astro-theme-pure/commits)
[![GitHub stars](https://img.shields.io/github/stars/cworld1/astro-theme-pure?style=flat-square)](https://github.com/cworld1/astro-theme-pure/stargazers)
[![GitHub license](https://img.shields.io/github/license/cworld1/astro-theme-pure?style=flat-square)](https://github.com/cworld1/astro-theme-pure/blob/main/LICENSE)

一个由 Astro 构建的轻便、简洁但功能丰富的博客主题。

![image](https://github.com/user-attachments/assets/7eb17ddf-fd5f-42f3-a337-675a21ba7a27)

## 简介 / 部署

[预览](https://astro-theme-pure.vercel.app/) | [展示台](https://github.com/cworld1/astro-theme-pure/issues/10)

欲了解更多信息，请访问 [CWorld 网站](https://cworld0.com/blog/theme-resume) 和 [部署说明](https://astro-theme-pure.vercel.app/blog/customize-zh)。

## 本地开发

环境要求：

- [Nodejs](https://nodejs.org/): 18.0.0+
- [Bun](https://bun.sh/): 1.0.0+

克隆存储库：

```shell
git clone https://github.com/cworld1/astro-theme-pure.git
```

安装依赖：

```shell
cd astro-theme-pure
bun install
```

> [!NOTE]
> 对于 Bun，如果安装较慢，建议使用镜像配置，在项目根目录下新建 `bunfig.toml`：
>
> ```toml
> [install]
> registry = "https://registry.npmmirror.com/"
> ```
>
> 其他 PM 配置镜像请参考各自官方文档。

启动开发服务器：

```shell
bun dev
# 对于 Windows 用户，Bun 暂时还没有实现后台任务。如使用 Bun 请改用以下命令：
# bun start
```

或者构建（您可能需要首先使用 node.js SSR）：

```shell
bun run build
```

预览：

```shell
bun preview
```

## 贡献

为了花更多时间编写代码，减少在空白上纠结的时间，本项目使用代码约定和样式来鼓励一致性。风格一致的代码更容易（且更不容易出错）进行审查、维护和理解。

## 感谢

- [Astro Cactus](https://github.com/chrismwilliams/astro-theme-cactus)
- [Astro Resume](https://github.com/srleom/astro-theme-resume)

## 许可证

本项目基于 Apache 2.0 许可证。

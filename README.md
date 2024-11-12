# Astro Theme Pure

[English](./README.md) | [简体中文](./README-zh-CN.md)

[![GitHub commit activity](https://img.shields.io/github/commit-activity/t/cworld1/astro-theme-pure?label=commits&style=flat-square)](https://github.com/cworld1/astro-theme-pure/commits)
[![GitHub stars](https://img.shields.io/github/stars/cworld1/astro-theme-pure?style=flat-square)](https://github.com/cworld1/astro-theme-pure/stargazers)
[![vercel status](https://img.shields.io/website?down_message=offline&label=vercel&logo=vercel&style=flat-square&up_message=online&url=https%3A%2F%2Fastro-theme-pure.vercel.app)](#)
[![GitHub license](https://img.shields.io/github/license/cworld1/astro-theme-pure?style=flat-square)](https://github.com/cworld1/astro-theme-pure/blob/main/LICENSE)

A simple, clean but powerful blog theme build by astro.

![image](https://github.com/user-attachments/assets/7eb17ddf-fd5f-42f3-a337-675a21ba7a27)

## Introduction / Deployment

[Demo](https://astro-theme-pure.vercel.app/) | [Showcase](https://github.com/cworld1/astro-theme-pure/issues/10)

For more information, please visit the [CWorld Site](https://cworld0.com/blog/theme-resume) and [Deployment Instructions](https://astro-theme-pure.vercel.app/blog/customize).

## Local development

Environment requirements:

- [Nodejs](https://nodejs.org/): 18.0.0+
- [Bun](https://bun.sh/): 1.0.0+

Clone the repository:

```shell
git clone https://github.com/cworld1/astro-theme-pure.git
```

Install dependencies:

```shell
cd astro-theme-pure
bun install
```
> [!NOTE]
> For Bun, if the installation is slow, it is recommended to use a mirror configuration by creating  `bunfig.toml` under the project root directory:
>
> ```toml
> [install]
> registry = "<npm mirror site>"
> ```
>
> For details about other PM mirror configs, you may need to see their official documents.

Start the development server:

```shell
bun dev
# For Windows, Bun has not yet implemented background tasks. So for Bun, use the following command instead:
# bun start
```

Or build (you may need to use node.js SSR firstly):

```shell
bun run build
```

Preview:

```shell
bun preview
```

## Contributions

To spend more time coding and less time fiddling with whitespace, this project uses code conventions and styles to encourage consistency. Code with a consistent style is easier (and less error-prone!) to review, maintain, and understand.

## Thanks

- [Astro Cactus](https://github.com/chrismwilliams/astro-theme-cactus)
- [Astro Resume](https://github.com/srleom/astro-theme-resume)

## License

This project is licensed under the Apache 2.0 License.

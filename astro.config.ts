import { defineConfig } from 'astro/config'
// Adapter
// if you want deploy on vercel
import vercel from '@astrojs/vercel'
// ---
// if you want deploy locally
// import node from '@astrojs/node'
// Integrations
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import icon from 'astro-icon'
// Markdown
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import { remarkAlert } from 'remark-github-blockquote-alert'
import remarkMath from 'remark-math'
import remarkUnwrapImages from 'remark-unwrap-images'
import { siteConfig } from './src/site.config.ts'
import { remarkGithubCards, remarkReadingTime, remarkArxivCards } from './src/utils/remarkParser.ts'

// https://astro.build/config
export default defineConfig({
  // Top-Level Options
  site: siteConfig.site,
  // base: '/docs',
  trailingSlash: 'never',
  output: 'server',
  // if you want deploy on vercel
  adapter: vercel(),
  // ---
  // if you want deploy locally
  // adapter: node({
  //   mode: 'standalone'
  // }),
  integrations: [sitemap(), mdx(), icon()],
  vite: {
    plugins: [tailwindcss()]
  },
  // root: './my-project-directory',

  // Prefetch Options
  prefetch: true,
  // Markdown Options
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkUnwrapImages,
        remarkMath,
        remarkReadingTime,
        remarkAlert,
        remarkGithubCards,
        remarkArxivCards
      ],
      rehypePlugins: [
        [rehypeKatex, {}],
        [
          rehypeExternalLinks,
          {
            target: '_blank',
            rel: ['nofollow', 'noopener', 'noreferrer']
          }
        ]
      ],
      remarkRehype: {
        footnoteLabelProperties: {
          className: ['']
        }
      }
    }),
    shikiConfig: {
      themes: {
        dark: 'github-dark',
        light: 'github-light'
      }
    }
  }
})

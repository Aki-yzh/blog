import type { SiteConfig, MenuLinks, SocialLinks } from '@/types'

export const siteConfig: SiteConfig = {
  // Used as both a meta property (src/components/BaseHead.astro L:31 + L:49) & the generated satori png (src/pages/og-image/[slug].png.ts)
  author: 'Aki',
  // Meta property used to construct the meta title property, found in src/components/BaseHead.astro L:11
  title: 'Akiのink',
  // Meta property used to generate your sitemap and canonical URLs in your final build
  site: 'https://aki-yzh.github.io',
  // Meta property used as the default description meta property
  description: '我们所经历的每个平凡的日常，也许就是连续发生的奇迹',
  // HTML lang property, found in src/layouts/Base.astro L:18
  lang: 'zh-CN, en-US',
  // Meta property, found in src/components/BaseHead.astro L:42
  ogLocale: 'en_US',
  // Date.prototype.toLocaleDateString() parameters, found in src/utils/date.ts.
  date: {
    locale: 'en-US',
    options: {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  },
  // Customize
  pageSize: 8,

  walineServerUrl: 'https://astro-theme-pure-waline.arthals.ink',
  applyFriendTip: {
    name: 'Astro Theme Pure',
    slogan: '我们所经历的每个平凡的日常，也许就是连续发生的奇迹。',
    url: 'https://astro-theme-pure.vercel.app/',
    avatar: 'https://cravatar.cn/avatar/1ffe42aa45a6b1444a786b1f32dfa8aa?s=200'
  }
}

// will be used in Footer.astro
export const socialLinks: SocialLinks = [
  // {
  //   name: 'mail',
  //   url: 'mailto:test@example.com'
  // },
  {
    name: 'github',
    url: 'https://github.com/Aki-yzh'
  }
]

export const menuLinks: MenuLinks = [
  {
    link: '/blog',
    label: 'Blog'
  },
  {
    link: '/projects',
    label: 'Projects'
  },
  {
    link: '/links',
    label: 'Links'
  },
  {
    link: '/anime',
    label: 'Anime'
  },
  {
    link: '/gunpla',
    label: 'Gunpla'
  },
  {
    link: '/about',
    label: 'About'
  }
]

/**
 * 站点配置 —— 你想改站名、昵称、网址，只需要改这个文件。
 *
 * 【改仓库名怎么办】
 *   1. 把下面 base 改成 '/新仓库名/'
 *   2. 把 vite.config.ts 里的 BASE 改成同样的值
 *   两项必须一致，否则整站白屏。
 */

export const site = {
  /** 站点名，显示在浏览器标签、页脚、文章标题后面 */
  title: '回声记录',
  /** 你的昵称，显示在页脚「© 2026 xxx」和关于页 */
  handle: 'jiaonojue',
  /** 一句话介绍，首页大标题下面会做打字机效果 */
  tagline: '看番、写码、随手记一点什么',

  /** SEO 描述，80 字以内，会出现在搜索结果和分享卡片里 */
  description: '一个写番剧感想、技术备忘与生活随笔的个人博客。',

  /** 站点网址，末尾带斜杠。部署到 GitHub Pages 后改成真实地址 */
  url: 'https://jiaonojue.github.io',
  /** 子路径前缀，必须以 / 开头和结尾 */
  base: '/blog/',

  /** 建站年份，用于页脚版权 */
  since: 2026,

  /** 页脚那句诗 / 彩蛋文案 */
  footerNote: '慢一点也没关系，路还长。',

  /** 素材下架通道：权利方看到自己的图想让我撤，从这里联系 */
  issuesUrl: 'https://github.com/jiaonojue/blog/issues',

  /**
   * 功能开关。
   * 这是"默认值"，访客还能在设置面板里自己改（主题、动效那些）。
   * 想让某项彻底消失，就把对应组件从页面里删掉。
   */
  features: {
    /** 关于页插画 + 站主对话气泡 */
    aboutIllustration: true,
    /** 自定义光标（小圆点 + 跟随环） */
    customCursor: true,
    /** 首页花瓣粒子 */
    petals: false,
    /** 站内搜索（Pagefind） */
    search: true,
  },
} as const

/** 导航里所有可用的页面。visible 为 false 的默认隐藏，访客可在设置里勾出来 */
export const navItems = [
  { key: 'home', label: '首页', path: '/', visible: true },
  { key: 'posts', label: '文章', path: '/posts', visible: true },
  { key: 'favorites', label: '收藏', path: '/favorites', visible: true },
  { key: 'gallery', label: '相册', path: '/gallery', visible: true },
  { key: 'about', label: '关于', path: '/about', visible: true },
  { key: 'tools', label: '工具箱', path: '/tools', visible: false },
  { key: 'now', label: 'Now', path: '/now', visible: false },
  { key: 'credits', label: '素材来源', path: '/credits', visible: false },
] as const

export type NavItem = (typeof navItems)[number]
export type NavKey = NavItem['key']

/** 文章分类。改这里会影响文章列表的筛选器 */
export const categories = [
  { key: 'anime', label: '番剧' },
  { key: 'tech', label: '技术' },
  { key: 'essay', label: '随笔' },
  { key: 'fragment', label: '碎片' },
] as const

export type CategoryKey = (typeof categories)[number]['key']

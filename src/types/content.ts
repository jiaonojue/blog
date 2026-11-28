/** 内容模型类型定义 —— 与 scripts/build-content-index.mjs 的输出一一对应 */

export type CategoryKey = 'anime' | 'tech' | 'essay' | 'fragment'
export type FavoriteType = 'anime' | 'music' | 'game' | 'book'
export type ToolGroup = '写作' | '设计' | '开发' | '生活'

/** 文章目录项（不含正文，正文在 bodies.json 里按需加载） */
export interface Post {
  title: string
  date: string
  updated?: string
  slug: string
  year: string
  category: CategoryKey
  tags: string[]
  summary: string
  cover?: string
  /** 文章末尾「余白」那一屏的收尾语；不写就用默认那句 */
  closing?: string
  /** 页边批注：挂在前几段旁边的小字，可选 */
  notes?: { after: number; text: string }[]
  draft: boolean
  sample: boolean
  /** 预计阅读时长（分钟） */
  minutes: number
  /** 正文非空白字数（不含代码块），构建期算好，奥付卡片用 */
  chars?: number
  /** 二级标题数量，构建期算好，奥付卡片用 */
  sections?: number
  /** URL 路径，不含 base，例如 /posts/2026/hello */
  path: string
}

export interface Favorite {
  slug: string
  title: string
  type: FavoriteType
  status: string
  score: number
  cover?: string
  artist?: string
  link?: string
  sample: boolean
  note: string
}

export interface GalleryItem {
  title: string
  date: string
  image: string
  caption: string
  sample: boolean
}

export interface Tool {
  name: string
  desc: string
  url: string
  icon: string
  group: ToolGroup
  sample: boolean
}

export interface QaItem {
  q: string
  a: string
}

export interface TimelineItem {
  year: string
  text: string
}

export interface ContentIndex {
  posts: Post[]
  favorites: Favorite[]
  gallery: GalleryItem[]
  tools: Tool[]
  now: { html: string; updated: string }
  about: { html: string; qa: QaItem[]; timeline: TimelineItem[] }
  changelog: { html: string; updated: string }
}

/** 文章正文表：键是文章 path，值是渲染好的 HTML */
export type PostBodies = Record<string, string>

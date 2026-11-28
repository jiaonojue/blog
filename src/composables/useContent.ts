/**
 * 内容读取入口 —— 页面通过这里拿文章、收藏、相册、工具。
 *
 * 数据来自 src/generated/content.json（由 npm run content:index 生成）。
 * 你不需要改这个文件。
 */
import raw from '@/generated/content.json'
import type { ContentIndex, Post, PostBodies, Favorite, GalleryItem, Tool } from '@/types/content'
import { site } from '@/data/site.config'

const data = raw as unknown as ContentIndex

export const posts = data.posts
export const favorites = data.favorites
export const gallery = data.gallery
export const tools = data.tools
export const now = data.now
export const about = data.about
export const changelog = data.changelog

/** 取最新 n 篇文章 */
export function latestPosts(n: number): Post[] {
  return posts.slice(0, n)
}

/** 按分类筛选文章 */
export function postsByCategory(category: string): Post[] {
  if (category === 'all') return posts
  return posts.filter((p) => p.category === category)
}

/** 按年份 + slug 找一篇文章 */
export function findPost(year: string, slug: string): Post | undefined {
  return posts.find((p) => p.year === year && p.slug === slug)
}

/**
 * 取文章正文 HTML。
 * 正文单独打包，只有打开文章详情页才会下载，首页不会因为它变慢。
 */
export async function loadBody(path: string): Promise<string> {
  const mod = (await import('@/generated/bodies.json')) as { default: PostBodies }
  return mod.default[path] ?? ''
}

/** 上一篇 / 下一篇，用于文章底部导航 */
export function adjacentPosts(post: Post): { prev?: Post; next?: Post } {
  const i = posts.findIndex((p) => p.path === post.path)
  return {
    prev: i >= 0 ? posts[i + 1] : undefined,
    next: i > 0 ? posts[i - 1] : undefined,
  }
}

/** 文章目录项 */
export interface TocEntry {
  level: 2 | 3
  text: string
  id: string
}

/** 把 HTML 里最常见的几个实体还原成字符（标题里出现引号、& 很常见） */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** 从文章 HTML 里提取 h2/h3 标题，生成侧边目录 */
export function buildToc(html: string): TocEntry[] {
  const entries: TocEntry[] = []
  const re = /<h([23])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    entries.push({
      level: Number(m[1]) as 2 | 3,
      id: m[2] ?? '',
      // 先剃掉标签，再还原实体：标题里的 " 会以 &quot; 形式出现在 HTML 中，
      // 不还原的话目录上就会直接显示 &quot; 这五个字符。
      text: decodeEntities((m[3] ?? '').replace(/<[^>]+>/g, '')).trim(),
    })
  }
  return entries
}

/** 把站内相对路径拼成带 base 的完整 URL */
export function withBase(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  const base = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** 分类 key 转中文名 */
export function categoryLabel(key: string): string {
  const map: Record<string, string> = {
    anime: '番剧',
    tech: '技术',
    essay: '随笔',
    fragment: '碎片',
  }
  return map[key] ?? key
}

export type { Post, Favorite, GalleryItem, Tool }

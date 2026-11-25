/**
 * SEO —— 每个页面调用 useSeo() 设置标题、描述、分享卡片。
 *
 * 【改某个页面的标题】在那个页面的 .vue 里改 useSeo({...}) 的内容即可。
 */
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { site } from '@/data/site.config'

interface SeoOptions {
  title?: string
  description?: string
  /** 分享卡片图，站内路径如 /art/og-default.jpg */
  image?: string
  /** 不想被搜索引擎收录的页面传 true */
  noindex?: boolean
}

/** 把站内路径拼成完整 URL（拼错一处分享卡片就是 404） */
function absolute(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  const base = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base
  return `${site.url}${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function useSeo(opts: SeoOptions = {}) {
  const title = opts.title ? `${opts.title} · ${site.title}` : site.title
  const description = opts.description ?? site.description
  const image = absolute(opts.image ?? '/art/og-default.jpg')

  // 当前页的真实地址：og:url 必须是具体页面，不能每页都写首页
  const route = useRoute()
  const url = absolute(route.path)

  useHead({
    // html 的 lang 由 unhead 输出；不写会默认成 en，中文站会被搜索引擎当英文页
    htmlAttrs: { lang: 'zh-CN' },
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: image },
      { property: 'og:url', content: url },
      { name: 'twitter:card', content: 'summary_large_image' },
      ...(opts.noindex ? [{ name: 'robots', content: 'noindex,nofollow' }] : []),
    ],
  })
}

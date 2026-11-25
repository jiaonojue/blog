import { fileURLToPath, URL } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 站点部署在 GitHub Pages 的项目仓库下，路径形如 https://<用户名>.github.io/blog/
// 这个前缀必须与仓库名一致，改了仓库名就要改这里（同时改 src/data/site.config.ts 的 base）。
const BASE = '/blog/'

/**
 * 告诉 vite-ssg 还要预渲染哪些动态路由。
 *
 * 【为什么需要这一段】
 *   vite-ssg 只能自动发现"固定路径"的路由（/posts、/about 这些）。
 *   文章详情页是 /posts/:year/:slug，它不知道到底有多少篇文章，
 *   所以默认一个都不渲染——构建出来的 dist 里根本没有文章页。
 *   后果有两个：搜索引擎抓不到文章内容；有人直接打开文章链接会 404。
 *
 *   这里读一遍 content.json（构建文章索引时已经生成好了），
 *   把每篇文章的真实路径交给 vite-ssg。
 */
function includePostRoutes(): string[] {
  const file = fileURLToPath(new URL('./src/generated/content.json', import.meta.url))
  if (!existsSync(file)) return []
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as { posts?: { path?: string }[] }
    return (data.posts ?? [])
      .map((p) => p.path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
  } catch {
    return []
  }
}

export default defineConfig({
  base: BASE,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 首屏 JS 预算 130KB（gzip），超过就报警
    chunkSizeWarningLimit: 500,
    cssCodeSplit: false,
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    // 关掉"把首屏 CSS 内联进 HTML"这个优化。
    // 它在 base 不是 '/' 时找不到样式文件路径，会刷一堆警告；
    // 我们的 CSS 只有一个文件（约 30KB），外链反而更好缓存。
    beastiesOptions: false,
    // 把每篇文章的真实路径也加进去，文章页才会被预渲染成静态 HTML。
    // 注意要把 "/posts/:year/:slug" 这种带参数的模板路由去掉——
    // 否则 vite-ssg 会试图建一个名叫 ":year" 的目录，直接报错。
    // 另外显式加一个 /404：catch-all 路由不会被自动发现，
    // 而 GitHub Pages 需要一个真的 404.html（见 scripts/postbuild.mjs）。
    includedRoutes: (paths: string[]) => [
      ...paths.filter((p) => !p.includes(':')),
      '/404',
      ...includePostRoutes(),
    ],
  },
})

/**
 * 构建后处理脚本 —— vite-ssg 构建完成后自动运行。
 *
 * 【它做什么】
 *   1. 生成 RSS（dist/rss.xml）
 *   2. 生成 sitemap（dist/sitemap.xml）
 *   3. 生成 404.html（GitHub Pages 需要它来接住错误路由）
 *   4. 跑 Pagefind 建搜索索引
 *   5. 拷一份 .nojekyll（让 Pages 别把 _ 开头的目录当特殊文件）
 *
 * 你不用改这个文件。改内容、改配置就够了。
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { site } from '../src/data/site.config.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const GEN = join(ROOT, 'src', 'generated')

if (!existsSync(DIST)) {
  console.error('[后处理] 找不到 dist 目录，构建可能失败了。')
  process.exit(1)
}

const index = JSON.parse(readFileSync(join(GEN, 'content.json'), 'utf8'))

/** 拼完整 URL */
const abs = (path) => `${site.url}${site.base.replace(/\/$/, '')}${path}`

/* ─────────────────────────────────────────────────────────────
 * 1. RSS
 * ───────────────────────────────────────────────────────────── */
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildRss() {
  const items = index.posts.slice(0, 20)
  const now = new Date().toUTCString()

  const entries = items
    .map((post) => {
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(abs(post.path))}</link>
      <guid isPermaLink="true">${escapeXml(abs(post.path))}</guid>
      <pubDate>${new Date(`${post.date}T09:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(post.summary)}</description>
      <category>${escapeXml(post.category)}</category>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${escapeXml(abs('/'))}</link>
    <description>${escapeXml(site.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${escapeXml(abs('/rss.xml'))}" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`
}

writeFileSync(join(DIST, 'rss.xml'), buildRss(), 'utf8')
console.log('[后处理] RSS 已生成')

/* ─────────────────────────────────────────────────────────────
 * 2. sitemap（单个 sitemap，不用 index，个人站用不上分片）
 * ───────────────────────────────────────────────────────────── */
function buildSitemap() {
  // 不含 credits / secret / 404
  const staticPaths = ['/', '/posts', '/favorites', '/gallery', '/about']
  const postPaths = index.posts.map((p) => p.path)
  const all = [...staticPaths, ...postPaths]

  const urls = all
    .map((p) => {
      const post = index.posts.find((x) => x.path === p)
      const lastmod = post ? (post.updated ?? post.date) : new Date().toISOString().slice(0, 10)
      return `  <url>
    <loc>${escapeXml(abs(p))}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

writeFileSync(join(DIST, 'sitemap.xml'), buildSitemap(), 'utf8')
console.log('[后处理] sitemap 已生成')

/* ─────────────────────────────────────────────────────────────
 * 3. robots.txt
 * ───────────────────────────────────────────────────────────── */
const robots = `User-agent: *
Allow: /
Disallow: /credits
Disallow: /secret

Sitemap: ${abs('/sitemap.xml')}
`
writeFileSync(join(DIST, 'robots.txt'), robots, 'utf8')

/* ─────────────────────────────────────────────────────────────
 * 4. 404.html —— GitHub Pages 会用它接住所有找不到的路径
 * ───────────────────────────────────────────────────────────── */
/*
 * vite-ssg 把 catch-all 路由渲染成 dist/404/index.html（一个目录），
 * 而 GitHub Pages 只认根目录下那个 404.html。
 *
 * 【为什么先读出来、再删掉、最后才写】
 *   第 6 步的 Pagefind 会扫整个 dist。如果 404.html 那时还在，
 *   搜索索引里就会多一条"这一页不见了"——搜索结果出现 404 页本身很怪。
 *   所以：先把内容读进内存 → 从 dist 里删掉 → 建完索引再写回来。
 *
 * 【不能拿 index.html 改名当 404】
 *   那样用户访问错地址看到的是首页内容，搜索引擎还会认为
 *   存在一个和首页完全重复的页面。
 */
const notFoundNested = join(DIST, '404', 'index.html')
const notFoundFlat = join(DIST, '404.html')
let notFoundHtml = null

/*
 * vite-ssg 对 /404 的落点有两种可能：dist/404/index.html 或 dist/404.html。
 * 两种都认，谁在就用谁，不用关心它是哪个版本的写法。
 */
const source = existsSync(notFoundFlat)
  ? notFoundFlat
  : existsSync(notFoundNested)
    ? notFoundNested
    : null

if (source) {
  notFoundHtml = readFileSync(source, 'utf8')
  // 暂时挪出 dist，免得被第 6 步的 Pagefind 收进搜索索引
  rmSync(notFoundFlat, { force: true })
  rmSync(join(DIST, '404'), { recursive: true, force: true })
  console.log('[后处理] 已取出 404 页面，暂时移出 dist（避免被搜索索引收录）')
} else {
  console.warn('[后处理] 没有找到 404 页面产物，检查 router 里的 catch-all 路由是否还在')
}

/* ─────────────────────────────────────────────────────────────
 * 5. .nojekyll —— 让 GitHub Pages 不做 Jekyll 处理
 *    （否则 _ 开头的文件/目录会被吞掉）
 * ───────────────────────────────────────────────────────────── */
writeFileSync(join(DIST, '.nojekyll'), '', 'utf8')

/* ─────────────────────────────────────────────────────────────
 * 6. Pagefind 搜索索引
 * ───────────────────────────────────────────────────────────── */
async function buildPagefind() {
  try {
    const { createIndex } = await import('pagefind')
    const { index } = await createIndex()

    /*
     * 必须指定中文，否则 Pagefind 会按默认的英文处理：
     * 英文按空格切词，中文没有空格，整段话会被当成一个巨大的"单词"，
     * 搜"番剧"永远搜不到。zh-cn 会启用中日韩的单字切分。
     */
    await index.addDirectory({ path: DIST, forceLanguage: 'zh-cn' })
    await index.writeFiles({ outputPath: join(DIST, 'pagefind') })
    console.log('[后处理] Pagefind 搜索索引已生成（zh-cn）')
  } catch (err) {
    console.warn('[后处理] Pagefind 索引失败（不影响站点运行）：', err.message)
  }
}

await buildPagefind()

/* 现在索引建好了，把 404 页写回根目录：GitHub Pages 只会认这里的 404.html */
if (notFoundHtml) {
  writeFileSync(join(DIST, '404.html'), notFoundHtml, 'utf8')
  console.log('[后处理] 404.html 已放回根目录')
}

/* ─────────────────────────────────────────────────────────────
 * 7. 检查构建产物里有没有漏掉的占位文案
 * ───────────────────────────────────────────────────────────── */
function scanForPlaceholders(dir) {
  const hits = []
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) {
        walk(p)
      } else if (entry.name.endsWith('.html')) {
        const text = readFileSync(p, 'utf8')
        for (const marker of ['TODO', '占位图', 'PLACEHOLDER', 'lorem ipsum']) {
          if (text.includes(marker)) {
            hits.push(`${p.replace(ROOT, '')}: ${marker}`)
          }
        }
      }
    }
  }
  walk(dir)
  return hits
}

const placeholders = scanForPlaceholders(DIST)
if (placeholders.length) {
  console.warn('[后处理] 发现疑似占位文案：')
  for (const h of placeholders) console.warn('  -', h)
}

console.log('[后处理] 完成')

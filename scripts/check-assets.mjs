/**
 * 资源校验 —— 检查"内容里提到的图片"是不是真的存在，以及每张图有没有登记来源。
 *
 * 【为什么需要】
 *   有两种很常见的失误：
 *     1. md 里写了 cover: /art/posts/xxx.webp，但那张图根本没放进去 → 页面上一块空白
 *     2. 放了图但忘了在 CREDITS.md 登记 → 用了来源不明的图，自己都不知道
 *   这个脚本把两种都在本地拦下来，不等到线上才发现。
 *
 * 【怎么跑】
 *   npm run check:assets
 *   或者 npm run check（会连带跑类型检查、lint、格式检查）
 *
 * 【报错了怎么办】
 *   它会把问题一条条列出来，照着改就行。
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')

const errors = []
const warnings = []

/* ─────────────────────────────────────────────────────────────
 * 读内容索引
 * ───────────────────────────────────────────────────────────── */
const indexPath = join(ROOT, 'src', 'generated', 'content.json')
if (!existsSync(indexPath)) {
  console.error('[资源校验] 找不到 content.json，先跑 npm run content:index')
  process.exit(1)
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'))

/* ─────────────────────────────────────────────────────────────
 * 1. 内容里引用的图片是否存在
 * ───────────────────────────────────────────────────────────── */
/** 把 /art/posts/x.webp 转成 public/art/posts/x.webp */
function toDiskPath(urlPath) {
  if (!urlPath || /^https?:\/\//.test(urlPath)) return null
  return join(PUBLIC, urlPath.replace(/^\//, ''))
}

function checkImage(urlPath, label) {
  const disk = toDiskPath(urlPath)
  if (!disk) return
  if (!existsSync(disk)) {
    errors.push(`${label}：找不到图片 ${urlPath}`)
    return
  }
  const size = readFileSync(disk).length
  if (size > 600 * 1024) {
    warnings.push(`${label}：${urlPath} 有 ${(size / 1024).toFixed(0)} KB，建议压到 600KB 以下`)
  }
}

for (const post of index.posts) {
  if (post.cover) checkImage(post.cover, `文章「${post.title}」`)
}
for (const fav of index.favorites) {
  if (fav.cover) checkImage(fav.cover, `收藏「${fav.title}」`)
}
for (const item of index.gallery) {
  if (item.image) checkImage(item.image, `相册「${item.title}」`)
}

/* ─────────────────────────────────────────────────────────────
 * 2. 每张图是否在 CREDITS.md 里登记
 * ───────────────────────────────────────────────────────────── */
const creditsPath = join(PUBLIC, 'art', 'CREDITS.md')
const registered = new Set()

if (existsSync(creditsPath)) {
  const lines = readFileSync(creditsPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    if (/^\|[\s:|-]+\|$/.test(trimmed)) continue
    const first = trimmed.replace(/^\|/, '').split('|')[0]?.trim().replace(/^`|`$/g, '')
    if (!first || first === '文件名') continue
    // 登记表里的路径写法，三种都认：
    //   hero.webp               → public/art/hero.webp（省事写法）
    //   posts/x.webp            → public/art/posts/x.webp
    //   ../gallery/x.webp       → public/gallery/x.webp
    //   art/posts/x.webp        → public/art/posts/x.webp
    let clean = first.replace(/^\//, '')
    if (clean.startsWith('../')) {
      clean = clean.slice(3)
    } else if (!clean.startsWith('art/') && !clean.startsWith('gallery/')) {
      clean = `art/${clean}`
    }
    registered.add(`/${clean}`)
  }
} else {
  warnings.push('找不到 public/art/CREDITS.md，无法校验素材来源')
}

/** 站上实际用到的、需要登记来源的图片 */
const usedImages = new Set()
for (const post of index.posts) {
  if (post.cover) usedImages.add(post.cover)
}
for (const fav of index.favorites) {
  if (fav.cover) usedImages.add(fav.cover)
}
for (const item of index.gallery) {
  if (item.image) usedImages.add(item.image)
}
// 主视觉 / 关于页 / 分享图是写死在模板里的
for (const fixed of ['/art/hero.webp', '/art/about.webp', '/art/og-default.jpg']) {
  usedImages.add(fixed)
}

for (const img of usedImages) {
  if (!registered.has(img)) {
    warnings.push(`${img} 没有在 CREDITS.md 登记来源`)
  }
}

/* ─────────────────────────────────────────────────────────────
 * 3. 必需文件是否齐全
 * ───────────────────────────────────────────────────────────── */
const required = ['art/favicon.svg', 'art/hero.webp', 'art/about.webp', 'art/og-default.jpg']
for (const rel of required) {
  if (!existsSync(join(PUBLIC, rel))) {
    errors.push(`缺少必需文件 public/${rel}`)
  }
}

/* ─────────────────────────────────────────────────────────────
 * 4. 内容字段的额外检查
 * ───────────────────────────────────────────────────────────── */
for (const post of index.posts) {
  if (!post.summary || post.summary.length < 10) {
    warnings.push(`文章「${post.title}」的 summary 太短，列表页会显得空`)
  }
  if (post.summary && post.summary.length > 120) {
    warnings.push(`文章「${post.title}」的 summary 超过 120 字，卡片上会被截断`)
  }
}

const sampleCount =
  index.posts.filter((p) => p.sample).length +
  index.favorites.filter((f) => f.sample).length +
  index.gallery.filter((g) => g.sample).length

/* ─────────────────────────────────────────────────────────────
 * 报告
 * ───────────────────────────────────────────────────────────── */
console.log('')
console.log('[资源校验] ──────────────────────────────')
console.log(
  `  文章 ${index.posts.length} · 收藏 ${index.favorites.length} · 相册 ${index.gallery.length} · 工具 ${index.tools.length}`,
)
if (sampleCount > 0) {
  console.log(`  其中示例内容 ${sampleCount} 项（页面上会带「示例」标签）`)
}
console.log('')

if (warnings.length) {
  console.log(`[资源校验] ${warnings.length} 条提醒：`)
  for (const w of warnings) console.log('  ·', w)
  console.log('')
}

if (errors.length) {
  console.error(`[资源校验] ${errors.length} 个错误：`)
  for (const e of errors) console.error('  ✕', e)
  console.error('')
  process.exit(1)
}

console.log('[资源校验] 通过')

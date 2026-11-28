/**
 * 内容索引构建脚本
 *
 * 【它做什么】
 *   读取 content/ 下的所有 .md 文件 → 解析 frontmatter → 用 Shiki 渲染正文 →
 *   输出两个 JSON：
 *     src/generated/content.json  文章目录、收藏、相册、工具、Now、关于（不含正文）
 *     src/generated/bodies.json   每篇文章的正文 HTML（只有文章详情页会加载）
 *
 *   分成两个文件是为了性能：首页不需要下载所有文章的正文。
 *
 * 【什么时候跑】
 *   npm run dev / npm run build 都会先自动跑。改完 md 保存，刷新浏览器就能看到。
 *
 * 【不要手动编辑 src/generated/ 下的文件】，它们是自动生成的。
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import MarkdownItAsync from 'markdown-it-async'
import { fromAsyncCodeToHtml } from '@shikijs/markdown-it/async'
import { createHighlighter } from 'shiki'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'content')
const GEN = join(ROOT, 'src', 'generated')

/** 代码高亮主题：亮色 / 暗色各一套，靠 CSS 变量切换 */
const SHIKI_THEMES = { light: 'github-light', dark: 'vitesse-dark' }

console.log('[内容索引] 启动 Shiki 高亮引擎……')
const highlighter = await createHighlighter({
  themes: Object.values(SHIKI_THEMES),
  langs: [
    'ts',
    'js',
    'json',
    'vue',
    'html',
    'css',
    'bash',
    'shell',
    'python',
    'md',
    'yaml',
    'diff',
    'powershell',
  ],
})

const md = new MarkdownItAsync({ html: false, linkify: true, typographer: false })

md.use(
  await fromAsyncCodeToHtml(
    async (code, options) => highlighter.codeToHtml(code, { ...options, themes: SHIKI_THEMES }),
    { defaultLanguage: 'text', defaultColor: 'light' },
  ),
)

/** 外链自动加 target/rel，避免被搜索引擎当成推广链接 */
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx]?.attrGet('href') ?? ''
  if (/^https?:\/\//.test(href)) {
    tokens[idx]?.attrSet('target', '_blank')
    tokens[idx]?.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/** 给所有标题加 id，文章页的侧边目录靠它跳转 */
md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const text = tokens[idx + 1]?.content ?? ''
  const id = slugify(text)
  if (id) tokens[idx]?.attrSet('id', id)
  return self.renderToken(tokens, idx, options)
}

/**
 * 把标题文字变成 URL 片段。
 *
 * 中文会保留（浏览器地址栏里能看懂），标点和空格去掉。
 * 例：「git：提交了但想改」→「git提交了但想改」
 *     「Why I Use Vue」→「why-i-use-vue」
 */
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 估算阅读时长：中文按每分钟 400 字，英文按 200 词 */
function readingMinutes(text) {
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length
  const words = text
    .replace(/[\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(chinese / 400 + words / 200))
}

/**
 * 数正文的"字数"和"小节数"，给文章页的奥付卡片用。
 *
 * 字数：去掉标签后的非空白字符数。代码块（<pre>）不算——
 *       一行 `npm run build` 只有十来个字符，却占了半屏，
 *       算进"字数"会让技术文章的篇幅虚高。
 * 小节：二级标题（##）的个数，对应奥付里的"小节"。
 *
 * 两个数字都在构建期算好写进 JSON，所以预渲染出来的 HTML 里
 * 直接就是真值，不会出现"先显示 0 再跳成 1832"的水合闪烁。
 */
function measureBody(html) {
  const withoutCode = html.replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ')
  const chars = withoutCode
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, '')
    .trim().length

  const sections = (html.match(/<h2\b/g) ?? []).length
  return { chars, sections }
}

function readDirSafe(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
}

/** 必填字段检查 —— 少了就立刻报错，不会静默生成一个坏页面 */
function assertFields(file, data, fields) {
  const missing = fields.filter((f) => data[f] === undefined || data[f] === '')
  if (missing.length) {
    throw new Error(
      `\n[内容错误] ${file}\n  缺少必填字段：${missing.join(', ')}\n  请检查文件开头 --- 之间那段。\n`,
    )
  }
}

/** 日期统一成 YYYY-MM-DD */
function toDateString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

const CATEGORY_KEYS = ['anime', 'tech', 'essay', 'fragment']

const bodies = {}

async function loadPosts() {
  const base = join(CONTENT, 'posts')
  const posts = []

  for (const yearDir of readDirSafe(base)) {
    if (!yearDir.isDirectory()) continue

    for (const entry of readDirSafe(join(base, yearDir.name))) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue

      const file = join(base, yearDir.name, entry.name)
      const raw = readFileSync(file, 'utf8')
      const { data, content } = matter(raw)

      assertFields(file, data, ['title', 'date', 'category', 'summary'])

      if (!CATEGORY_KEYS.includes(data.category)) {
        throw new Error(
          `\n[内容错误] ${file}\n  category 只能是 ${CATEGORY_KEYS.join(' / ')}，` +
            `现在写的是「${data.category}」\n`,
        )
      }

      const slug = data.slug || basename(entry.name, '.md')
      const path = `/posts/${yearDir.name}/${slug}`

      const html = await md.renderAsync(content)
      bodies[path] = html
      const { chars, sections } = measureBody(html)

      posts.push({
        title: data.title,
        date: toDateString(data.date),
        updated: data.updated ? toDateString(data.updated) : undefined,
        slug,
        year: yearDir.name,
        category: data.category,
        tags: Array.isArray(data.tags) ? data.tags : [],
        summary: data.summary,
        cover: data.cover || undefined,
        // 文章末尾「余白」那一句。写了就用，没写让组件用默认文案
        closing: data.closing ? String(data.closing).trim() : undefined,
        // 页边批注：只保留 after 是正整数的条目，写错了就当没写
        notes: Array.isArray(data.notes)
          ? data.notes
              .filter((n) => n && Number.isInteger(n.after) && n.after > 0 && n.text)
              .map((n) => ({ after: n.after, text: String(n.text).trim() }))
          : undefined,
        draft: data.draft === true,
        sample: data.sample === true,
        minutes: readingMinutes(content),
        // 奥付卡片用的两个真值，见上面的 measureBody()
        chars,
        sections,
        path,
      })
    }
  }

  // 日期新的排前面；同日期按标题排，保证每次构建顺序一致
  posts.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title),
  )
  return posts
}

function loadFavorites() {
  const items = []

  for (const entry of readDirSafe(join(CONTENT, 'favorites'))) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    const file = join(CONTENT, 'favorites', entry.name)
    const { data, content } = matter(readFileSync(file, 'utf8'))

    assertFields(file, data, ['title', 'type', 'status'])

    items.push({
      slug: basename(entry.name, '.md'),
      title: data.title,
      type: data.type,
      status: data.status,
      score: Number(data.score ?? 0),
      cover: data.cover || undefined,
      artist: data.artist || undefined,
      link: data.link || undefined,
      sample: data.sample === true,
      note: content.trim(),
    })
  }

  return items
}

function loadGallery() {
  const items = []

  for (const entry of readDirSafe(join(CONTENT, 'gallery'))) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    const file = join(CONTENT, 'gallery', entry.name)
    const { data, content } = matter(readFileSync(file, 'utf8'))

    assertFields(file, data, ['title', 'image'])

    items.push({
      title: data.title,
      date: data.date ? toDateString(data.date) : '',
      image: data.image,
      caption: (data.caption || content || '').trim(),
      sample: data.sample === true,
    })
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return items
}

function loadTools() {
  const items = []

  for (const entry of readDirSafe(join(CONTENT, 'tools'))) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    const file = join(CONTENT, 'tools', entry.name)
    const { data } = matter(readFileSync(file, 'utf8'))

    assertFields(file, data, ['name', 'desc', 'url'])

    items.push({
      name: data.name,
      desc: data.desc,
      url: data.url,
      icon: data.icon || 'link',
      group: data.group || '生活',
      sample: data.sample === true,
    })
  }

  return items
}

async function loadNow() {
  const file = join(CONTENT, 'now.md')
  if (!existsSync(file)) return { html: '', updated: '' }
  const { data, content } = matter(readFileSync(file, 'utf8'))
  return {
    html: await md.renderAsync(content),
    updated: data.updated ? toDateString(data.updated) : '',
  }
}

async function loadAbout() {
  const file = join(CONTENT, 'about.md')
  if (!existsSync(file)) return { html: '', qa: [], timeline: [] }
  const { data, content } = matter(readFileSync(file, 'utf8'))
  return {
    html: await md.renderAsync(content),
    qa: Array.isArray(data.qa) ? data.qa : [],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
  }
}

/**
 * 读仓库根目录的 CHANGELOG.md，拆成一"話一話"的目次，渲染成 /changelog 页。
 *
 * 【为什么要拆而不是整段塞进去】
 *   整段 HTML 只能做成一长条后台文档。拆成版本之后，每條能印上話号、
 *   版本胶带和日期，分类（修复 / 新增）也能做成和纸小标签——
 *   这才是这块站点"同人志目次"的样子。
 *
 * 【为什么走构建期而不是运行时】
 *   Markdown 渲染器（Shiki 高亮、标题 id、外链 target）已经在这里配好了，
 *   和 now / about 用同一套，产出的静态 HTML 也能被预渲染和搜索索引收录。
 *   运行时再引一遍 markdown-it 只会让那一页多下载一份高亮库。
 */
async function loadChangelog() {
  const file = join(ROOT, 'CHANGELOG.md')
  const empty = { html: '', updated: '', entries: [] }
  if (!existsSync(file)) return empty
  const { data, content } = matter(readFileSync(file, 'utf8'))

  // 按 `## [版本号] — 日期` 切段。段前的引言单独留着（顶部那两行说明）。
  const lines = content.split(/\r?\n/)
  const introLines = []
  const sections = []
  let current = null
  for (const line of lines) {
    const m = line.match(/^##\s+\[([^\]]+)\]\s*[—–-]\s*(\d{4}-\d{2}-\d{2})\s*$/)
    if (m) {
      current = { version: m[1].trim(), date: m[2].trim(), body: [] }
      sections.push(current)
    } else if (current) {
      current.body.push(line)
    } else {
      introLines.push(line)
    }
  }

  const entries = []
  for (const [i, sec] of sections.entries()) {
    // 每話里按 `### 分类` 切成小节，小节正文单独渲染成 HTML。
    const bodyLines = sec.body
    const groups = []
    let lead = []
    let group = null
    for (const line of bodyLines) {
      const h = line.match(/^###\s+(.+?)\s*$/)
      if (h) {
        group = { label: h[1].trim(), html: '' }
        groups.push(group)
      } else if (group) {
        group.html += `${line}\n`
      } else if (line.trim()) {
        lead.push(line)
      }
    }

    const categorized = await Promise.all(
      groups.map(async (g) => ({
        label: g.label,
        html: await md.renderAsync(g.html.trim()),
      })),
    )

    entries.push({
      // 倒序的話号：最新一条是第 1 話，往下递增
      chapter: i + 1,
      version: sec.version,
      date: sec.date,
      lead: await md.renderAsync(lead.join('\n').trim()),
      groups: categorized,
    })
  }

  // 引言里的 `# 更新记录` 和 `---` 去掉——页面自己有 h1 和分隔线，别重复
  const introText = introLines
    .join('\n')
    .replace(/^#\s+.*$/m, '')
    .replace(/^---\s*$/m, '')
    .trim()

  return {
    html: await md.renderAsync(introText),
    updated: data.updated ? toDateString(data.updated) : '',
    entries,
  }
}

/**
 * 解析 public/art/CREDITS.md 里的素材登记表。
 *
 * 【格式要求】用 Markdown 表格，表头必须包含这些列名（顺序随意）：
 *   | 文件名 | 作品名 | 作者 | 出处 | 许可 | 获取日期 | 级别 | 备注 |
 *
 * 有任何一张图没登记，构建就会失败 —— 这是为了防止用了来源不明的图。
 */
function loadCredits() {
  const file = join(ROOT, 'public', 'art', 'CREDITS.md')
  if (!existsSync(file)) return []

  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const entries = []
  let header = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) {
      header = null
      continue
    }

    // 跳过分隔行 |---|---|
    if (/^\|[\s:|-]+\|$/.test(trimmed)) continue

    const cells = trimmed
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())

    if (!header) {
      header = cells
      continue
    }

    const row = {}
    header.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })

    const fileCol = row['文件名'] ?? ''
    if (!fileCol) continue

    entries.push({
      file: fileCol.replace(/^`|`$/g, ''),
      title: row['作品名'] ?? '',
      author: row['作者'] ?? '',
      source: (row['出处'] ?? '').replace(/^<|>$/g, ''),
      license: row['许可'] ?? '',
      date: row['获取日期'] ?? '',
      level: row['级别'] ?? '',
      note: row['备注'] ?? '',
    })
  }

  return entries
}

const allPosts = await loadPosts()
const published = allPosts.filter((p) => !p.draft)

const index = {
  posts: published,
  favorites: loadFavorites(),
  gallery: loadGallery(),
  tools: loadTools(),
  now: await loadNow(),
  about: await loadAbout(),
  changelog: await loadChangelog(),
}

mkdirSync(GEN, { recursive: true })
writeFileSync(join(GEN, 'content.json'), JSON.stringify(index, null, 2), 'utf8')

// 草稿的正文也要留着，否则切回 draft: false 时不用重新构建
writeFileSync(join(GEN, 'bodies.json'), JSON.stringify(bodies), 'utf8')

// 素材来源
writeFileSync(join(GEN, 'credits.json'), JSON.stringify(loadCredits(), null, 2), 'utf8')

console.log(
  `[内容索引] 文章 ${published.length} 篇` +
    (allPosts.length !== published.length
      ? `（另有草稿 ${allPosts.length - published.length} 篇未发布）`
      : '') +
    ` · 收藏 ${index.favorites.length} 条 · 相册 ${index.gallery.length} 张 · 工具 ${index.tools.length} 个`,
)

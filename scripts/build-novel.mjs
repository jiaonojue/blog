/**
 * 小说构建 —— 把一本 EPUB 拆成网页能直接读的章节。
 *
 * 【它做什么】
 *   1. 读 BOOKS 里登记的 .epub
 *   2. 从 container.xml → OPF 里拿到书名、作者、章节顺序、图片清单
 *   3. 从 toc.ncx 里拿到每一章的标题
 *   4. 把每个正文文档洗干净，写成 public/novels/<slug>/ch-N.html
 *   5. 把图片原样解到 raw/novels/<slug>/img/，交给 optimize-novel-images.py 转 WebP
 *   6. 写 index.json（书名、作者、章节列表、封面）
 *
 * 【为什么要把 HTML 洗一遍】
 *   EPUB 里的正文是别人打包的 XHTML，里面可能有 <script>、onclick 之类的属性。
 *   这些内容最终会用 v-html 插进页面，不洗就等于把别人的脚本请进自己的站。
 *   这里用"白名单"：只保留 <p> <b> <img> 这类排版标签，
 *   属性也只留 src / alt / href，其余一律丢掉。
 *
 * 【怎么加第二本书】
 *   把 .epub 放到仓库根目录（或 raw/novels/），然后在下面 BOOKS 里加一行：
 *     { file: 'raw/novels/xxx.epub', slug: 'xxx' }
 *   slug 是网址里用的英文短名，只用小写字母、数字、连字符。
 *
 * 【注意】
 *   生成出来的 public/novels/ 默认不进仓库（见 .gitignore）。
 *   原因：这些是受版权保护的小说全文，公开部署等于公开分发。
 *   想发布的话，见 docs/EDITING.md 第 14 节。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 要构建的书。
 *   file —— 相对仓库根目录的 epub 路径
 *   slug —— 输出目录名，也是网址里的一段
 */
const BOOKS = [{ file: '13埃罗芒阿老师.epub', slug: 'eromanga-13' }]

/* ─────────────────────────────────────────────────────────────
 * 清洗：只留下排版用得上的标签和属性
 * ───────────────────────────────────────────────────────────── */

/** 允许保留的标签。其余标签一律剥掉（文字保留） */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'b',
  'i',
  'em',
  'strong',
  'h1',
  'h2',
  'h3',
  'h4',
  'img',
  'a',
  'div',
  'span',
  'hr',
  'blockquote',
  'ul',
  'ol',
  'li',
  'sub',
  'sup',
  'ruby',
  'rt',
  'rp',
])

/** 允许保留的 class —— 只认原书 CSS 里那几个排版用的 */
const ALLOWED_CLASS = new Set([
  'right',
  'left',
  'center',
  'illus',
  'cover',
  'zin',
  'bold',
  'stress',
  'author',
])

/** 自闭合 / 空元素 */
const VOID_TAGS = new Set(['br', 'img', 'hr'])

/** 整段丢弃（连同内容）的标签 */
const DROP_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'svg']

/**
 * 把一个属性串拆成 { 名字: 值 }。
 * 只认双引号 / 单引号 / 无引号三种写法，够用了。
 */
function parseAttrs(source) {
  const out = {}
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let m
  while ((m = re.exec(source)) !== null) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

/**
 * 洗一个 HTML 片段。
 *
 * @param {string} html   原始片段
 * @param {(src: string) => string | null} resolveImage
 *        把 <img src> 映射成站内路径；返回 null 表示这张图不要了
 * @param {(href: string) => string | null} resolveLink
 *        把 <a href> 映射成站内锚点；返回 null 表示这个链接不要了
 */
function sanitize(html, resolveImage, resolveLink) {
  // 先按"整段丢弃"的标签切开，这些标签里的东西连内容一起扔
  const chunks = [html]
  for (const tag of DROP_WITH_CONTENT) {
    const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi')
    for (let c = 0; c < chunks.length; c++) {
      chunks[c] = chunks[c].replace(re, '')
    }
  }
  let out = chunks.join('')

  // 再去掉注释、XML 声明、DOCTYPE
  out = out
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')

  // 逐 token 重建
  let result = ''
  const re = /<[^>]*>/g
  let last = 0
  let m
  /*
   * 被丢掉的 <a> 的层数。
   * 一个外链的 <a> 开标签被扔掉之后，对应的 </a> 也必须扔掉，
   * 否则会留下一堆没有开标签的闭合标签。
   */
  let skippedAnchors = 0
  while ((m = re.exec(out)) !== null) {
    // 标签之前的文字原样保留
    result += out.slice(last, m.index)
    last = re.lastIndex

    const token = m[0]
    const isClose = /^<\//.test(token)
    const nameMatch = /^<\/?\s*([\w:-]+)/.exec(token)
    const name = (nameMatch?.[1] ?? '').toLowerCase()

    if (!name) continue
    if (!ALLOWED_TAGS.has(name)) continue // 不认识的标签直接丢，文字会保留

    if (isClose) {
      if (name === 'a' && skippedAnchors > 0) {
        skippedAnchors -= 1
        continue
      }
      if (!VOID_TAGS.has(name)) result += `</${name}>`
      continue
    }

    const attrSource = token.replace(/^<\s*[\w:-]+/, '').replace(/\/?>$/, '')
    const attrs = parseAttrs(attrSource)

    if (name === 'img') {
      const src = resolveImage(attrs.src ?? '')
      if (!src) continue
      const alt = (attrs.alt ?? '').replace(/"/g, '')
      result += `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`
      continue
    }

    if (name === 'a') {
      const href = resolveLink(attrs.href ?? '')
      if (!href) {
        skippedAnchors += 1
        continue
      }
      result += `<a href="${href}">`
      continue
    }

    // 其余标签：只留白名单里的 class
    const cls = (attrs.class ?? '')
      .split(/\s+/)
      .filter((c) => ALLOWED_CLASS.has(c))
      .join(' ')
    result += cls ? `<${name} class="${cls}">` : `<${name}>`
  }
  result += out.slice(last)

  // 空段落、只有 <br> 的段落清掉，避免阅读器里出现大片空行
  result = result.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '').replace(/\n{3,}/g, '\n\n')

  return result.trim()
}

/** 去掉所有标签，只留文字（用来数数字、取标题） */
function textOf(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** 数字数：中文按字算，英文按词算，空白不算 */
function countChars(text) {
  const compact = text.replace(/\s+/g, '')
  return compact.length
}

/* ─────────────────────────────────────────────────────────────
 * EPUB 解析
 * ───────────────────────────────────────────────────────────── */

/** 把 OPF 里的相对路径解析成 zip 里的绝对路径 */
function resolveZipPath(baseDir, href) {
  const decoded = decodeURIComponent(href)
  const joined = posix.normalize(posix.join(baseDir, decoded))
  return joined.replace(/^\/+/, '')
}

/** 从 <navPoint> 里拿 { 标题, src } 列表 */
function parseNcx(ncxXml, ncxDir) {
  const points = []
  const re = /<navPoint\b[\s\S]*?<\/navPoint>/g
  let m
  while ((m = re.exec(ncxXml)) !== null) {
    const block = m[0]
    const label = textOf(/<text>([\s\S]*?)<\/text>/.exec(block)?.[1] ?? '')
    const src = /<content\b[^>]*\bsrc="([^"]+)"/.exec(block)?.[1] ?? ''
    if (label && src) {
      points.push({ title: label, file: resolveZipPath(ncxDir, src.split('#')[0]) })
    }
  }
  return points
}

/** 找 OPF 里某个 manifest item 的 href */
function manifestHref(opf, id) {
  const re = new RegExp(`<item\\b[^>]*\\bid="${id}"[^>]*>`, 'i')
  const tag = re.exec(opf)?.[0] ?? ''
  return /href="([^"]+)"/.exec(tag)?.[1] ?? ''
}

async function buildBook(book) {
  const epubPath = join(ROOT, book.file)
  if (!existsSync(epubPath)) {
    console.error(`[小说] 找不到 ${book.file}，跳过。`)
    return false
  }

  const zip = await JSZip.loadAsync(readFileSync(epubPath))
  const read = async (name) => {
    const f = zip.file(name)
    return f ? await f.async('string') : ''
  }

  /* ── 1. container → OPF ── */
  const container = await read('META-INF/container.xml')
  const opfPath = /full-path="([^"]+)"/.exec(container)?.[1]
  if (!opfPath) {
    console.error(`[小说] ${book.file} 里找不到 content.opf，不是标准的 EPUB。`)
    return false
  }
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const opf = await read(opfPath)

  const title = textOf(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/.exec(opf)?.[1] ?? '') || '未命名'
  const creators = [...opf.matchAll(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/g)]
    .map((m) => textOf(m[1]))
    .filter(Boolean)
  const language = textOf(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/.exec(opf)?.[1] ?? '')

  /* ── 2. spine 顺序 ── */
  const spineBlock = /<spine\b[\s\S]*?<\/spine>/.exec(opf)?.[0] ?? ''
  const spineIds = [...spineBlock.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map((m) => m[1])

  /* ── 3. NCX 标题 ── */
  const ncxHref = manifestHref(opf, 'ncx') || 'toc.ncx'
  const ncxPath = resolveZipPath(opfDir, ncxHref)
  const ncx = await read(ncxPath)
  const ncxDir = ncxPath.includes('/') ? ncxPath.slice(0, ncxPath.lastIndexOf('/') + 1) : ''
  const toc = parseNcx(ncx, ncxDir)
  const titleByFile = new Map(toc.map((t) => [t.file, t.title]))

  /* ── 4. 图片清单 ── */
  const imageItems = [...opf.matchAll(/<item\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => /media-type="image\//.test(tag))
    .map((tag) => ({
      href: /href="([^"]+)"/.exec(tag)?.[1] ?? '',
      id: /\bid="([^"]+)"/.exec(tag)?.[1] ?? '',
    }))
    .filter((x) => x.href)

  const imageByZipPath = new Map()
  for (const item of imageItems) {
    const zipPath = resolveZipPath(opfDir, item.href)
    // 统一命名成 img-01.webp 这种，避免原文件名里带 %7b 之类的转义
    const base = posix.basename(zipPath)
    const stem = base.replace(/\.[^.]+$/, '')
    const safe = /^[\w-]+$/.test(stem) ? stem : `img-${imageByZipPath.size + 1}`
    imageByZipPath.set(zipPath, { name: `${safe}.webp`, zipPath })
  }

  /* ── 5. 输出目录 ── */
  const outDir = join(ROOT, 'public', 'novels', book.slug)
  const rawDir = join(ROOT, 'raw', 'novels', book.slug, 'img')
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  mkdirSync(rawDir, { recursive: true })

  /* ── 6. 逐章清洗 ── */
  const chapters = []
  let index = 0

  for (const idref of spineIds) {
    const href = manifestHref(opf, idref)
    if (!href) continue
    const zipPath = resolveZipPath(opfDir, href)
    const raw = await read(zipPath)
    if (!raw) continue

    const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(raw)?.[1] ?? raw
    const docDir = zipPath.includes('/') ? zipPath.slice(0, zipPath.lastIndexOf('/') + 1) : ''

    // 标题：NCX 优先，其次第一个 <h1>，最后兜底
    const firstH1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(body)?.[1] ?? ''
    const h1Text = textOf(firstH1)
    let chapterTitle = titleByFile.get(zipPath) || h1Text
    if (!chapterTitle) {
      chapterTitle = /目录/.test(textOf(body)) ? '彩页 · 目录' : `第 ${index + 1} 节`
    }

    index += 1
    const file = `ch-${index}.html`

    // 章节之间的链接改成阅读器内部锚点
    // 先占位：清洗时还拿不到最终编号，所以这里先记下目标，清洗完再统一替换成 #ch-N
    const linkTargets = []

    const cleaned = sanitize(
      body,
      (src) => {
        if (!src) return null
        if (/^(?:https?:|data:|javascript:)/i.test(src)) return null
        const target = resolveZipPath(docDir, src.split('#')[0])
        const hit = imageByZipPath.get(target)
        return hit ? `img/${hit.name}` : null
      },
      (href) => {
        if (!href) return null
        if (/^(?:https?:|javascript:|mailto:)/i.test(href)) return null
        const target = resolveZipPath(docDir, href.split('#')[0])
        linkTargets.push(target)
        return `__CH__${target}__`
      },
    )

    chapters.push({
      no: index,
      title: chapterTitle,
      file,
      zipPath,
      linkTargets,
      html: cleaned,
      chars: countChars(textOf(cleaned)),
      hasImages: /<img\b/.test(cleaned),
    })
  }

  // 现在所有章节都编好号了，把 __CH__xxx__ 换成 #ch-N
  const noByZipPath = new Map(chapters.map((c) => [c.zipPath, c.no]))
  for (const ch of chapters) {
    ch.html = ch.html.replace(/__CH__(.+?)__/g, (whole, target) => {
      const no = noByZipPath.get(target)
      return no ? `#ch-${no}` : whole
    })
    // 没替换掉的（指向书外）变成纯文字
    ch.html = ch.html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, (whole, inner) => {
      return /__CH__/.test(whole) ? inner : whole
    })
    delete ch.linkTargets
    delete ch.zipPath
  }

  /* ── 7. 去掉正文开头重复的章节标题 ── */
  for (const ch of chapters) {
    const lead = new RegExp(`^\\s*<h1[^>]*>([\\s\\S]*?)</h1>`, 'i')
    const m = lead.exec(ch.html)
    if (m && textOf(m[1]) === ch.title) {
      ch.html = ch.html.slice(m[0].length).trim()
    }
  }

  /* ── 8. 写章节文件 ── */
  for (const ch of chapters) {
    writeFileSync(join(outDir, ch.file), ch.html, 'utf8')
    delete ch.html
  }

  /* ── 9. 解图片（原图，交给 Python 转 WebP）── */
  let imageCount = 0
  for (const { name, zipPath } of imageByZipPath.values()) {
    const buf = await zip.file(zipPath)?.async('nodebuffer')
    if (!buf) continue
    const outName = name.replace(/\.webp$/, posix.extname(zipPath))
    writeFileSync(join(rawDir, outName), buf)
    imageCount += 1
  }

  /* ── 10. 封面 ── */
  // OPF 里的 <meta name="cover" content="x01.jpg"/> 指向封面那张图的 id
  const coverId = /<meta\b[^>]*name="cover"[^>]*content="([^"]+)"/.exec(opf)?.[1] ?? ''
  const coverHref = coverId ? manifestHref(opf, coverId) : ''
  const coverZipPath = coverHref ? resolveZipPath(opfDir, coverHref) : ''
  const coverHit = imageByZipPath.get(coverZipPath)
  const cover = coverHit ? `img/${coverHit.name}` : chapters.find((c) => c.hasImages) ? null : null

  /* ── 11. index.json ── */
  const bookIndex = {
    slug: book.slug,
    title,
    authors: creators,
    language,
    cover,
    chapters: chapters.map((c) => ({
      no: c.no,
      title: c.title,
      file: c.file,
      chars: c.chars,
    })),
    totalChars: chapters.reduce((n, c) => n + c.chars, 0),
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(bookIndex, null, 2), 'utf8')

  console.log(`[小说] 《${title}》`)
  console.log(`  作者：${creators.join(' / ') || '未署名'} · 语言：${language || '未标注'}`)
  console.log(
    `  章节 ${chapters.length} 个 · 图片 ${imageCount} 张 · 正文 ${bookIndex.totalChars} 字`,
  )
  for (const c of chapters) {
    console.log(`    ${String(c.no).padStart(2, '0')}  ${c.title}  (${c.chars} 字)`)
  }
  console.log(`  输出：public/novels/${book.slug}/`)
  console.log(`  原图：raw/novels/${book.slug}/img/（下一步转 WebP）`)
  return true
}

let ok = 0
for (const book of BOOKS) {
  if (await buildBook(book)) ok += 1
}
console.log(`[小说] 完成 ${ok}/${BOOKS.length} 本`)

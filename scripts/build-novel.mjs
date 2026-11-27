/**
 * 小说构建 —— 把一本书（EPUB 或 TXT）拆成网页能直接读的章节。
 *
 * 【它做什么】
 *   1. 读 BOOKS 里登记的 .epub（默认），或者命令行给的文件：
 *        npm run novel                          ← 构建默认那本 EPUB
 *        npm run novel 我的书.epub              ← 构建自己的 EPUB
 *        npm run novel 我的书.txt               ← 构建自己的 TXT（按"第X章"分节）
 *        npm run novel a.epub b.txt             ← 一次多本
 *   2. EPUB：从 container.xml → OPF 里拿到书名、作者、章节顺序、图片清单，
 *      从 toc.ncx 里拿到每一章的标题
 *   3. TXT：按「第X章 / 第X节 / 卷X / 序章 / 番外」这类标题行分节；
 *      一处标题都没有就整本作一节。GBK 编码的文件会自动转成 UTF-8
 *   4. 把每个正文文档洗干净，写成 public/novels/<slug>/ch-N.html
 *   5. 把图片原样解到 raw/novels/<slug>/img/，交给 optimize-novel-images.py 转 WebP
 *   6. 写 index.json（书名、作者、章节列表、封面），
 *      并把这本书登记进 public/novels/books.json（阅读器的"书架"）
 *
 * 【为什么要把 HTML 洗一遍】
 *   EPUB 里的正文是别人打包的 XHTML，里面可能有 <script>、onclick 之类的属性。
 *   这些内容最终会用 v-html 插进页面，不洗就等于把别人的脚本请进自己的站。
 *   这里用"白名单"：只保留 <p> <b> <img> 这类排版标签，
 *   属性也只留 src / alt / href，其余一律丢掉。
 *
 * 【slug 怎么来】
 *   默认取文件名里的英文/数字（"MyBook_v2.epub" → mybook-v2）；
 *   中文文件名取不出来时会用 book-<8位哈希> 兜底。
 *   想指定成好记的名字：npm run novel 我的书.txt --slug mybook
 *   （注意：换了 slug，读者旧的阅读进度就对不上号了，最好一次定好）
 *
 * 【正文会进仓库】
 *   生成出来的 public/novels/<slug>/ 是网站的一部分，跟着仓库走。
 *   商业出版物的全文公开分发有版权风险（见 docs/EDITING.md 第 14 节）；
 *   自己的同人/公版书随便发。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname, posix, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 要构建的书（默认清单）。
 *   file —— 相对仓库根目录的文件路径
 *   slug —— 输出目录名，也是网址里的一段
 * 命令行传了文件时，这份清单被忽略。
 */
const BOOKS = [{ file: '13埃罗芒阿老师.epub', slug: 'eromanga-13' }]

/* ─────────────────────────────────────────────────────────────
 * 命令行参数
 * ───────────────────────────────────────────────────────────── */

/**
 * 解析命令行：
 *   node scripts/build-novel.mjs a.epub b.txt --slug xxx
 * --slug 只对"紧接着的那一本"生效；两本书想各自指定就写两个 --slug。
 */
function parseArgs(argv) {
  const jobs = []
  let pendingSlug = null
  for (const arg of argv) {
    const slugMatch = /^--(?:slug|书名)=(.+)$/.exec(arg)
    if (slugMatch) {
      pendingSlug = slugMatch[1].trim().toLowerCase()
      continue
    }
    if (arg.startsWith('--')) continue // 其它开关先不认识
    jobs.push({ file: arg, slug: pendingSlug })
    pendingSlug = null
  }
  return jobs
}

/** 从文件名生成 slug：保留英文数字，中文文件名兜底成 book-<哈希> */
function slugFromFile(file) {
  const stem = basename(file).replace(/\.[^.]+$/, '')
  const ascii = stem
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii.length >= 2) return ascii
  const hash = createHash('sha256').update(stem, 'utf8').digest('hex').slice(0, 8)
  return `book-${hash}`
}

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
  return { slug: book.slug, index: bookIndex }
}

/* ─────────────────────────────────────────────────────────────
 * TXT 解析
 * ───────────────────────────────────────────────────────────── */

/**
 * 读一个文本文件，编码自动猜。
 *
 * 【为什么猜编码】
 *   网上流通的中文 TXT 一半是 UTF-8，一半是 GBK（老编辑器存的）。
 *   按 UTF-8 读 GBK 文件会得到满屏 U+FFFD（问号方块）。
 *   先按 UTF-8 读，坏字比例超过 0.5% 就改按 GBK 再读一遍。
 */
function readTextFile(path) {
  const buf = readFileSync(path)
  const utf8 = buf.toString('utf8')
  const bad = (utf8.match(/\uFFFD/g) ?? []).length
  if (bad / Math.max(1, utf8.length) < 0.005) return utf8
  try {
    const gbk = new TextDecoder('gbk').decode(buf)
    console.log('[小说] 这个文件是 GBK 编码，已经转成 UTF-8。')
    return gbk
  } catch {
    console.warn('[小说] 按 GBK 解码失败，继续用 UTF-8 的结果（可能有方块）。')
    return utf8
  }
}

/**
 * 章节标题行。
 *
 * 【为什么后面要跟分隔符或行尾】
 *   「番外」「序」这些字也会出现在正文句子的开头
 *   （"番外的正文。""序幕拉开了"）。不加这道闸，
 *   正文会被误切成一堆一行的"章"。
 *   所以：标题词后面必须是冒号、间隔点、空白或行尾。
 *   「第二天他走了」这种也切不了——「天」不在单位表里。
 */
const CHAPTER_TITLE_WORD =
  '(?:第[0-9〇零一二三四五六七八九十百千万两]+[章話卷节回部话]|序章|(?:前言|自序|引子|楔子|后记|尾声|终章)(?=[：:・\\s]|$)|番外[0-9〇零一二三四五六七八九十百千万两]*(?=[：:・\\s]|$))'
const CHAPTER_LINE = new RegExp(
  `^[ \\t]*(?:#{1,3}[ \\t]+)?(${CHAPTER_TITLE_WORD})[^\\n]{0,40}[ \\t]*$`,
  'gm',
)

/** HTML 转义（TXT 里的 < > & 都是普通字符，要转成实体再放进 HTML） */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 把整本 TXT 切成章节。
 *
 * 【分节的规则】
 *   逐行扫，命中标题行就开新章；标题之间的段落各归各章。
 *   一个标题都没有 → 整本作一节（标题用文件名）。
 *   空行只是段落间隔，不产生新章。
 */
function splitTxtChapters(text, fallbackTitle) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  const hits = []
  for (let i = 0; i < lines.length; i++) {
    CHAPTER_LINE.lastIndex = 0
    const m = CHAPTER_LINE.exec(lines[i])
    if (m) {
      // 标题取整行（含"番外 一点闲话"的后半截），正则只负责"这行是不是标题"
      const title = m[0].trim().replace(/^#{1,3}\s*/, '')
      if (title.length <= 40) hits.push({ line: i, title })
    }
  }

  if (hits.length === 0) {
    const body = lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join('\n')
    return [{ title: fallbackTitle, html: body || '<p>（这一册是空的。）</p>' }]
  }

  const chapters = []
  // 第一章标题之前的零散文字（书名、作者声明之类）作一个"扉页"小节，别丢
  if (hits[0].line > 0) {
    const head = lines
      .slice(0, hits[0].line)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join('\n')
    if (head) chapters.push({ title: '扉页', html: head })
  }

  for (let h = 0; h < hits.length; h++) {
    const from = hits[h].line + 1
    const to = h + 1 < hits.length ? hits[h + 1].line : lines.length
    const body = lines
      .slice(from, to)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join('\n')
    chapters.push({
      title: hits[h].title,
      html: body || '<p>（这一节没有正文。）</p>',
    })
  }
  return chapters
}

/**
 * 构建一本 TXT。
 * 输出结构和 EPUB 完全一致（index.json + ch-N.html），
 * 所以阅读器不需要知道书是怎么来的。
 */
async function buildTxtBook(job) {
  const txtPath = join(ROOT, job.file)
  if (!existsSync(txtPath)) {
    console.error(`[小说] 找不到 ${job.file}，跳过。`)
    return null
  }

  const slug = job.slug || slugFromFile(job.file)
  const title =
    basename(job.file)
      .replace(/\.[^.]+$/, '')
      .trim() || '未命名'
  const raw = readTextFile(txtPath)
  const parts = splitTxtChapters(raw, title)
  if (!parts.length) {
    console.error(`[小说] ${job.file} 是空的，跳过。`)
    return null
  }

  const outDir = join(ROOT, 'public', 'novels', slug)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const chapters = parts.map((p, i) => {
    const file = `ch-${i + 1}.html`
    writeFileSync(join(outDir, file), p.html, 'utf8')
    return {
      no: i + 1,
      title: p.title,
      file,
      chars: countChars(p.html.replace(/<[^>]+>/g, '')),
    }
  })

  const bookIndex = {
    slug,
    title,
    authors: [],
    language: 'zh',
    cover: null,
    chapters,
    totalChars: chapters.reduce((n, c) => n + c.chars, 0),
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(bookIndex, null, 2), 'utf8')

  console.log(`[小说] 《${title}》（TXT）`)
  console.log(`  章节 ${chapters.length} 个 · 正文 ${bookIndex.totalChars} 字`)
  for (const c of chapters.slice(0, 12)) {
    console.log(`    ${String(c.no).padStart(2, '0')}  ${c.title}  (${c.chars} 字)`)
  }
  if (chapters.length > 12) console.log(`    …… 其余 ${chapters.length - 12} 节略`)
  console.log(`  输出：public/novels/${slug}/`)
  return { slug, index: bookIndex }
}

/* ─────────────────────────────────────────────────────────────
 * 书架登记：public/novels/books.json
 * ───────────────────────────────────────────────────────────── */

/**
 * 把这次构建的书合并进书架。
 *
 * 【为什么是"合并"而不是"重写"】
 *   一次命令往往只构建一本，书架上其它书的信息不能被冲掉。
 *   同 slug 覆盖，其余保留；顺便清掉目录已经不存在的死条目。
 */
function updateShelf(built) {
  if (!built.length) return
  const shelfPath = join(ROOT, 'public', 'novels', 'books.json')
  let books = []
  if (existsSync(shelfPath)) {
    try {
      books = JSON.parse(readFileSync(shelfPath, 'utf8')).books ?? []
    } catch {
      books = []
    }
  }

  for (const { slug, index } of built) {
    const entry = {
      slug,
      title: index.title,
      authors: index.authors,
      chapters: index.chapters.length,
      chars: index.totalChars,
    }
    const at = books.findIndex((b) => b.slug === slug)
    if (at >= 0) books[at] = entry
    else books.push(entry)
  }

  // 只留目录真实存在的
  const novelsDir = join(ROOT, 'public', 'novels')
  books = books.filter((b) => existsSync(join(novelsDir, b.slug, 'index.json')))

  writeFileSync(shelfPath, JSON.stringify({ books }, null, 2), 'utf8')
  console.log(`[小说] 书架登记：public/novels/books.json（共 ${books.length} 本）`)
}

/* ─────────────────────────────────────────────────────────────
 * 入口
 * ───────────────────────────────────────────────────────────── */

const cliJobs = parseArgs(process.argv.slice(2))
const jobs = cliJobs.length
  ? cliJobs.map((j) => ({
      file: j.file,
      slug: j.slug ?? slugFromFile(j.file),
      kind: extname(j.file).toLowerCase() === '.txt' ? 'txt' : 'epub',
    }))
  : BOOKS.map((b) => ({ ...b, kind: 'epub' }))

const built = []
let okCount = 0
for (const job of jobs) {
  try {
    // 两种构建都返回 { slug, index }；失败返回 null / false
    const result = job.kind === 'txt' ? await buildTxtBook(job) : await buildBook(job)
    if (result) {
      built.push(result)
      okCount += 1
    }
  } catch (err) {
    console.error(`[小说] ${job.file} 构建失败：${err.message}`)
  }
}

updateShelf(built)
console.log(`[小说] 完成 ${okCount}/${jobs.length} 本`)

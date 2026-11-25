/**
 * 新建文章 —— 不用手写 frontmatter，回答几个问题就生成一个 md 文件。
 *
 * 【怎么用】
 *   npm run new:post
 *
 * 它会问你：标题、分类、摘要、标签，然后自动：
 *   1. 按今天的日期算出该放哪个年份目录
 *   2. 从标题生成文件名（英文/数字保留，中文转成拼音不方便，所以用日期+序号兜底）
 *   3. 写好 frontmatter 和正文框架
 *   4. 打开编辑器（如果检测到）
 *
 * 【不想用它也行】
 *   直接在 content/posts/2026/ 下新建一个 .md 文件，照着现有文章的
 *   frontmatter 抄一份，改改就行。这个脚本只是省事。
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const POSTS = join(ROOT, 'content', 'posts')

const CATEGORIES = {
  1: { key: 'anime', label: '番剧' },
  2: { key: 'tech', label: '技术' },
  3: { key: 'essay', label: '随笔' },
  4: { key: 'fragment', label: '碎片' },
}

const rl = createInterface({ input: process.stdin, output: process.stdout })

function today() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 从标题生成 slug：保留英文数字，中文丢掉，末尾用日期保证唯一 */
function makeSlug(title) {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  if (ascii.length >= 3) return ascii

  // 中文标题没法转成好看的 slug，用日期 + 时分
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `post-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

try {
  console.log('')
  console.log('新建一篇文章')
  console.log('─────────────────────────────')

  const title = (await rl.question('标题：')).trim()
  if (!title) {
    console.log('标题不能为空。')
    process.exit(1)
  }

  console.log('')
  console.log('分类：')
  for (const [k, v] of Object.entries(CATEGORIES)) {
    console.log(`  ${k}. ${v.label}`)
  }
  const catInput = (await rl.question('选一个（直接回车 = 3 随笔）：')).trim() || '3'
  const category = CATEGORIES[catInput]?.key ?? 'essay'

  const summary = (await rl.question('摘要（一句话，会显示在列表卡片上）：')).trim()

  const tagsInput = (await rl.question('标签（用空格分开，可留空）：')).trim()
  const tags = tagsInput
    ? tagsInput
        .split(/[\s,，]+/)
        .filter(Boolean)
        .map((t) => t.replace(/^#/, ''))
    : []

  const date = today()
  const year = date.slice(0, 4)
  const slug = makeSlug(title)
  const dir = join(POSTS, year)
  const file = join(dir, `${slug}.md`)

  if (existsSync(file)) {
    console.log('')
    console.log(`已经有一个同名文件了：${file}`)
    console.log('换个标题，或者直接去改那个文件。')
    process.exit(1)
  }

  const tagLine = tags.length ? `[${tags.join(', ')}]` : '[]'

  const content = `---
title: ${title}
date: ${date}
category: ${category}
tags: ${tagLine}
summary: ${summary || '（还没写摘要）'}
# cover: /art/posts/你的封面.webp
# draft: true          # 想先在本地写、不发布，把这行的 # 去掉
# sample: true         # 示例内容才加这行，页面上会显示「示例」标签
---

正文从这里开始。支持 Markdown：

## 二级标题

普通段落。**加粗**、*斜体*、\`行内代码\`。

- 列表一
- 列表二

> 引用。

\`\`\`ts
// 代码块会自动高亮
console.log('hello')
\`\`\`
`

  mkdirSync(dir, { recursive: true })
  writeFileSync(file, content, 'utf8')

  console.log('')
  console.log('已创建：')
  console.log(`  content/posts/${year}/${slug}.md`)
  console.log('')
  console.log('接下来：')
  console.log('  1. 打开这个文件，把正文写了')
  console.log('  2. 存盘，浏览器会自动刷新')
  console.log('  3. 写完了就跑 git add . && git commit -m "新文章" && git push')
  console.log('')
} finally {
  rl.close()
}

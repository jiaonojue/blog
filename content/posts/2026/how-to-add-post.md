---
title: 怎么往这个站加一篇文章
date: 2026-11-26
category: tech
tags: [教程, 写作, 维护]
summary: 从"新建一个 md 文件"到"网页上能看到"，中间只有一步。这篇把四个版块的区别、frontmatter 每个字段的意思、以及最容易出错的地方都写清楚。
sample: true
closing: 加文章这件事，应该比写文章更省事。
notes:
  - after: 1
    text: 只有这一步是必须的
  - after: 5
    text: 这个字段决定文章进哪个版块
---

这个站的内容全都在 `content/` 文件夹里，没有一个字写在代码里。加文章就是加一个 `.md` 文件，保存之后刷新浏览器就能看到。

## 最短的一条路

1. 在 `content/posts/2026/` 里新建一个文件，比如 `my-first-post.md`。
2. 把下面这段复制进去，改掉标题和日期：

```markdown
---
title: 我的第一篇文章
date: 2026-11-26
category: essay
tags: [随笔]
summary: 一句话说明这篇写了什么，会显示在文章列表的卡片上。
---

正文从这里开始。

## 小标题

段落。
```

3. 保存。如果 `npm run dev` 正在跑，浏览器会自动刷新，文章就在列表里了。

文件名会变成网址。上面这个文件，网址就是 `/posts/2026/my-first-post`。

## 四个版块的区别

`category` 只有四个可选值，写错了构建会直接报错并告诉你是哪个文件：

| 值         | 版块 | 写什么                   |
| ---------- | ---- | ------------------------ |
| `anime`    | 番剧 | 看番感想、评价、追番记录 |
| `tech`     | 技术 | 代码、工具、踩坑记录     |
| `essay`    | 随笔 | 想法、日记式的长文       |
| `fragment` | 碎片 | 短的备忘录、清单、片段   |

文章列表页的筛选器就是按这个字段分的。同一个文件放在哪个年份文件夹，决定的是网址里的年份，和版块无关——`content/posts/2025/xxx.md` 就是 2025 年的文章。

## frontmatter 每个字段

两个 `---` 之间那段叫 frontmatter。只有前四个是必填的。

```yaml
---
# ── 必填 ──
title: 文章标题
date: 2026-11-26 # 只能写 YYYY-MM-DD
category: essay # anime / tech / essay / fragment
summary: 一句话摘要 # 列表卡片上显示，建议 40–80 字

# ── 可选 ──
updated: 2026-12-01 # 改过就写上，详情页会显示"更新于"
tags: [随笔, 生活] # 标签，列表页可以按标签筛
cover: /art/posts/xxx.webp # 封面图，路径从 public/ 开始
closing: 一句收尾的话 # 文章末尾「余白」那一屏，不写就用默认的
draft: true # 草稿：本地能看到，构建时不会被发布
sample: true # 示例内容：卡片上会盖一个 SAMPLE 标签
notes: # 页边批注，见下面
  - after: 3
    text: 这一段的旁边会浮出这句话
---
```

## 加封面图

1. 把图片放进 `public/art/posts/`，文件名用小写英文，比如 `my-cover.webp`。
2. frontmatter 里写 `cover: /art/posts/my-cover.webp`。
3. **去 `public/art/CREDITS.md` 登记来源**。没登记的话 `npm run check:assets` 会提醒你。

图片尺寸建议 1600×900，压到 200KB 以内。工具箱里的「图片压缩」工具可以直接做这件事：拖进去，选「文章封面」，下载，放到对应目录。

## 页边批注

`notes` 是给正文加旁注用的。`after` 是第几段之后（从 1 数，只数正文里的普通段落，标题和代码块不算），`text` 是那句话。

宽屏（1280px 以上）才会显示，位置在正文右侧的留白里，不会影响正文排版。窄屏自动隐藏。

## 常见错误

**构建报「缺少必填字段」**
某个必填字段没写，或者写成了空字符串。错误信息里会给出文件名。

**构建报「category 只能是 …」**
`category` 写成了 `番剧` 或 `anime ` （带空格）。必须是四个英文 key 之一。

**文章不出现**
先看是不是写了 `draft: true`。草稿不会进构建产物，本地 dev 也看不到。

**日期显示成 2026.11.26 但排序不对**
排序是按 `date` 字符串比的，格式必须是 `YYYY-MM-DD`。写成 `2026/11/26` 或 `26-11-2026` 都会排错。

**改了 md 但页面没变**
`npm run dev` 在跑的话，改 `content/` 下的文件会自动重新构建索引并刷新。如果没反应，重启一下 dev。

## 在网页上直接改

不想开本地环境的话，GitHub 网页上也能改：

1. 打开仓库，进 `content/posts/2026/`。
2. 右上角「Add file」→「Create new file」。
3. 文件名写 `xxx.md`，内容按上面的模板写。
4. 拉到下面点「Commit changes」。

GitHub Actions 会自动重新构建并部署，大约两三分钟。具体步骤在 `docs/DEPLOY.md` 里。

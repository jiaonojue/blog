---
title: 为什么我用 Vue 重写了一个静态博客
date: 2026-11-22
category: tech
tags: [Vue, 构建, 折腾]
summary: 静态博客不需要框架。但我想要路由转场、想要主题切换、想要组件复用，所以我加了框架，然后花了很多时间在"怎么让它不要变重"这件事上。
cover: /art/posts/vue-ssg.webp
sample: true
---

先说结论：**这个站点的价值不在技术选型，而在我能自己改。**

如果只是想写文章，Hugo 或者纯 HTML 更快。我选 Vue，是因为我不想每次改样式都去翻一堆模板语法，也不想为了一个"卡片悬停上浮"去抄 CSS。

## 为什么最后还是预渲染

单页应用的通病：打开 `/posts/2019/hello` 时，服务器上没有这个文件。

GitHub Pages 是纯静态托管，它不会给你做 fallback 到 index 的重写（除非你放一个 404.html 做脏活）。结果就是：第一次打开能进去，刷新变 404。

vite-ssg 解决的就是这个。它在构建时跑一遍你的应用，把每个路由抓成一个 HTML 文件：

```ts
export default defineConfig({
  base: '/blog/',
  plugins: [vue()],
  ssgOptions: {
    // 生成的脚本用 async，不阻塞首屏
    script: 'async',
    // 产物里的 HTML 压掉多余空白
    formatting: 'minify',
  },
})
```

构建完 `dist/` 里是：

```
dist/
├── index.html
├── posts/
│   ├── index.html
│   └── 2026/
│       └── frieren/
│           └── index.html
└── assets/
```

每个都是一份真的 HTML。所以：

1. 搜索引擎能抓到内容
2. 刷新不会 404
3. 首屏不用等 JS 下载完才有字

## 内容为什么要分成两个 JSON

一开始我把所有文章的正文 HTML 塞进一个 json，一起打包。

结果首页要下载 400KB 的正文，只为了显示十张卡片。

后来改成两个文件：

| 文件           | 内容                   | 谁需要         |
| -------------- | ---------------------- | -------------- |
| `content.json` | 标题、日期、标签、摘要 | 所有页面       |
| `bodies.json`  | 正文 HTML              | 只有文章详情页 |

详情页里这样拿：

```ts
async function loadBody(path: string) {
  const bodies = await import('@/generated/bodies.json')
  return bodies.default[path] ?? ''
}
```

因为是动态 import，Vite 会把它单独打成一个 chunk。首页永远不碰它。

## 代码高亮为什么不放客户端

常规做法是引一个高亮库，在浏览器里对着 `<pre><code>` 跑一遍。

问题有两个：

- 高亮库本身几百 KB
- 跑高亮会阻塞主线程，长文会明显卡一下

所以我把高亮放在构建时做。Markdown 转 HTML 的时候就直接输出带颜色的 `<span>`：

```js
md.use(
  await fromAsyncCodeToHtml(
    async (code, options) => highlighter.codeToHtml(code, { ...options, themes: SHIKI_THEMES }),
    { defaultLanguage: 'text', defaultColor: 'light' },
  ),
)
```

代价是：客户端拿到的 HTML 会大一点（因为每个词都包了 span）。但因为正文本来就按需加载，这个代价可以接受。

## 双主题怎么不写两遍样式

两套主题，如果每个组件都写 `[data-theme='neon'] .card { ... }`，那维护起来是灾难。

我的做法是把颜色收进 CSS 变量：

```css
:root,
[data-theme='daylight'] {
  --bg: #fff8f4;
  --ink: #211c22;
  --accent: #ff5c8a;
}

[data-theme='neon'] {
  --bg: #0b0a12;
  --ink: #f3efff;
  --accent: #ff4d9d;
}
```

组件里只写一次：

```css
.card {
  background: var(--bg);
  color: var(--ink);
  border: 2px solid var(--ink);
}
```

换主题时只是 `<html>` 上的一个属性变了，所有 `var()` 自动更新。**样式表一份都不用重写。**

顺便说，代码高亮也是这么做的。Shiki 输出时同时给亮色和暗色的颜色：

```css
.prose .shiki span {
  color: var(--shiki-light);
}

[data-theme='neon'] .prose .shiki span {
  color: var(--shiki-dark);
}
```

## 值不值得

如果你只是想写东西，不值得。用现成的静态站点生成器，十分钟能上线。

如果你像我一样，觉得"这个卡片圆角想改成 24px"是一个会反复出现的念头，那就值得。因为改一行 CSS 就能看到结果，比在别人的主题里找变量快得多。

代价是你要维护它。这个代价是真的。

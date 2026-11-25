# 架构说明

> 想知道这东西内部怎么运转的看这份。只想改内容的话，看 [EDITING.md](EDITING.md) 就够了。

---

## 一句话概括

**Markdown 文件 → 构建脚本变成 JSON → Vue 在构建时把每个页面渲染成 HTML → 上传到 GitHub Pages。**

浏览器拿到的是一堆纯静态文件。没有服务器在跑，没有数据库，没有 API。

---

## 整体流程

```mermaid
flowchart TD
    subgraph 内容["内容层（你写的）"]
        MD["content/**/*.md<br/>文章 / 收藏 / 相册 / 工具"]
        ART["public/art/**<br/>插画、封面"]
        CFG["src/data/site.config.ts<br/>站名、导航、开关"]
    end

    subgraph 构建期["构建期（npm run build）"]
        IDX["build-content-index.mjs<br/>① 扫描 md，渲染 Markdown → HTML<br/>② 生成 content.json + bodies.json"]
        SSG["vite-ssg<br/>③ 每个路由渲染成真实 HTML"]
        POST["postbuild.mjs<br/>④ RSS / sitemap / robots<br/>⑤ 404.html<br/>⑥ Pagefind 索引"]
    end

    subgraph 产物["产物（dist/）"]
        HTML["每个页面一个 index.html"]
        ASSETS["assets/*.js · *.css · 图片"]
        META["rss.xml · sitemap.xml · 404.html"]
        PF["pagefind/<br/>搜索索引"]
    end

    Browser["浏览器"]
    Pages["GitHub Pages"]

    MD --> IDX
    IDX --> SSG
    CFG --> SSG
    SSG --> POST
    SSG --> HTML
    POST --> META
    POST --> PF
    ART --> ASSETS
    HTML --> Pages
    ASSETS --> Pages
    META --> Pages
    PF --> Pages
    Pages --> Browser
```

---

## 三个阶段

### 阶段一：内容索引（`scripts/build-content-index.mjs`）

扫描 `content/` 下所有 `.md`，做三件事：

1. **解析 frontmatter**（两个 `---` 之间的 YAML），校验必填字段
2. **把正文 Markdown 渲染成 HTML**，代码块用 Shiki 高亮
3. **输出两份文件**：
   - `src/generated/content.json` —— 所有文章的**元数据**（标题、日期、摘要、标签……），不含正文
   - `src/generated/bodies.json` —— 文章**正文**的 HTML，按路径索引

**为什么拆成两份**：首页、列表页只需要元数据。如果正文跟元数据打包在一起，
首屏 JS 会带上全部文章内容，几十篇文章就是几 MB。拆开之后，正文只有打开文章详情页才下载。

这一步在 `npm run dev` 和 `npm run build` 开始时都会自动跑。

### 阶段二：预渲染（`vite-ssg`）

普通 Vue SPA 的问题是：服务器返回一个空的 `<div id="app">`，内容全靠 JS 在浏览器里生成。
后果是搜索引擎抓不到内容，而且直接打开深层链接会 404（GitHub Pages 没有回退到 index.html 的机制）。

vite-ssg 的做法是：**在构建时启动一个 Node 环境，把每个路由都真实渲染一遍**，
把渲染结果写进 HTML 文件。

```
dist/index.html                     ← 首页的真实内容
dist/posts/index.html               ← 文章列表的真实内容
dist/posts/2026/frieren/index.html  ← 某篇文章的真实内容（含正文）
dist/about/index.html
...
```

**两个关键点**：

1. **动态路由要显式告诉它**。文章页是 `/posts/:year/:slug`，vite-ssg 不知道有多少篇文章。
   所以 `vite.config.ts` 里读 `content.json`，把所有真实路径塞进 `includedRoutes`。
   同时要把带 `:` 的模板路由**过滤掉**，否则它会试图创建名叫 `:year` 的目录，直接报错。

2. **异步数据要提前取**。`PostDetail.vue` 的正文是异步加载的，如果只在 `onMounted` 里取，
   预渲染出来的就是一个空壳。所以用了 `onServerPrefetch`，让构建阶段就把正文取好。

### 阶段三：后处理（`scripts/postbuild.mjs`）

vite-ssg 输出完之后，再补几样它不管的东西：

| 产物          | 作用                                                     |
| ------------- | -------------------------------------------------------- |
| `rss.xml`     | 订阅源，取最新 20 篇                                     |
| `sitemap.xml` | 给搜索引擎的页面清单（不含 credits / secret / 404）      |
| `robots.txt`  | 抓取规则，指向 sitemap                                   |
| `404.html`    | GitHub Pages 用它接住错误路径                            |
| `pagefind/`   | 搜索索引                                                 |
| `.nojekyll`   | 让 Pages 别做 Jekyll 处理（否则 `_` 开头的目录会被吞掉） |

**404 页有个坑**：vite-ssg 把它渲染成 `dist/404/index.html`，但 GitHub Pages 只认根目录的 `404.html`。
而且如果先写 `404.html` 再建搜索索引，Pagefind 会把 404 页也收进去——
搜出来的结果里出现一个"这一页不见了"，很怪。

所以顺序是：**读进内存 → 删掉 → 建索引 → 写回根目录**。

---

## 运行时结构

浏览器里跑的是一个很小的 Vue 应用：

```mermaid
flowchart TD
    App["App.vue<br/>外壳"]
    Nav["NavDock<br/>导航 + 搜索 + 主题切换"]
    Main["RouterView<br/>按路由切换页面"]
    Footer["SiteFooter"]
    Settings["SettingsPanel<br/>主题/动效/导航显隐"]
    Motion["CursorGlow / CursorDot<br/>桌面指针装饰"]

    App --> Nav
    App --> Main
    App --> Footer
    App --> Settings
    App --> Motion
```

数据来源只有一个：`content.json`（已打包进 JS）。
文章正文通过动态 `import()` 单独加载。

**状态存在哪**：

| 状态                 | 存在哪         | 说明                               |
| -------------------- | -------------- | ---------------------------------- |
| 主题、动效、导航显隐 | `localStorage` | 访客自己调，下次来还在             |
| 已读记录（既読）     | `localStorage` | 只在本地，从不上传                 |
| 当前页面             | URL            | 所有页面都有真实地址，可以直接分享 |

---

## 设计系统

**颜色只在 `src/styles/tokens.css` 里定义**，组件一律用 `var(--xxx)` 引用。
好处是两套主题（Daylight / Neon）只需各定义一遍，切换到 `html[data-theme]` 上改一个属性，
整站配色就变了，组件代码完全不用知道自己在哪套主题里。

**动效有双重开关**：

1. `prefers-reduced-motion` —— 系统级无障碍设置，用户设了就自动降级
2. `[data-motion='off']` —— 站内设置面板的开关

两者都会把所有动画时长归零。

**字体是子集化的**。中文字体完整版动辄 5-10 MB，直接用会让页面卡住好几秒。
`scripts/subset-font.py` 扫描 `content/` 和 `src/` 里实际出现的每一个字，
只保留用到的字形，体积降到 100-300 KB。代价是新增生僻字后要重跑 `npm run fonts`。

---

## 三个"同人志"设定

站点的视觉隐喻是**一本自己印的同人志**。三处功能都建立在这个设定上，
共用 `src/composables/useBook.ts` 里的一套计算：

| 功能         | 在哪                              | 怎么算                           |
| ------------ | --------------------------------- | -------------------------------- |
| **页码**     | 文章页页眉 `第 08 話 · P.14 / 14` | 前置页 6 页 + 文章序号           |
| **目次视图** | 文章列表页右上角切换              | 第 X 話 + 标题 + 引导点线 + 页码 |
| **既読章**   | 卡片左下 / 目次行末 / 文章末尾    | 滚到「本页完」才盖章             |

**"第 X 話"** 是倒序号：最新的一篇是第 N 話，最早的是第 1 話。
**"第 X 話"** 不会因为新增文章而变，所以旧文章的编号是稳定的。

**既読的判断**：不是打开页面就记，而是要滚到文末那个 `[data-post-end]` 元素进入视口。
用 IntersectionObserver 监听，读完了才 `markRead()`。记录存在 `localStorage`，
最多保留 300 条，只在本地，从不上传。

---

## 搜索是怎么工作的

**索引在构建时建**（`pagefind` 命令），产物是 `dist/pagefind/` 下一堆静态文件。
浏览器里只加载一个很小的 WASM 模块和按需的索引分片。

**中文需要显式指定语言**：`addDirectory({ forceLanguage: 'zh-cn' })`。
不指定的话 Pagefind 按英文规则切词（按空格），中文一句话会被当成一个巨大的"单词"，
搜「番剧」永远搜不到。

**索引范围**由 HTML 里的标记控制：

- `data-pagefind-body` 加在 `<main>` 上 —— 只有正文进索引，导航和页脚不进
- `data-pagefind-ignore` 加在侧边目录和上下篇导航上 —— 那些是正文的重复或别页内容

**搜索面板**（`SearchPanel.vue`）是懒加载的：Pagefind 模块只在第一次按 `/` 或 `Ctrl+K` 时才下载。
没搜过的人不会为它付流量。

---

## 密钥防护

```mermaid
flowchart LR
    A["你 git commit"] --> B{".githooks/pre-commit<br/>扫描"}
    B -- 有密钥 --> C["拒绝提交"]
    B -- 干净 --> D["提交成功"]
    D --> E["git push"]
    E --> F{"CI: npm run check:secrets"}
    F -- 有密钥 --> G["部署失败"]
    F -- 干净 --> H["部署成功"]
```

三层：`.gitignore` 挡文件、钩子挡提交、CI 挡部署。
扫描器本身零依赖（纯 Node），扫 20+ 种真实密钥格式和危险文件名。

详见 [EDITING.md 第 12 节](EDITING.md#12-上传前的安全检查)。

---

## SEO

| 项                           | 做法                                   |
| ---------------------------- | -------------------------------------- |
| 每页独立 title / description | `useSeo()` 组合式函数，在 `setup` 里设 |
| 真实 HTML 内容               | vite-ssg 预渲染                        |
| 结构化数据                   | JSON-LD（WebSite + BlogPosting）       |
| 分享卡片                     | 每类页面一张 OG 图（1200×630）         |
| 站点地图                     | 构建时生成 `sitemap.xml`               |
| RSS                          | 构建时生成 `rss.xml`                   |
| 规范链接                     | 每页 `<link rel="canonical">`          |

**预览环境不索引**：`robots.txt` 里 Disallow 了 `/credits` 和 `/secret`。

---

## 为什么不用某些东西

| 没用的东西                | 原因                                      |
| ------------------------- | ----------------------------------------- |
| Tailwind                  | 你以后要手改样式，一堆 class 名反而更难找 |
| 评论系统                  | 用户明确说不要                            |
| 统计                      | 用户明确说不要                            |
| Live2D / 3D               | 任务书红线                                |
| 音乐播放器 / 自动播放音频 | 任务书红线                                |
| Google Fonts              | 国内访问经常超时，字体自托管              |
| 运行时 CSS-in-JS          | 静态站点不需要，多一层开销                |
| 图片 CDN                  | GitHub Pages 自带，没必要                 |

---

## 性能预算

| 项              | 预算        | 现在                          |
| --------------- | ----------- | ----------------------------- |
| 首屏 JS（gzip） | 130 KB      | 见 `npm run build` 输出       |
| 首屏 CSS        | 40 KB       | 单文件，`cssCodeSplit: false` |
| 主视觉图        | 420 KB      | WebP，2400×1400               |
| 文章封面        | 160 KB / 张 | WebP，1200×675                |
| 相册            | 220 KB / 张 | WebP，长边 1600               |
| 字体合计        | 400 KB      | 三套子集                      |

超预算时 `npm run build` 会警告。图片超了 `scripts/optimize-images.py` 会自动降质量重压。

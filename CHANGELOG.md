# 更新记录

格式大致遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
版本号是日期式的：`0.x` 阶段一天可能改好几次。

---

## [0.1.0] — 2026-11-26

首个完整版本。从空目录到可以上线的静态博客。

### 新增

**页面**

- 首页：主视觉 + 打字机标题 + 最新文章 + 卷末四格
- 文章列表：卡片视图 / 目次视图双向切换，按年份分组，分类筛选
- 文章详情：预渲染正文、侧边目录、上一篇/下一篇、封面
- 收藏：番剧/游戏用卡片，书/音乐用列表，分类筛选
- 相册：瀑布流 + 灯箱
- 关于：问答列表 + 时间线（导航里默认隐藏）
- Now：当下在做什么
- 工具箱：按用途分组（默认隐藏）
- 素材来源：从 `CREDITS.md` 自动生成
- 404：飘落星星，点五次有一句隐藏台词
- 彩蛋页：Konami 秘技进入（默认不在导航里）

**内容系统**

- Markdown + frontmatter，构建期渲染成 HTML
- 代码块用 Shiki 高亮，高亮库不进客户端包
- 内容索引拆成 `content.json`（元数据）+ `bodies.json`（正文），按需加载
- `npm run new:post` 交互式建文
- 草稿机制（`draft: true` 不上站）
- 示例内容标记（`sample: true` 渲染成 SAMPLE 胶带标签)

**视觉**

- 双主题：Daylight（日系清新）/ Neon（赛博霓虹）
- 设计令牌集中在 `tokens.css`，组件零硬编码颜色
- 四件装饰母题：TapeLabel / StickerCard / SpeechBubble / WashiDivider
- 印章式站点标记（`SiteMark`），不做人物
- 噪点层营造纸感
- 三套子集化字体自托管

**动效**

- 路由转场：横向滑动 / 漫画分格（可切换）
- 滚动入场、首屏视差、桌面光斑、跟随光标
- 打字机（仅首页 tagline 与 Now 标题）
- 全部受 `prefers-reduced-motion` 与站内开关双重控制

**"同人志"三件套**（v3.0 的核心创新点）

- **页码系统**：`useBook.ts` 计算前置页 + 文章位置，页眉显示「第 08 話 · P.14 / 14」
- **目次视图**：文章列表可切换成同人志目录排版，引导点线把分类与页码推到右端
- **既読章**：滚到文末「本页完」才盖朱色圆章，记录存本地，卡片/目次/文末三处显示

**搜索**

- Pagefind 构建期建索引，`forceLanguage: 'zh-cn'` 启用中日韩分词
- `data-pagefind-body` 限定索引范围，`data-pagefind-ignore` 排除目录与上下篇导航
- 搜索面板：`/` 或 `Ctrl+K` 唤起，懒加载，URL 去重，180ms 防抖

**SEO**

- vite-ssg 预渲染全部 18 个页面（含 8 篇文章的真实正文）
- 每页独立 title / description / canonical
- JSON-LD 结构化数据（WebSite + BlogPosting）
- OG 分享卡片（默认 / 文章 / 收藏三套）
- 构建时生成 RSS、sitemap、robots.txt

**安全**

- `scripts/check-secrets.mjs`：零依赖扫描器，20+ 种密钥格式 + 危险文件名
- `.githooks/pre-commit`：提交前拦截
- `.gitignore` 收紧：`.env` 全系列、私钥、凭据、云 CLI 配置
- `.env.example` 空模板
- CI 独立一步跑密钥扫描，日志顶部可见
- `check:secrets` 接入 `npm run check`

**文档**（全部中文）

- `docs/EDITING.md`：按「我想做什么」组织的修改教程，13 节
- `docs/DEPLOY.md`：浏览器点击级部署教程，含回滚三条命令
- `docs/ARCHITECTURE.md`：Mermaid 流程图 + 技术决策说明
- `docs/HANDOVER.md`：交接说明，红线与踩坑清单
- `docs/ART-SOURCING.md`：素材获取与版权分级
- `README.md`

### 修复

- **文章详情页完全没有预渲染**：正文只在 `onMounted` 里加载，构建产物是空壳。
  改用 `onServerPrefetch`，8 篇文章现在都产出含真实正文的静态 HTML
- **8 篇文章的 URL 完全没被预渲染**：vite-ssg 发现不了 `/posts/:year/:slug`。
  在 `vite.config.ts` 加 `includedRoutes` 从 `content.json` 读真实路径
- **构建崩溃 `mkdir dist/posts/:year`**：`includedRoutes` 里要把带 `:` 的模板路由过滤掉
- **404.html 是 index.html 的复制品**：访问错误地址看到首页，且首页内容被重复收进搜索索引。
  改为渲染真正的 404 页；并且按"读出 → 删掉 → 建索引 → 写回"的顺序处理，避免 404 页进索引
- **中文搜不到**：Pagefind 默认按英文空格切词，中文整段被当成一个单词。
  加 `forceLanguage: 'zh-cn'`
- **搜索结果重复 + 混入导航文字**：加 URL 去重，`data-pagefind-body` 限定到 `<main>`，
  目录与上下篇导航加 `data-pagefind-ignore`
- **`features.search: true` 但没有搜索界面**：补齐完整的 `SearchPanel.vue`
- **目录里 `&quot;` 显示成字面文本**：`buildToc` 没有解码 HTML 实体
- **首页 hero 底部有硬边**：渐变遮罩没能融进背景
- **首页 tagline 在词中间断行**：在标点后插入零宽空格
- **收藏卡没有封面时是一块空白**：改为几何版式封面
- **目次行的印章贴到右边缘**（375px）：缩小尺寸并调整间距
- **`format:check` 因自动生成文件失败**：`src/generated` 加入 `.prettierignore`
- **`tokens.css` 残留废弃变量**：清掉 `--deep-*` 一组
- **滚动入场动画会让内容永久消失**（最严重的一个）：`RevealOnScroll` 原本是
  "CSS 默认 `opacity: 0`，JS 观察器回调后才显示"。只要 IntersectionObserver 不回调
  （后台标签页被节流、部分内嵌 WebView、省电模式暂停渲染），或过渡动画的渲染循环被暂停，
  文章卡片就一直是透明的——内容消失，不是少一次动画。
  改成反向约定：**CSS 默认可见**，只有 JS 确认"元素在视口外且观察器已挂上"才临时加
  `is-armed` 藏起来；兜底计时器摘掉 `is-armed` 时不走过渡，立刻可见。
  `ComicEpilogue` 和 `PostDetail` 的既読检测也按同样思路加了兜底
- **关闭站内动效开关会破坏整页布局**：`ComicEpilogue.vue` 里写成
  `:global([data-motion='off']) .comic`。Vue 的 scoped 编译只保留 `:global()` 里面那段，
  外面的 `.comic` 被丢掉，产物变成裸的 `[data-motion='off'] { height: auto;
position: relative; padding-block: 56px }`——直接命中 `<html>`，整页被改成
  `position: relative` 并加上下 56px 内边距；下面那条四选择器的规则还会塌缩成一条，
  把 `opacity: 1; transform: none` 强加到全站每个元素上。
  改为把整条选择器放进 `:global()`，四格在关闭动效时正常退化成自动高度
- **页脚在建站当年显示「© 2026–2026」**：`site.since` 与当前年份相同时只显示一个年份；
  顺便把年份改成"预渲染用构建年、挂载后用真实年"，避免跨年后停在旧年份
- **文章详情页的既読滚动监听会累积**：切换文章时旧的 `scroll` 监听没被清掉。
  抽出 `clearEndWatchers()`，在 `watchEnd()` 和 `onUnmounted()` 里都调用

### 变更

- `package.json` 的 `check` 脚本前置 `check:secrets`
- `.zcode/`（AI 助手中间文件）加入 `.gitignore`，不进公开仓库
- 文档规模：`docs/reference/` 保留原始需求（`requirements-v3.md`、`brainstorm-115q.md`）

### 已知限制

- 示例内容 26 项（文章 8 / 收藏 10 / 相册 8 / 工具 6 中标记 sample 的部分）均为占位，
  需用户替换
- 插画全部为 C 级（版权归原方，个人非商业展示），需用户后续处理
- 站名、昵称、网址为占位符
- 既読记录只存本地，换设备会丢（设计选择，不是缺陷）
- 生僻字需重跑 `npm run fonts` 才有字形

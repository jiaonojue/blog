# 回声记录

一个自己写的个人博客：**番剧感想 · 技术备忘 · 生活随笔**。

静态站点，Vue 3 + TypeScript 写成，构建时预渲染成纯 HTML，部署在 GitHub Pages 上。
没有评论、没有统计、没有后端、没有任何第三方脚本在跑。

---

## 快速开始

```bash
# 1. 装依赖（只做一次）
npm install

# 2. 本地预览
npm run dev
# → 打开 http://127.0.0.1:5178/blog/

# 3. 构建（一般不用手动跑，GitHub 会自动做）
npm run build
```

**环境要求**：Node 20.19+（推荐 22 LTS）。

---

## 我要改东西

**先看这两份文档，按「我想做什么」找**：

| 我想……               | 看这里                                                |
| -------------------- | ----------------------------------------------------- |
| 改站名、昵称、导航   | [docs/EDITING.md#1](docs/EDITING.md#1-改站名昵称网址) |
| 换主题色             | [docs/EDITING.md#2](docs/EDITING.md#2-换主题色)       |
| 写一篇新文章         | [docs/EDITING.md#4](docs/EDITING.md#4-写一篇新文章)   |
| 加收藏 / 相册 / 工具 | [docs/EDITING.md](docs/EDITING.md) 第 5-7 节          |
| 换图、处理图片       | [docs/EDITING.md#9](docs/EDITING.md#9-换首页大图)     |
| 发布到 GitHub Pages  | [docs/DEPLOY.md](docs/DEPLOY.md)                      |
| 网站坏了想回滚       | [docs/DEPLOY.md#6](docs/DEPLOY.md#6-出错了怎么回滚)   |

---

## 项目结构

```
content/          内容（Markdown）—— 你写的都在这里
public/           图片、图标（原样发布）
src/
  data/           站点配置 ← 站名、昵称、导航都在这
  styles/         设计令牌 ← 颜色、圆角、动效都在这
  pages/          页面
  components/     组件
  generated/      自动生成，不要手改
scripts/          构建脚本、图片处理、密钥扫描
docs/             文档
```

完整的文件地图见 [docs/EDITING.md](docs/EDITING.md) 末尾。

---

## 常用命令

| 命令                    | 作用                                              |
| ----------------------- | ------------------------------------------------- |
| `npm run dev`           | 本地预览，改文件自动刷新                          |
| `npm run build`         | 构建到 `dist/`（含 RSS、sitemap、搜索索引）       |
| `npm run check`         | 全套检查：密钥 → 类型 → lint → 格式 → 构建 → 素材 |
| `npm run format`        | 自动修复格式问题                                  |
| `npm run new:post`      | 交互式新建文章                                    |
| `npm run images`        | 处理 `raw/` 里的原图 → `public/`                  |
| `npm run fonts`         | 重新裁字体子集                                    |
| `npm run check:secrets` | 只跑密钥扫描                                      |

---

## 技术栈

| 项       | 选型                                    | 为什么                                   |
| -------- | --------------------------------------- | ---------------------------------------- |
| 框架     | Vue 3.5 (`<script setup>`) + TypeScript | —                                        |
| 构建     | Vite 8                                  | 快，配置少                               |
| 预渲染   | vite-ssg 28                             | 每页产出真实 HTML，SEO 和直达链接都正常  |
| 路由     | vue-router 4                            | —                                        |
| 内容     | Markdown + gray-matter                  | 写文章不用碰代码                         |
| 代码高亮 | Shiki（构建时）                         | 高亮库不进客户端包                       |
| 搜索     | Pagefind（构建时建索引）                | 纯静态，不需要服务器；中文分词开 `zh-cn` |
| 样式     | 原生 CSS + CSS 变量                     | 不引框架，改起来直白                     |
| 图片     | Python + Pillow 预压                    | 构建时不需要原生依赖                     |

**没有任何运行时第三方脚本**。字体自托管，不请求 Google Fonts。

---

## 内容与素材

- 站上所有文章、收藏、相册目前都是**示例内容**（`sample: true`），渲染时带 SAMPLE 胶带标签。换成你自己的就删掉这个字段。
- 插画的出处逐张登记在 [`public/art/CREDITS.md`](public/art/CREDITS.md)，并自动生成到站点 `/credits` 页。
- 素材均为个人非商业展示。**如果你是权利方**并希望某张图下架，请通过仓库 Issues 联系。

---

## 安全

这个仓库内置密钥防护（`.env`、私钥、各类 API token 全都会被拦下）：

- `.gitignore` 排除所有密钥类文件
- `scripts/check-secrets.mjs` 扫描 20+ 种密钥格式
- `.githooks/pre-commit` 提交前自动拦截（用 `git config core.hooksPath .githooks` 激活）
- CI 里独立一步再查一遍

详见 [docs/EDITING.md#12](docs/EDITING.md#12-上传前的安全检查)。

---

## 许可

- **代码**：随你取用。
- **文字内容**：版权归作者，转载请注明出处。
- **插画**：版权归各原作者，本站仅个人非商业展示，不授予任何转载或商用权利。详见 `/credits` 页。

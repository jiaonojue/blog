# 部署教程

> 从零到上线，全部在浏览器里点。
> 每一步都写清楚"点哪里、看到什么、然后点哪里"。
>
> **你只需要做一次的部分**：第一次开 Pages（第 2 节）。
> **以后每次发布**：只需要第 3 节或第 4 节里的任意一种。

---

## 目录

- [0. 先确认三件事](#0-先确认三件事)
- [1. 把代码推上去](#1-把代码推上去)
- [2. 开启 GitHub Pages（只做一次）](#2-开启-github-pages只做一次)
- [3. 以后怎么改文章（网页版，零命令）](#3-以后怎么改文章网页版零命令)
- [4. 以后怎么改文章（本地版，能预览）](#4-以后怎么改文章本地版能预览)
- [5. 怎么看部署有没有成功](#5-怎么看部署有没有成功)
- [6. 出错了怎么回滚](#6-出错了怎么回滚)
- [7. 常见问题](#7-常见问题)

---

## 0. 先确认三件事

上线之前，这几个值必须跟你自己的仓库对得上。三个地方都改好，再往下走。

### ① 站点配置里的用户名

**文件**：`src/data/site.config.ts`

```ts
url: 'https://YOUR_GITHUB_NAME.github.io',   // ← 把 YOUR_GITHUB_NAME 换成你的 GitHub 用户名
issuesUrl: 'https://github.com/YOUR_GITHUB_NAME/blog/issues',  // ← 同上
handle: 'YOUR_NAME',                          // ← 换成你的昵称
title: '回声记录',                             // ← 换成你想要的站名
```

### ② 子路径前缀

**文件**：`src/data/site.config.ts` 的 `base`，和 `vite.config.ts` 第 8 行的 `BASE`。

**如果你建的仓库名字就叫 `blog`**，那这两处**本来就已经是对的**（都是 `'/blog/'`），不用改。

**如果你换了别的仓库名**（比如 `mysite`），两处都改成 `'/mysite/'`：

```ts
// src/data/site.config.ts
base: '/mysite/',

// vite.config.ts 第 8 行
const BASE = '/mysite/'
```

> ⚠️ **这是第一号杀手**。这两个值必须一字不差，改错任何一个，部署后整站白屏
> （HTML 能打开，但样式和脚本全 404）。

### ③ 仓库名

下面所有步骤都假设你的仓库叫 **`blog`**。换成别的名字，把命令里的 `blog` 一起换掉。

---

## 1. 把代码推上去

### 1.1 检查一下有没有把私密东西带上

**先跑这一步**（在项目文件夹里，右键 → Git Bash Here）：

```bash
npm run check:secrets
```

看到 `[密钥扫描] 通过` 才继续。如果报错了，按提示处理（见 [修改教程第 13 节](EDITING.md#13-上传前的安全检查)）。

### 1.2 打开提交前自动拦截（推荐，只做一次）

```bash
git config core.hooksPath .githooks
```

这样以后每次 `git commit` 都会自动跑密钥扫描，有密钥直接拒绝提交。

### 1.3 第一次提交

```bash
git add .
git commit -m "初始提交"
```

### 1.4 建远程仓库并推上去

**已经有 gh CLI 的话**：

```bash
gh auth login                    # 第一次要，跟着提示走，会开浏览器
gh repo create blog --public --source=. --remote=origin --push
```

**没有 gh CLI**（用网页）：

1. 打开 <https://github.com/new>
2. **Repository name** 填 `blog`
3. 选 **Public**（GitHub Pages 免费版要求仓库公开）
4. **不要**勾选 "Add a README file" / "Add .gitignore" / "Choose a license"（都是空的，勾了会跟本地冲突）
5. 点 **Create repository**
6. 页面会显示一串命令，复制 "…or push an existing repository from the command line" 那一段，在终端里贴进去跑：

```bash
git remote add origin https://github.com/你的用户名/blog.git
git branch -M main
git push -u origin main
```

**推的时候要输密码？** GitHub 早就不接受账号密码了，需要 Personal Access Token：

1. 打开 <https://github.com/settings/tokens> → **Generate new token (classic)**
2. Note 随便写，Expiration 选 90 days，勾选 **repo** 这一整项
3. 点最下面 **Generate token**，复制那串 `ghp_...`
4. 回到终端，密码位置粘贴这串 token（输入时屏幕上不显示，正常）

> **这个 token 就是密钥**。不要写进任何文件、不要提交、不要发给人。
> 它只在那一次 `git push` 的密码框里用一下。

---

## 2. 开启 GitHub Pages（只做一次）

推上去之后，网站还不会自动上线。要手动开一次开关。

### 第 1 步：打开仓库的 Settings

浏览器打开 `https://github.com/你的用户名/blog`，
点页面顶部那一排标签里的 **⚙ Settings**（在最右边）。

### 第 2 步：左边栏点 Pages

在左侧菜单里往下滚，找到 **Pages**（在 "Code and automation" 那一组里）。

### 第 3 步：改 Source

页面中间有一块 **Build and deployment**：

- **Source** 下拉框 → 选 **GitHub Actions**

选完不用点保存，它是即时生效的。

> ⚠️ **不要**选 "Deploy from a branch"。这个项目用 Actions 构建
> （要跑构建、生成搜索索引、压缩图片），选错分支模式会得到一个空站或者只显示 README。

### 第 4 步：等第一次部署

1. 点页面顶部 **Actions** 标签
2. 左边会有一个叫 **部署网站** 的流程
3. 点进去，能看到一步步在跑：检出代码 → 安装 Node → 安装依赖 → 检查密钥 → 构建 → 上传 → 发布
4. 全绿之后，访问：

```
https://你的用户名.github.io/blog/
```

**第一次大概要 2-3 分钟。** 之后每次推送大概 1-2 分钟。

---

## 3. 以后怎么改文章（网页版，零命令）

**适合**：只想改几个字、加一篇文章，不想装任何东西。

### 加一篇新文章

1. 打开 `https://github.com/你的用户名/blog`
2. 进入 `content` → `posts` → `2026`
3. 右上角 **Add file** → **Create new file**
4. 文件名填 `my-new-post.md`（英文短名，`.md` 结尾）
5. 在编辑框里粘贴：

```markdown
---
title: 我的新文章
date: 2026-11-26
category: essay
tags: [随笔]
summary: 一句话说清这篇讲了什么。
---

正文从这里开始。

## 小标题

内容……
```

6. 页面往下滚，**Commit changes** 那一块：
   - 提交说明填 `新增文章：我的新文章`
   - 保持 **Commit directly to the `main` branch**
7. 点 **Commit changes**

**然后等一两分钟**，刷新网站就能看到。点顶部 **Actions** 标签可以看构建进度。

### 改一篇文章

1. 打开那个 `.md` 文件
2. 右上角有个 **铅笔图标** ✏️，点它
3. 改内容
4. 往下滚 → **Commit changes**

### 删一篇文章

1. 打开那个 `.md` 文件
2. 右上角 **⋯**（三个点）→ **Delete file**
3. 往下滚 → **Commit changes**

### 上传一张图片

1. 进入 `public` → `art` → `posts`（文章封面）或 `public` → `gallery`（相册）
2. 右上角 **Add file** → **Upload files**
3. 把图片拖进去
4. 往下滚 → **Commit changes**

> ⚠️ 网页上传**不会**帮你压缩图片。请先在本地把图压好
> （WebP 格式、文章封面 1200×675、单张 200 KB 以内），否则页面会变慢。
> 压图工具：<https://squoosh.app>（浏览器里就能用，免费）。

> ⚠️ 上传后别忘了在 `public/art/CREDITS.md` 里加一行登记来源。

---

## 4. 以后怎么改文章（本地版，能预览）

**适合**：写得比较多，想改完先看效果再上线。

### 写

```bash
npm run dev
```

浏览器打开 <http://127.0.0.1:5178/blog/>。
改任何文件保存，浏览器自动刷新。**写完之前不要关这个终端。**

### 发

另开一个终端窗口（或者写完按 `Ctrl + C` 停掉预览）：

```bash
npm run check     # 先检查一遍，全绿才提交
git add .
git commit -m "新增文章：我的新文章"
git push
```

推上去之后 GitHub 会自动构建部署，等一两分钟刷新网站。

> **`npm run check` 有报错就先别推**。GitHub 上也会跑同样的检查，
> 本地不过的话云端也会失败，白白等两分钟。

---

## 5. 怎么看部署有没有成功

1. 打开 `https://github.com/你的用户名/blog/actions`
2. 最上面那一条就是最近一次部署
3. **绿色勾 ✅** = 成功
4. **红色叉 ❌** = 失败 → 点进去 → 点左边那个红色的步骤 → 看报错

### 常见失败原因

| 报错里出现                  | 意思                                | 怎么办                                                |
| --------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `[密钥扫描]`                | 有密钥被提交了                      | 见 [修改教程第 13 节](EDITING.md#13-上传前的安全检查) |
| `error TS`                  | 类型错误                            | 一般是你手动改了 `.ts` 文件                           |
| `Code style issues`         | 格式不合规范                        | 本地跑 `npm run format` 再推                          |
| `[内容错误]`                | 文章 frontmatter 缺字段或分类写错   | 报错里会写是哪个文件                                  |
| `[资源校验]` 找不到图片     | md 里写的图片路径不对，或者图没上传 | 检查路径和文件名大小写                                |
| `Permission denied` / `403` | Pages 权限没开对                    | 回到第 2 节重新看一遍 Settings → Pages                |

---

## 6. 出错了怎么回滚

改了东西之后发现网站坏了，想退回上一个好版本。**三条命令**：

### 情况 A：本地还没提交，只是改坏了

```bash
git checkout -- .
```

放弃所有未提交的修改，回到上次提交的状态。
（**这会丢掉你刚写的东西**，确定不要了再用。）

### 情况 B：已经提交了，但还没推上去

```bash
git reset --hard HEAD~1
```

退回到上一个提交。（同样会丢掉那一次提交的内容。）

### 情况 C：已经推上去了，线上坏了

```bash
git revert HEAD
```

这会**生成一个新的提交**，内容正好抵消上一个提交的改动。然后：

```bash
git push
```

等 GitHub 自动重新部署，网站就恢复成上一个版本了。

> **为什么用 `revert` 不用 `reset`**：`reset` 只改本地历史，推的时候会被拒绝
> （因为远程已经有了那些提交）。`revert` 是"往前加一步，把之前那步抵消掉"，
> 历史是往前走的，不需要强推，最安全。

### 想回到更早的某个版本

1. 打开 `https://github.com/你的用户名/blog/commits/main`
2. 找到你想回去的那次提交，复制它的提交说明（或者前面那串短哈希，如 `a1b2c3d`）
3. 本地跑：

```bash
git revert <那串哈希>
git push
```

---

## 7. 常见问题

### 网站打开是 404

**按顺序检查**：

1. Settings → Pages 里，Source 是不是 **GitHub Actions**？
2. Actions 里最近一次部署成功了吗？（绿色勾）
3. **地址末尾有没有 `/blog/`**？少了就是 404。
4. 刚改完 Pages 设置的话，等一分钟再试。

### 页面能打开，但白屏 / 没有样式

**九成是 `base` 配错了**。检查：`src/data/site.config.ts` 的 `base`、
`vite.config.ts` 的 `BASE`、以及你实际的仓库名，三者必须完全一致。

用浏览器 F12 打开控制台，如果看到一堆 `404` 加载 `.css` / `.js`，
那就是这个问题。

### 改了内容但网站上没变

1. Actions 里最新那次部署成功了吗？
2. 浏览器缓存：按 `Ctrl + F5` 强制刷新
3. 是不是改完没 `git push`？
4. **等 1-2 分钟**，构建需要时间

### 想换自定义域名

1. 买个域名
2. 在仓库根目录新建文件 `public/CNAME`，内容就一行：`你的域名.com`
3. 域名服务商那边加 CNAME 记录，指向 `你的用户名.github.io`
4. Settings → Pages → Custom domain 填进去，勾选 Enforce HTTPS

换域名之后 `site.config.ts` 的 `url` 要改成新域名，`base` 可以改成 `'/'`。
（`base` 改了记得 `vite.config.ts` 的 `BASE` 也改。）

### 构建太慢 / 失败说内存不足

个人博客不会遇到。真遇到了，说明某篇文章太大（比如塞了几十张大图）。
把图片放到 `public/` 下，用 `<img>` 引用，不要内嵌进 md。

### 仓库能改成私有吗

**不能**（免费账号）。GitHub Pages 免费版要求仓库公开。

想让源码私有又要有网页，只能换部署平台（Cloudflare Pages、Vercel 都支持私有仓库免费部署）。
但那样 `base` 要改成 `'/'`，部署流程也要重写。

---

**相关文档**：

- [修改教程](EDITING.md) —— 改站名、改颜色、写文章、加图片
- [架构说明](ARCHITECTURE.md) —— 构建流程是怎么回事

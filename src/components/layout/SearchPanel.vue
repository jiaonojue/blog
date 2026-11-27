<script setup lang="ts">
/**
 * 站内搜索 —— 按 / 或点放大镜打开。
 *
 * 【它怎么工作】
 *   索引由 Pagefind 在构建时生成（npm run build 的最后一步），
 *   所以搜索完全在访客的浏览器里跑：
 *   没有后端、没有数据库、不向任何服务器发请求，也就不用花钱。
 *
 * 【为什么是懒加载】
 *   Pagefind 的 JS 和 wasm 加起来不小。只有真的按下搜索时才会去下载，
 *   平时逛页面完全不会碰到它——首屏速度不受影响。
 *
 * 【搜索范围】
 *   只搜得到构建时真实存在的页面。草稿（draft: true）不会进索引，
 *   因为它们的 HTML 压根没被生成。
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Search, X } from '@lucide/vue'
import { site } from '@/data/site.config'

const open = ref(false)
const query = ref('')
const results = ref<{ url: string; title: string; excerpt: string }[]>([])
const searching = ref(false)
/** 有没有真的搜过（用来区分"还没输入"和"搜了但没结果"） */
const searched = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

/** Pagefind 搜索返回的条目（只声明我们真的用到的字段） */
interface PagefindResult {
  data: () => Promise<{ url: string; excerpt: string; meta: { title?: string } }>
}

/** Pagefind 模块的最小接口 */
interface PagefindModule {
  init?: () => Promise<void>
  search: (q: string) => Promise<{ results: PagefindResult[] }>
}

/** Pagefind 的模块句柄，第一次搜索时才加载 */
let pagefind: PagefindModule | null = null

let loadError = false

/**
 * 懒加载 Pagefind。
 *
 * 【为什么用 /* @vite-ignore *\/ 和运行时拼路径】
 *   pagefind.js 不是 npm 依赖，是构建产物，躺在 dist/pagefind/ 里。
 *   用 import() 直接写字符串会被 Vite 当成要打包的模块，构建时找不到就报错。
 *   拼成变量再 import，Vite 就不管它了，交给浏览器去下载。
 */
async function ensurePagefind(): Promise<PagefindModule | null> {
  if (pagefind || loadError) return pagefind
  const base = site.base.endsWith('/') ? site.base : `${site.base}/`
  try {
    const mod = (await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`)) as PagefindModule
    await mod.init?.()
    pagefind = mod
    return mod
  } catch {
    // 开发模式下没有构建产物，属于正常情况
    loadError = true
    return null
  }
}

let seq = 0

/** 输入后搜索（带 180ms 防抖，避免每敲一个字都搜一遍） */
let timer: ReturnType<typeof setTimeout> | null = null

function onInput() {
  if (timer) clearTimeout(timer)
  const q = query.value.trim()
  if (!q) {
    results.value = []
    searched.value = false
    searching.value = false
    return
  }
  searching.value = true
  timer = setTimeout(() => void runSearch(q), 180)
}

async function runSearch(q: string) {
  const mySeq = ++seq
  const pf = await ensurePagefind()
  if (!pf) {
    searching.value = false
    searched.value = true
    results.value = []
    return
  }

  try {
    const res = await pf.search(q)
    const top = await Promise.all(res.results.slice(0, 12).map((r) => r.data()))
    // 搜索是异步的，用户可能已经改了输入——只认最后一次
    if (mySeq !== seq) return

    /*
     * 按 URL 去重。
     * Pagefind 会把一个页面切成多个片段，同一篇文章可能命中好几段，
     * 直接列出来就会出现「同一篇出现三次」。保留第一次命中的那条
     * （它通常是最相关的），后面的丢掉。
     */
    const seen = new Set<string>()
    const rows: { url: string; title: string; excerpt: string }[] = []
    for (const d of top) {
      // Pagefind 给的 url 是 /posts/2026/xxx.html，去掉 .html 更接近站内链接习惯
      const url = d.url.replace(/\.html$/, '').replace(/\/index$/, '/')
      if (seen.has(url)) continue
      seen.add(url)
      rows.push({
        url,
        title: d.meta.title?.trim() || '无标题',
        excerpt: d.excerpt,
      })
      if (rows.length >= 8) break
    }

    results.value = rows
    searched.value = true
  } catch {
    results.value = []
    searched.value = true
  } finally {
    if (mySeq === seq) searching.value = false
  }
}

/** 打开搜索面板 */
async function show() {
  open.value = true
  await nextTick()
  inputEl.value?.focus()
}

function hide() {
  open.value = false
  query.value = ''
  results.value = []
  searched.value = false
}

/** 全局快捷键：/ 或 Ctrl/Cmd + K */
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const typing = target && /^(INPUT|TEXTAREA)$/.test(target.tagName)

  if (e.key === 'Escape' && open.value) {
    hide()
    return
  }

  if (typing) return

  if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault()
    void show()
  }
}

/** 打开时锁住页面滚动，关上再放开 */
watch(open, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})

const hasQuery = computed(() => query.value.trim().length > 0)

defineExpose({ show })
</script>

<template>
  <!-- 触发按钮：放在导航里 -->
  <button class="search-trigger" type="button" title="搜索（按 / 键）" @click="show">
    <span class="sr-only">搜索站内文章</span>
    <Search :size="17" :stroke-width="1.75" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <Transition name="finder">
      <div
        v-if="open"
        class="finder-root no-print"
        role="dialog"
        aria-modal="true"
        aria-label="站内搜索"
      >
        <div class="finder-scrim" @click="hide" />

        <div class="finder-box">
          <!-- 输入行 -->
          <div class="finder-field">
            <Search class="finder-icon" :size="18" :stroke-width="1.75" aria-hidden="true" />
            <input
              ref="inputEl"
              v-model="query"
              class="finder-input"
              type="search"
              placeholder="搜文章、番剧、备忘……"
              autocomplete="off"
              spellcheck="false"
              @input="onInput"
            />
            <button class="finder-close" type="button" @click="hide">
              <span class="sr-only">关闭搜索</span>
              <X :size="17" :stroke-width="1.75" aria-hidden="true" />
            </button>
          </div>

          <!-- 结果 -->
          <div class="finder-body">
            <!-- 还没输入：给几个提示，不留空 -->
            <div v-if="!hasQuery" class="finder-hint">
              <p class="hint-lead">直接打字就行。</p>
              <p class="hint-sub">
                <kbd>/</kbd>
                或
                <kbd>Ctrl</kbd>
                +
                <kbd>K</kbd>
                打开，
                <kbd>Esc</kbd>
                关闭。
              </p>
            </div>

            <div v-else-if="searching" class="finder-hint">
              <p class="hint-lead">翻页中……</p>
            </div>

            <div v-else-if="searched && !results.length" class="finder-hint">
              <p class="hint-lead">没找到「{{ query }}」。</p>
              <p class="hint-sub">换个词试试，或者少打两个字。</p>
            </div>

            <ul v-else class="finder-results">
              <li v-for="r in results" :key="r.url">
                <a :href="r.url" class="result-row" @click="hide">
                  <span class="result-title">{{ r.title }}</span>
                  <span class="result-excerpt" v-html="r.excerpt" />
                </a>
              </li>
            </ul>
          </div>

          <footer v-if="hasQuery && results.length" class="finder-foot">
            共 {{ results.length }} 条 · 索引在构建时生成
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── 触发按钮 ───────────────────────────────────────────── */
.search-trigger {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-pill);
  color: var(--ink-soft);
  transition:
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.search-trigger:hover {
  background: var(--bg-soft);
  color: var(--accent);
}

/* ── 面板 ───────────────────────────────────────────────── */
.finder-root {
  position: fixed;
  inset: 0;
  z-index: var(--z-drawer);
  display: grid;
  /* 靠上而不是正中：搜索框应该出现在视线附近，不是屏幕几何中心 */
  align-items: start;
  justify-items: center;
  padding: clamp(56px, 12vh, 120px) 16px 16px;
}

.finder-scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--ink) 42%, transparent);
  backdrop-filter: blur(3px);
}

.finder-box {
  position: relative;
  width: min(620px, 100%);
  max-height: min(70vh, 620px);
  display: flex;
  flex-direction: column;
  border-radius: var(--r-card);
  border: var(--w-stroke) solid var(--ink);
  background: var(--surface);
  box-shadow:
    var(--shadow-lift),
    /* 右下角的纸角投影，和站里其它纸片一致 */ 6px 6px 0 -1px var(--ink);
  overflow: hidden;
}

/* ── 输入行 ─────────────────────────────────────────────── */
.finder-field {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 15px 16px;
  border-bottom: 1px dashed var(--line);
  flex: 0 0 auto;
}

.finder-icon {
  color: var(--ink-soft);
  flex: 0 0 auto;
}

.finder-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font-size: 16px;
  /* 手机上 16px 才不会触发 iOS 自动放大 */
  color: var(--ink);
  outline: none;
}

.finder-input::placeholder {
  color: var(--ink-soft);
  opacity: 0.7;
}

/* 去掉 Safari 的搜索框清除按钮，我们自己有一个 */
.finder-input::-webkit-search-cancel-button {
  appearance: none;
}

.finder-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: var(--r-pill);
  color: var(--ink-soft);
}

.finder-close:hover {
  background: var(--bg-soft);
  color: var(--ink);
}

/* ── 主体 ───────────────────────────────────────────────── */
.finder-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.finder-hint {
  padding: 26px 20px 30px;
}

.hint-lead {
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
}

.hint-sub {
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.85;
  color: var(--ink-soft);
}

kbd {
  display: inline-block;
  min-width: 20px;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  font-family: var(--font-mono);
  font-size: 11px;
  text-align: center;
  color: var(--ink);
}

.finder-results {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.finder-results li + li {
  border-top: 1px dashed var(--line);
}

.result-row {
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  border-radius: var(--r-input);
  transition: background-color var(--t-fast) var(--ease-out);
}

.result-row:hover {
  background: var(--accent-soft);
}

.result-title {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--ink);
}

.result-excerpt {
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--ink-soft);
  /* 摘要里 Pagefind 会插 <mark>，让它跟着主题走 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Pagefind 的命中高亮是内联 <mark>，scoped 样式够不着，用 :deep */
.result-excerpt :deep(mark) {
  padding: 0 1px;
  border-radius: 2px;
  background: var(--accent-soft);
  color: var(--accent);
}

.finder-foot {
  flex: 0 0 auto;
  padding: 9px 16px;
  border-top: 1px dashed var(--line);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
}

/* ── 出现动效 ───────────────────────────────────────────── */
.finder-enter-active,
.finder-leave-active {
  transition: opacity var(--t-fast) var(--ease-out);
}

.finder-enter-active .finder-box,
.finder-leave-active .finder-box {
  transition:
    transform var(--t-base) var(--ease-out),
    opacity var(--t-base) var(--ease-out);
}

.finder-enter-from,
.finder-leave-to {
  opacity: 0;
}

.finder-enter-from .finder-box,
.finder-leave-to .finder-box {
  transform: translateY(-10px) scale(0.985);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .finder-enter-from .finder-box,
  .finder-leave-to .finder-box {
    transform: none;
  }
}

[data-motion='off'] .finder-enter-from .finder-box,
[data-motion='off'] .finder-leave-to .finder-box {
  transform: none;
}
</style>

<script setup lang="ts">
/**
 * 番剧评分表 —— 把 anima.xlsx 搬进网页。
 *
 * 【评分公式】和原表一致，写在 SCORE_WEIGHTS 里：
 *   画面 0.24 · 音效 0.12 · 角色 0.11 · 逻辑 0.13 · 主旨 0.45 · 喜好 0.30 · 情节 0.45
 *   加起来乘 1000 就是最终分（所以满分的上限比 10000 高，因为权重总和是 1.8）。
 *   改权重只改这一个常量，全表重新排序。
 *
 * 【数据从哪来】
 *   底表读 public/data/anime.json —— 那是你一条条手填的评分，封面和年份
 *   已经用 AniList 补好了。这份文件是"已发布的"，所有人的浏览器看到的都一样。
 *
 * 【加一部新番】
 *   不用换整张表。在下面填名字、选状态、填七项分数就行：
 *     1. 立刻按公式算出总分，按分数插到正确名次（其余行用 FLIP 动画让位）
 *     2. 同时去 AniList 查封面和年份，查到就自动补上
 *     3. 新条目存在你的浏览器里（localStorage），刷新不丢
 *   想让所有人都看到，点「导出 anime.json」，用它覆盖 public/data/anime.json
 *   再提交一次即可 —— 这一步是可选的，不做也一直有效，只是只对你这台电脑有效。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { withBase } from '@/composables/useContent'
import { FileDown, Search, ArrowUpDown, ImageOff, Plus, RotateCw, Trash2, X } from '@lucide/vue'

interface AnimeRow {
  name: string
  status: string
  art: number
  sound: number
  char: number
  logic: number
  plot: number
  theme: number
  taste: number
  score: number
  year?: number | null
  cover?: string | null
  /** 本地新增（存在 localStorage，不在 anime.json 里） */
  local?: boolean
}

/** 七项权重。改这里就等于改评分标准 */
const W = {
  art: 0.24,
  sound: 0.12,
  char: 0.11,
  logic: 0.13,
  theme: 0.45,
  taste: 0.3,
  plot: 0.45,
} as const

const DIMENSIONS = [
  { key: 'art', label: '画面' },
  { key: 'sound', label: '音效' },
  { key: 'char', label: '角色' },
  { key: 'logic', label: '逻辑' },
  { key: 'plot', label: '情节' },
  { key: 'theme', label: '主旨' },
  { key: 'taste', label: '喜好' },
] as const

type DimKey = (typeof DIMENSIONS)[number]['key']

/** 按权重算总分。原始数据里 score 是 Excel 算好的，新增条目用这个算 */
function computeScore(r: Record<DimKey, number>): number {
  return (
    (r.art * W.art +
      r.sound * W.sound +
      r.char * W.char +
      r.logic * W.logic +
      r.theme * W.theme +
      r.taste * W.taste +
      r.plot * W.plot) *
    1000
  )
}

/* ── 数据 ─────────────────────────────────────────────── */

/** 底表：public/data/anime.json */
const base = ref<AnimeRow[]>([])
/** 本地新增的条目，存在 localStorage */
const extra = ref<AnimeRow[]>([])

const loading = ref(true)
const error = ref('')

/** 合并后的全表 */
const rows = computed(() => [...base.value, ...extra.value])

const STORAGE_KEY = 'anime:extra:v1'

/** 读出本地新增。SSR 阶段没有 localStorage，直接返回空 */
function loadExtra(): AnimeRow[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list
      .filter((r) => r && typeof r.name === 'string' && r.name.trim())
      .map((r) => ({ ...r, local: true }))
  } catch {
    return []
  }
}

function saveExtra(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(extra.value))
  } catch {
    error.value = '浏览器不让写本地存储（可能是隐私模式），新增的条目刷新后会丢。'
  }
}

/**
 * 中文名 → 日文/罗马字名的对照表。
 *
 * 【为什么需要】
 *   AniList 的搜索对简体中文很不友好：搜「葬送的芙莉莲」返回空，
 *   搜「Sousou no Frieren」立刻命中。而且它搜到之后返回的封面是远程 URL，
 *   我们想存成本地文件，所以这个表只用来"翻译名字"。
 *
 * 表在 public/data/anime-aliases.json，可以随时往里加。
 * 新增一部番时：如果它在表里，一次就查准；不在就退回原名去搜。
 */
const aliases = ref<Record<string, string>>({})

onMounted(async () => {
  // 本地新增放到 mounted 再读：预渲染出来的 HTML 是 173 行，
  // 如果在 setup 阶段就多出几行，Vue 水合时会对不上。
  extra.value = loadExtra()

  // 别名表读不到不影响主流程，静默忽略
  void fetch(withBase('/data/anime-aliases.json'))
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => {
      if (j && typeof j === 'object') aliases.value = j as Record<string, string>
    })
    .catch(() => {})

  try {
    const res = await fetch(withBase('/data/anime.json'))
    if (!res.ok) throw new Error(String(res.status))
    base.value = (await res.json()) as AnimeRow[]
  } catch {
    error.value = '读不到内置评分表 public/data/anime.json。'
  } finally {
    loading.value = false
  }
})

/* ── 查询：封面 + 年份 ────────────────────────────────── */

const ANILIST = 'https://graphql.anilist.co'

const MEDIA_QUERY = `query ($search: String) {
  Page(perPage: 3) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      seasonYear
      coverImage { large }
    }
  }
}`

/** 去掉季数、括号、结尾标点，得到"更可能被搜到"的名字 */
function cleanTitle(name: string): string {
  return name
    .replace(/[（(].*?[)）]/g, '')
    .replace(/(第[一二三四五六七八九十\d]+[季期部章]|剧场版|OVA|OAD)$/i, '')
    .replace(/[!！?？~～、，,。.：:\s]+$/, '')
    .trim()
}

/**
 * 拿名字去 AniList 查封面和年份。
 *
 * 【查询顺序】
 *   1. 底表里已有同名条目 → 直接继承，一个请求都不发
 *   2. 别名表里有 → 用罗马字名查（命中率最高）
 *   3. 原名直接查（有些番 AniList 收录了中文名）
 *   4. 去掉季数、括号再查一次
 *
 * 【关于封面地址】
 *   AniList 返回的是它自己 CDN 上的图。但我们早就把常用番的封面
 *   下载到 public/art/anime/<AniList ID>.webp 了，本地那份更快、
 *   也不依赖外网。所以查到 ID 之后先探一下本地有没有，有就用本地，
 *   没有才退回远程地址（网页工具没法把文件写进你的项目目录，
 *   想永久存本地就把图放进 public/art/anime/ 再改 anime.json）。
 *
 * 【为什么查不到也不报错】
 *   封面是锦上添花。查不到就显示占位图标，分数和名次照常。
 *   行内有一个「重查」按钮，随时可以再试。
 */
async function lookup(name: string): Promise<{ year: number | null; cover: string | null }> {
  const known = base.value.find((r) => r.name === name)
  if (known?.cover) return { year: known.year ?? null, cover: known.cover }

  const ask = async (keyword: string) => {
    const res = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: MEDIA_QUERY, variables: { search: keyword } }),
    })
    // 429 是 AniList 的限流，当作"这次没查到"，不要抛给用户
    if (!res.ok) return null
    const json = await res.json()
    const list = json?.data?.Page?.media
    return Array.isArray(list) && list.length ? list[0] : null
  }

  const candidates = [aliases.value[name], name, cleanTitle(name)].filter(
    (s, i, arr): s is string => Boolean(s) && arr.indexOf(s) === i,
  )

  for (const keyword of candidates) {
    const hit = await ask(keyword)
    if (hit) {
      const local = typeof hit.id === 'number' ? await probeLocal(hit.id) : null
      return {
        year: hit.seasonYear ?? null,
        cover: local ?? hit.coverImage?.large ?? null,
      }
    }
    // 连着打会被限流，间隔一下
    await new Promise((r) => setTimeout(r, 700))
  }

  return { year: null, cover: null }
}

/**
 * 探一下本地有没有这张封面。
 *
 * 浏览器没法列目录，所以只能用 Image 试加载：
 * 能解码就用本地路径，失败就返回 null 让调用方退回远程地址。
 * 这一步只发生在"新增一部番"的时候，不影响表格首屏。
 *
 * 返回的是不带 base 的路径（和 anime.json 里 cover 字段同一种写法），
 * 交给模板里的 withBase 统一处理 —— 这里自己拼 base 会拼两次。
 */
function probeLocal(id: number): Promise<string | null> {
  const path = `/art/anime/${id}.webp`
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(path)
    img.onerror = () => resolve(null)
    img.src = withBase(path)
  })
}

/* ── 新增表单 ─────────────────────────────────────────── */

const adding = ref(false)
const busy = ref(false)
const formError = ref('')

const form = reactive({
  name: '',
  status: '动漫',
  art: 8,
  sound: 8,
  char: 8,
  logic: 8,
  plot: 8,
  theme: 8,
  taste: 8,
})

/** 表单里的实时总分，让填分的时候就知道会排到哪 */
const previewScore = computed(() =>
  computeScore({
    art: form.art,
    sound: form.sound,
    char: form.char,
    logic: form.logic,
    plot: form.plot,
    theme: form.theme,
    taste: form.taste,
  }),
)

/** 这个总分大概会落在第几名（只是提示，真正名次由全表算） */
const previewRank = computed(() => {
  const s = previewScore.value
  return rows.value.filter((r) => r.score > s).length + 1
})

/** 正在查封面的条目名，用来在行里显示转圈 */
const lookingUp = ref<Set<string>>(new Set())
/** 刚添加的条目名，用来闪一下高亮 */
const justAdded = ref('')
/** 图片加载失败的条目：本地文件可能被删了，退回占位图标 */
const brokenCovers = reactive(new Set<string>())

function openForm(): void {
  adding.value = true
  formError.value = ''
}

function closeForm(): void {
  adding.value = false
  formError.value = ''
}

function clampScore(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10))
}

async function submit(): Promise<void> {
  const name = form.name.trim()
  if (!name) {
    formError.value = '番名不能空着。'
    return
  }
  if (rows.value.some((r) => r.name === name)) {
    formError.value = `「${name}」已经在表里了，换一个名字或者直接改它。`
    return
  }

  formError.value = ''
  busy.value = true

  const scores = {
    art: clampScore(form.art),
    sound: clampScore(form.sound),
    char: clampScore(form.char),
    logic: clampScore(form.logic),
    plot: clampScore(form.plot),
    theme: clampScore(form.theme),
    taste: clampScore(form.taste),
  }

  const row: AnimeRow = {
    name,
    status: form.status.trim(),
    ...scores,
    score: computeScore(scores),
    year: null,
    cover: null,
    local: true,
  }

  // 先插进去：分数立刻生效，名次立刻排好，动效也立刻播。
  // 封面是后补的，不让网络请求挡住"看到它进了榜"这件事。
  extra.value = [...extra.value, row]
  saveExtra()
  justAdded.value = name
  window.setTimeout(() => {
    if (justAdded.value === name) justAdded.value = ''
  }, 1600)

  // 重置表单，保持"连续录入"的手感
  form.name = ''
  form.status = '动漫'
  for (const d of DIMENSIONS) form[d.key] = 8
  busy.value = false

  // 后台补封面和年份
  lookingUp.value = new Set(lookingUp.value).add(name)
  try {
    const info = await lookup(name)
    patchRow(name, info)
  } catch {
    // 网络不通就留着占位图，行里的「重查」随时能再试
  } finally {
    const next = new Set(lookingUp.value)
    next.delete(name)
    lookingUp.value = next
  }
}

function patchRow(name: string, patch: Partial<AnimeRow>): void {
  extra.value = extra.value.map((r) => (r.name === name ? { ...r, ...patch } : r))
  saveExtra()
}

async function retryCover(name: string): Promise<void> {
  if (lookingUp.value.has(name)) return
  lookingUp.value = new Set(lookingUp.value).add(name)
  try {
    patchRow(name, await lookup(name))
  } catch {
    /* 忽略，用户可以再点一次 */
  } finally {
    const next = new Set(lookingUp.value)
    next.delete(name)
    lookingUp.value = next
  }
}

function removeRow(name: string): void {
  extra.value = extra.value.filter((r) => r.name !== name)
  saveExtra()
}

/** 把合并后的全表导出成 anime.json，覆盖 public/data/anime.json 就永久生效 */
function exportJson(): void {
  const clean = rows.value.map((r) => ({
    name: r.name,
    status: r.status,
    art: r.art,
    sound: r.sound,
    char: r.char,
    logic: r.logic,
    plot: r.plot,
    theme: r.theme,
    taste: r.taste,
    score: r.score,
    year: r.year ?? null,
    cover: r.cover ?? null,
  }))
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'anime.json'
  a.click()
  URL.revokeObjectURL(url)
}

/* ── 筛选 / 排序 ───────────────────────────────────────── */

const keyword = ref('')
/** 排序方式：score 按分数，year 按年份，name 按名称 */
const sortBy = ref<'score' | 'year' | 'name'>('score')
const statusFilter = ref('')

const statuses = computed(() => {
  const set = new Set<string>()
  for (const r of rows.value) if (r.status) set.add(r.status)
  return [...set].sort()
})

/** 按分数排名：不管怎么筛选，名次都按全表算，这样"第几名"是稳定的 */
const rankOf = computed(() => {
  const sorted = [...rows.value].sort((a, b) => b.score - a.score)
  const map = new Map<string, number>()
  sorted.forEach((r, i) => map.set(r.name, i + 1))
  return map
})

const view = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let list = rows.value.filter((r) => {
    if (statusFilter.value && r.status !== statusFilter.value) return false
    if (kw && !r.name.toLowerCase().includes(kw)) return false
    return true
  })

  list = [...list]
  if (sortBy.value === 'score') list.sort((a, b) => b.score - a.score)
  else if (sortBy.value === 'year') list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  else list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))

  return list
})

const topScore = computed(() => Math.max(1, ...rows.value.map((r) => r.score)))

function fmtScore(n: number): string {
  return n.toFixed(0)
}

/** 把分数画成小横条，一眼看出强弱 */
function barWidth(v: number): string {
  return `${Math.min(100, (v / topScore.value) * 100)}%`
}
</script>

<template>
  <section class="anime-tool">
    <!-- ── 工具栏 ─────────────────────────────────────── -->
    <div class="anime-bar">
      <label class="anime-search">
        <Search :size="14" :stroke-width="2" aria-hidden="true" />
        <input v-model="keyword" type="search" placeholder="搜番名…" aria-label="搜索番剧" />
      </label>

      <label class="anime-sort">
        <ArrowUpDown :size="13" :stroke-width="2" aria-hidden="true" />
        <select v-model="sortBy" aria-label="排序方式">
          <option value="score">按分数</option>
          <option value="year">按年份</option>
          <option value="name">按名称</option>
        </select>
      </label>

      <label class="anime-sort">
        <select v-model="statusFilter" aria-label="按状态筛选">
          <option value="">全部状态</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>

      <span class="anime-count">{{ view.length }} / {{ rows.length }} 部</span>
    </div>

    <!-- ── 加一部 ─────────────────────────────────────── -->
    <div class="add-wrap">
      <button v-if="!adding" type="button" class="add-open" @click="openForm">
        <Plus :size="15" :stroke-width="2.2" aria-hidden="true" />
        加一部
      </button>

      <form v-else class="add-form" @submit.prevent="submit">
        <div class="add-head">
          <span class="add-title">
            <Plus :size="14" :stroke-width="2.2" aria-hidden="true" />
            加一部
          </span>
          <button type="button" class="add-close" aria-label="收起" @click="closeForm">
            <X :size="14" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>

        <div class="add-row">
          <label class="add-field grow">
            <span class="add-label">番名</span>
            <input
              v-model="form.name"
              type="text"
              placeholder="照你记得的写就行"
              autocomplete="off"
            />
          </label>

          <label class="add-field">
            <span class="add-label">状态</span>
            <input v-model="form.status" type="text" list="anime-statuses" placeholder="动漫" />
            <datalist id="anime-statuses">
              <option v-for="s in statuses" :key="s" :value="s" />
            </datalist>
          </label>
        </div>

        <div class="add-scores">
          <label v-for="d in DIMENSIONS" :key="d.key" class="add-score">
            <span class="add-label">{{ d.label }}</span>
            <input
              v-model.number="form[d.key]"
              type="number"
              min="0"
              max="10"
              step="0.1"
              inputmode="decimal"
            />
          </label>
        </div>

        <div class="add-foot">
          <span class="add-preview">
            总分
            <strong>{{ fmtScore(previewScore) }}</strong>
            <span class="add-rank">约第 {{ previewRank }} 名</span>
          </span>

          <p v-if="formError" class="add-error">{{ formError }}</p>

          <button type="submit" class="add-submit" :disabled="busy">
            {{ busy ? '正在加入…' : '加入榜单' }}
          </button>
        </div>

        <p class="add-hint">
          分数填完就自动排好名次。封面和年份会在后台去 AniList 查，查不到不影响排序。
        </p>
      </form>
    </div>

    <p v-if="error" class="anime-error">{{ error }}</p>

    <!-- ── 表格 ───────────────────────────────────────── -->
    <div v-if="loading" class="anime-loading">正在读评分表…</div>

    <TransitionGroup v-else-if="view.length" tag="ol" name="row" class="anime-list">
      <li
        v-for="(row, i) in view"
        :key="row.name"
        class="anime-row"
        :class="{ 'is-new': justAdded === row.name }"
      >
        <!-- 名次 -->
        <span class="anime-rank" :class="{ top: (rankOf.get(row.name) ?? 99) <= 3 }">
          {{ rankOf.get(row.name) ?? i + 1 }}
        </span>

        <!-- 封面 -->
        <span class="anime-cover" :class="{ 'is-loading': lookingUp.has(row.name) }">
          <img
            v-if="row.cover && !brokenCovers.has(row.name)"
            :src="withBase(row.cover)"
            :alt="`${row.name} 封面`"
            :loading="row.local ? 'eager' : 'lazy'"
            decoding="async"
            referrerpolicy="no-referrer"
            @error="brokenCovers.add(row.name)"
          />
          <span v-else class="anime-cover-empty" aria-hidden="true">
            <ImageOff :size="16" :stroke-width="1.6" />
          </span>
        </span>

        <!-- 标题 + 状态 -->
        <span class="anime-main">
          <span class="anime-name">
            {{ row.name }}
            <span v-if="row.local" class="anime-local">本地</span>
          </span>
          <span class="anime-meta">
            <span v-if="row.year" class="anime-year">{{ row.year }}</span>
            <span v-if="row.status" class="anime-status">{{ row.status }}</span>
          </span>
        </span>

        <!-- 分数 -->
        <span class="anime-score">
          <span class="anime-score-num">{{ fmtScore(row.score) }}</span>
          <span class="anime-score-track" aria-hidden="true">
            <span class="anime-score-fill" :style="{ width: barWidth(row.score) }" />
          </span>
        </span>

        <!-- 七项明细：桌面端展开成一小排 -->
        <span class="anime-dims">
          <span
            v-for="d in DIMENSIONS"
            :key="d.key"
            class="anime-dim"
            :title="`${d.label} ${row[d.key]}`"
          >
            <span class="dim-label">{{ d.label }}</span>
            <span class="dim-val">{{ row[d.key] }}</span>
          </span>
        </span>

        <!-- 本地条目的两个小动作：重查封面 / 删掉 -->
        <span v-if="row.local" class="anime-actions">
          <button
            v-if="!row.cover"
            type="button"
            class="row-act"
            :disabled="lookingUp.has(row.name)"
            title="重查封面"
            :aria-label="`重查 ${row.name} 的封面`"
            @click="retryCover(row.name)"
          >
            <RotateCw :size="12" :stroke-width="2" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="row-act danger"
            title="删除这条"
            :aria-label="`删除 ${row.name}`"
            @click="removeRow(row.name)"
          >
            <Trash2 :size="12" :stroke-width="2" aria-hidden="true" />
          </button>
        </span>
      </li>
    </TransitionGroup>

    <p v-else class="anime-empty">没有符合条件的番。</p>

    <!-- ── 导出 ───────────────────────────────────────── -->
    <div v-if="extra.length" class="anime-export">
      <p class="export-note">
        新增的 {{ extra.length }} 条存在这台电脑的浏览器里。想让所有人看到，导出后覆盖
        <code>public/data/anime.json</code>
        ，再提交一次。
      </p>
      <button type="button" class="export-btn" @click="exportJson">
        <FileDown :size="14" :stroke-width="2" aria-hidden="true" />
        导出 anime.json
      </button>
    </div>
  </section>
</template>

<style scoped>
.anime-tool {
  display: grid;
  gap: 18px;
}

/* ── 工具栏 ─────────────────────────────────────────────── */
.anime-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.anime-search {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
}

.anime-search input {
  width: 150px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  outline: none;
}

.anime-search:focus-within {
  border-color: var(--accent);
}

.anime-sort {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
}

.anime-sort select {
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 12.5px;
  outline: none;
  cursor: pointer;
}

.anime-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.anime-error {
  padding: 10px 14px;
  border-radius: var(--r-input);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
}

.anime-loading,
.anime-empty {
  padding: 40px 0;
  text-align: center;
  font-size: 13.5px;
  color: var(--ink-soft);
}

/* ── 新增表单 ───────────────────────────────────────────── */
.add-open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--r-pill);
  border: 1px dashed var(--line);
  background: transparent;
  color: var(--ink-soft);
  font-size: 12.5px;
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.add-open:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.add-form {
  display: grid;
  gap: 14px;
  padding: 16px 18px;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.add-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--accent);
  text-transform: uppercase;
}

.add-close {
  margin-left: auto;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--ink-soft);
  transition: color var(--t-fast) var(--ease-out);
}

.add-close:hover {
  color: var(--accent);
}

.add-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.add-field {
  display: grid;
  gap: 5px;
  width: 120px;
}

.add-field.grow {
  flex: 1 1 220px;
  width: auto;
}

.add-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
}

.add-field input,
.add-score input {
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
  outline: none;
  transition: border-color var(--t-fast) var(--ease-out);
}

.add-field input:focus,
.add-score input:focus {
  border-color: var(--accent);
}

.add-scores {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.add-score {
  display: grid;
  gap: 5px;
}

.add-score input {
  padding: 6px 6px;
  text-align: center;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 639px) {
  .add-scores {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.add-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.add-preview {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.add-preview strong {
  font-size: 15px;
  color: var(--accent);
  font-weight: 600;
}

.add-rank {
  margin-left: 8px;
  opacity: 0.75;
}

.add-error {
  font-size: 12.5px;
  color: var(--accent);
}

.add-submit {
  margin-left: auto;
  padding: 8px 20px;
  border-radius: var(--r-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 13px;
  font-weight: 500;
  transition: opacity var(--t-fast) var(--ease-out);
}

.add-submit:hover {
  opacity: 0.88;
}

.add-submit:disabled {
  opacity: 0.5;
  cursor: default;
}

.add-hint {
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--ink-soft);
  opacity: 0.8;
}

/* ── 列表 ───────────────────────────────────────────────── */
.anime-list {
  position: relative;
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.anime-row {
  display: grid;
  grid-template-columns: 30px 44px minmax(0, 1fr) 92px;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--r-input);
  transition: background-color var(--t-fast) var(--ease-out);
}

.anime-row:hover {
  background: var(--bg-soft);
}

/*
 * 新条目：底色闪一下自己退掉。
 *
 * 【为什么用 animation 而不是 transition】
 *   这条是刚创建的元素，没有"上一个颜色"可以过渡。
 *   如果用 transition，类名移除的那一刻过渡属性也一起没了，颜色会直接跳回去。
 *   animation 只播一次、播完自己停在透明，类名什么时候摘都不影响观感。
 */
.anime-row.is-new {
  animation: row-flash 1500ms var(--ease-out) forwards;
}

@keyframes row-flash {
  0% {
    background-color: var(--accent-soft);
  }
  100% {
    background-color: transparent;
  }
}

/* ── 重排动效（FLIP）─────────────────────────────────────
 * Vue 的 TransitionGroup 在元素位置变化时会自动算出前后位移，
 * 我们只要给 move 类一个过渡即可。新条目入场从上方落下，
 * 其余行同时往上/往下让位 —— 这就是"插进榜里"的观感。
 */
.row-move {
  transition: transform var(--t-slow) var(--ease-out);
}

.row-enter-active {
  transition:
    opacity var(--t-slow) var(--ease-out),
    transform var(--t-slow) var(--ease-out);
}

.row-enter-from {
  opacity: 0;
  transform: translateY(-14px) scale(0.97);
}

/* 离场：脱离文档流，别让下面的行先跳一下再动 */
.row-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  transition: opacity var(--t-fast) var(--ease-out);
}

.row-leave-to {
  opacity: 0;
}

/* 名次 */
.anime-rank {
  font-family: var(--font-mono);
  font-size: 12px;
  text-align: right;
  color: var(--ink-soft);
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

.anime-rank.top {
  color: var(--accent);
  opacity: 1;
  font-weight: 600;
}

/* 封面 */
.anime-cover {
  width: 44px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-soft);
  display: grid;
  place-items: center;
}

/* 正在查封面：轻轻呼吸，让人知道"还没完" */
.anime-cover.is-loading {
  animation: cover-breathe 1.2s var(--ease-in-out) infinite;
}

@keyframes cover-breathe {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.anime-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.anime-cover-empty {
  color: var(--ink-soft);
  opacity: 0.35;
}

/* 标题 */
.anime-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.anime-name {
  font-size: 14px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 「本地」小标：提醒这条只存在你的浏览器里 */
.anime-local {
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  vertical-align: 1px;
}

.anime-meta {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

.anime-status {
  opacity: 0.85;
}

/* 分数 */
.anime-score {
  display: grid;
  gap: 4px;
  justify-items: end;
}

.anime-score-num {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.anime-score-track {
  width: 72px;
  height: 3px;
  border-radius: 2px;
  background: var(--line);
  overflow: hidden;
}

.anime-score-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  opacity: 0.75;
  border-radius: 2px;
}

/* 七项明细：宽屏才显示 */
.anime-dims {
  display: none;
  grid-column: 3 / 5;
  gap: 14px;
  padding-top: 2px;
}

@media (min-width: 900px) {
  .anime-row {
    grid-template-columns: 30px 44px minmax(0, 1fr) 92px auto;
  }

  .anime-dims {
    display: flex;
    grid-column: auto;
  }
}

/*
 * 窄屏：一行的四列挤不下（名次 30 + 封面 44 + 分数 92 + 间距 36），
 * 375px 上留给番名的只剩不到 100px，名字全被截成「中二病也…」。
 * 这里收窄名次和封面、去掉进度条只留数字，并把名字放宽到两行。
 */
@media (max-width: 639px) {
  .anime-row {
    grid-template-columns: 22px 38px minmax(0, 1fr) auto;
    gap: 9px;
    padding: 8px 6px;
  }

  .anime-cover {
    width: 38px;
    height: 52px;
  }

  .anime-rank {
    font-size: 11px;
  }

  .anime-name {
    font-size: 13.5px;
    /* 两行封顶，超出还是省略号 */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
  }

  /* 进度条在这个宽度下只剩装饰作用，去掉给名字让位 */
  .anime-score-track {
    display: none;
  }

  .anime-score-num {
    font-size: 12.5px;
  }
}

.anime-dim {
  display: grid;
  gap: 1px;
  justify-items: center;
}

.dim-label {
  font-size: 9.5px;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
  opacity: 0.72;
  white-space: nowrap;
}

.dim-val {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink);
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}

/* 本地条目的小按钮 */
.anime-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--t-fast) var(--ease-out);
}

.anime-row:hover .anime-actions,
.anime-row:focus-within .anime-actions {
  opacity: 1;
}

@media (hover: none) {
  /* 触屏没有 hover，直接常显 */
  .anime-actions {
    opacity: 1;
  }
}

.row-act {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.row-act:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.row-act.danger:hover {
  border-color: var(--stamp-ink);
  color: var(--stamp-ink);
}

.row-act:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── 导出 ───────────────────────────────────────────────── */
.anime-export {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--r-input);
  border: 1px dashed var(--line);
}

.export-note {
  flex: 1 1 320px;
  font-size: 11.5px;
  line-height: 1.75;
  color: var(--ink-soft);
}

.export-note code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-soft);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.export-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 12px;
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.export-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 减少动效：让位和入场都不动，直接换位置 */
@media (prefers-reduced-motion: reduce) {
  .row-move,
  .row-enter-active {
    transition: none;
  }

  .row-enter-from {
    transform: none;
  }

  .anime-cover.is-loading,
  .anime-row.is-new {
    animation: none;
  }
}

[data-motion='off'] .row-move,
[data-motion='off'] .row-enter-active {
  transition: none;
}

[data-motion='off'] .row-enter-from {
  transform: none;
}

[data-motion='off'] .anime-cover.is-loading,
[data-motion='off'] .anime-row.is-new {
  animation: none;
}
</style>

/**
 * 番剧清单 —— 首页摸鱼分区里的「今天看什么」和「猜番」共用。
 *
 * 【数据从哪来】
 *   public/data/anime.json，174 条手填的评分。
 *   它不走构建期导入，而是运行时 fetch：这份数据只有摸鱼分区用，
 *   打进主包里会让首屏白白多下载几十 KB。
 *
 * 【为什么用模块级 Promise 缓存】
 *   两个组件可能同时挂载、同时请求。如果各自 fetch 一次，
 *   就会下载两遍。把 Promise 存在模块作用域里，
 *   第二个调用者直接拿到同一个 Promise，等于免费去重。
 *   失败时把缓存清掉，这样下次滚动回来还能重试，而不是永久坏掉。
 */
import { site } from '@/data/site.config'

export interface AnimeEntry {
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
  year: number
  cover: string
  anilistId?: number
}

/** 七个维度的名字与顺序，两个组件共用，避免各写一遍对不上 */
export const DIMENSIONS = [
  { key: 'art', label: '作画' },
  { key: 'sound', label: '音乐' },
  { key: 'char', label: '角色' },
  { key: 'logic', label: '逻辑' },
  { key: 'plot', label: '剧情' },
  { key: 'theme', label: '立意' },
  { key: 'taste', label: '私心' },
] as const

export type DimensionKey = (typeof DIMENSIONS)[number]['key']

/**
 * 站点部署在子路径下（site.base = '/blog/'），图片路径必须带上 base。
 * 直接读 site.config，不 import useContent —— 那会把整份文章索引也拖进来。
 */
function withBase(path: string): string {
  const base = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** 封面完整 URL */
export function coverUrl(entry: AnimeEntry): string {
  return withBase(entry.cover)
}

let cache: Promise<AnimeEntry[]> | null = null

/**
 * 取番剧清单。
 * 只保留有名字、有封面的条目——缺封面的条目在抽签卡片上会开一个空洞。
 */
export function loadAnimeList(): Promise<AnimeEntry[]> {
  if (cache) return cache

  cache = fetch(withBase('/data/anime.json'))
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<AnimeEntry[]>
    })
    .then((list) =>
      list.filter((x) => x && typeof x.name === 'string' && x.name && typeof x.cover === 'string'),
    )
    .catch((err: unknown) => {
      // 失败就把缓存清掉：下次滚回来还能重试
      cache = null
      throw err
    })

  return cache
}

/** 从数组里随机取一个 */
export function pickRandom<T>(list: T[]): T | undefined {
  if (!list.length) return undefined
  return list[Math.floor(Math.random() * list.length)]
}

/** 一条提示：一句话 + 这部番的别名/简称 */
export interface HintEntry {
  hint: string
  aliases: string[]
}

/** 番名 → 提示 */
export type HintMap = Record<string, HintEntry>

let hintCache: Promise<HintMap> | null = null

/**
 * 取一句话提示和别名。
 *
 * 【为什么单独一个文件、单独一次请求】
 *   174 条提示只有猜番用得上，抽签和十佳不需要。
 *   混进 anime.json 会让那两块也跟着多下载十几 KB。
 *   两个文件都是静态 JSON，浏览器和 CDN 都会缓存，第二次进来是零成本。
 *
 * 【取不到怎么办】
 *   猜番不能因为少了一句提示就整个坏掉。
 *   调用方拿到空对象时退回"只给模糊封面"的出题方式，
 *   所以这里失败也只是 reject，由组件决定怎么兜。
 */
export function loadHints(): Promise<HintMap> {
  if (hintCache) return hintCache

  hintCache = fetch(withBase('/data/anime-hints.json'))
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<HintMap>
    })
    .catch((err: unknown) => {
      hintCache = null
      throw err
    })

  return hintCache
}

/**
 * 把一个番名洗成方便比对的形状。
 *
 * 【为什么不能直接 === 比较】
 *   用户手打的名字不会和 JSON 里一字不差：
 *   全角半角、空格、标点、英文大小写、"!"和"！"、
 *   以及最常见的——记不住副标题只打了前半截。
 *   所以两边都去掉空白和标点、统一小写，再比。
 *
 * 【为什么连"的""了"这类虚词也去掉】
 *   「辉夜大小姐想让我告白」和「辉夜大小姐想告白我」差一个字就判错，
 *   但人显然是认出来了。把虚词和"想让我"这类口语插入语去掉之后，
 *   比的是"有没有认出这部番"，而不是"背不背得下全名"。
 */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/[的了呢吧啊呀哦嘛]/g, '')
}

/**
 * 用户输入算不算答对了这一部。
 *
 * 【三层判定，一层比一层宽】
 *   1. 洗过之后完全一样 —— 打对了全名
 *   2. 命中别名/简称 —— 「春物」「小圆」「石头门」都算
 *   3. 输入够长（≥3 字）且是正确名字的开头 —— 只记得前半截也算
 *   第 3 条不是放水：能打出「辉夜大小姐」的人，显然是认出来了，
 *   难的是认出来，不是背全称。
 */
export function isTitleMatch(input: string, answer: string, aliases: string[] = []): boolean {
  const a = normalizeTitle(input)
  if (!a) return false

  const candidates = [answer, ...aliases].map(normalizeTitle).filter(Boolean)
  if (candidates.includes(a)) return true

  const b = normalizeTitle(answer)
  if (a.length >= 3 && b.startsWith(a)) return true
  // 反过来：用户打全了，但我们这边少了副标题
  if (b.length >= 3 && a.startsWith(b)) return true

  return false
}

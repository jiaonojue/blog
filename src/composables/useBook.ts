/**
 * 「这一站是一本同人志」—— 页码与既読（读过的标记）。
 *
 * 【页码怎么算】
 *   文章按时间排：最早的一篇是第 01 話，也是全书最前面的正文页。
 *   正文前面留 6 页前置页（封面、扉页、目次……），所以最早那篇在 P.07。
 *   最新的一篇永远落在整本的最后一页，所以卷末四格显示的页码会跟着文章数量变。
 *
 *   想让第一篇文章从 P.01 开始，把 FRONT_MATTER 改成 0 即可。
 *
 * 【既読为什么不在打开文章时记】
 *   打开一篇文章不等于读完了。只有滚到文章末尾、"本页完"那一行真的出现，才盖印。
 *   这样卡片上的「既読」才不是自欺欺人。
 *
 * 记录存在 localStorage 的 'site:read:v1'，只存文章路径，没有任何别的信息。
 * 访客清掉浏览器数据，印记就一起消失——这是本地的、一次性的，不上传任何地方。
 */
import { ref, computed } from 'vue'
import { posts } from '@/composables/useContent'

/** 正文前面的前置页数（封面、扉页、目次……）：只占页码，不占正文 */
const FRONT_MATTER = 6

/** 整本一共多少页 */
export const totalPages = computed(() => FRONT_MATTER + posts.length)

/** 数字补零：7 → "07"，让所有页码位数对齐 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 这篇文章在整本里的页码；找不到返回 0 */
export function pageOf(path: string): number {
  const i = posts.findIndex((p) => p.path === path)
  if (i < 0) return 0
  // posts 是"新的在前"，所以下标越大越靠前（页数越小）
  return FRONT_MATTER + (posts.length - i)
}

/** 这篇文章是第几話；最早的一篇是第 01 話 */
export function issueOf(path: string): number {
  const i = posts.findIndex((p) => p.path === path)
  if (i < 0) return 0
  return posts.length - i
}

/* ── 既読 ───────────────────────────────────────────────── */

const STORAGE_KEY = 'site:read:v1'

/** 已经读完的文章路径。初始为空，客户端挂载后再从 localStorage 补上 */
export const readPaths = ref<string[]>([])

/** 最多记多少条，防止 localStorage 无限长大 */
const MAX_RECORDS = 300

/**
 * 从 localStorage 读取既読记录。
 * 必须等浏览器挂载之后再调用（见 App.vue），
 * 否则预渲染出的 HTML 和客户端首次渲染会不一致，Vue 会报水合警告。
 */
export function initReadMarks(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    readPaths.value = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    /* 数据坏了就当没读过，不要因为一个印记让整页崩掉 */
  }
}

/** 这篇读过了吗 */
export function isRead(path: string): boolean {
  return readPaths.value.includes(path)
}

/** 盖一个既読印 */
export function markRead(path: string): void {
  if (!path || readPaths.value.includes(path)) return
  const next = [...readPaths.value, path].slice(-MAX_RECORDS)
  readPaths.value = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 隐私模式下写不进去，本轮会话里仍然显示印记 */
  }
}

/** 读完了多少篇（只算现在还存在的文章，删掉的旧文不计数） */
export const readCount = computed(
  () => readPaths.value.filter((p) => posts.some((post) => post.path === p)).length,
)

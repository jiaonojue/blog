/**
 * 页面背景 —— 给每篇文章、每个栏目、每个标签挑一张固定的插画。
 *
 * 【为什么是"固定"而不是"随机"】
 *   如果用 Math.random()，同一篇文章刷新两次会换图，访客会以为站点抽风了；
 *   分享出去的链接和截图也会对不上。
 *   这里用「字符串哈希 → 取模」：同一个 key 永远得到同一张图。
 *   看起来像随机分配，实际上是稳定的。
 *
 * 【背景为什么这么淡】
 *   背景是用来定气氛的，不是主角。正文压在上面必须看得清，
 *   所以除了低透明度，还叠了一层从底色到透明的渐变遮罩（见 PageBackdrop.vue）。
 */
import { ref, computed } from 'vue'
import { withBase } from '@/composables/useContent'

/**
 * 可用的背景图清单。
 * 新增图片时：把 WebP 放进 public/art/bg/，然后在这里加一个文件名。
 * 数量和文件名都会参与分配，加图之后所有页面的背景会重新洗一遍——
 * 这是正常的，只要每次结果都一样就行。
 */
export const BACKGROUNDS = [
  'bg-02.webp',
  'bg-03.webp',
  'bg-04.webp',
  'bg-06.webp',
  'bg-10.webp',
  'bg-12.webp',
  'bg-15.webp',
  'bg-16.webp',
  'bg-17.webp',
  'bg-19.webp',
  'bg-20.webp',
  'bg-21.webp',
  'bg-24.webp',
  'bg-25.webp',
  'bg-26.webp',
  'bg-29.webp',
  'bg-33.webp',
  'bg-34.webp',
  'bg-35.webp',
  'bg-37.webp',
  'bg-39.webp',
  'bg-41.webp',
  'bg-42.webp',
  'bg-43.webp',
] as const

/**
 * 字符串 → 32 位无符号整数。
 * FNV-1a：短、快、分布均匀，用来把文章路径打散成背景编号足够。
 */
function hash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 按 key 稳定地取一张背景图的完整 URL */
export function backgroundFor(key: string): string {
  const name = BACKGROUNDS[hash(key) % BACKGROUNDS.length]
  return withBase(`/art/bg/${name}`)
}

/**
 * 页面可以覆盖当前背景。
 *
 * 【为什么需要这个】
 *   默认背景由路由路径决定（同一篇文章永远同一张）。
 *   但文章列表页点「番剧」筛选时路径没变，背景却应该跟着分类换——
 *   所以给页面一个"临时指定种子"的口子：页面自己调 setBackdrop()，
 *   离开时清空，就退回按路由路径分配。
 */
const override = ref('')

/** 页面主动指定背景（传空字符串取消覆盖） */
export function setBackdrop(seed: string): void {
  override.value = seed
}

/** 当前实际使用的背景种子 */
export const activeBackdrop = computed(() => override.value)

/**
 * 给页面用的便捷封装：
 *   调用一次，返回 setBackdrop；组件卸载时自动清空。
 *
 * 用法：
 *   const useBg = useBackdrop()
 *   watch(activeCategory, (c) => useBg.set(`category:${c}`))
 */
export function useBackdrop() {
  return {
    set(seed: string) {
      setBackdrop(seed)
    },
    clear() {
      setBackdrop('')
    },
  }
}

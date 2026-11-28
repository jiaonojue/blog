/**
 * 附录（摸鱼分区）的共享状态。
 *
 * 【为什么单独一个文件】
 *   顶部导航要在"滑到附录"时把自己的五个链接换成附录的四个栏目，
 *   而导航和附录是两棵不相干的组件树（一个在 App.vue，一个在首页里）。
 *   两边都 import 这个文件里的同一批 ref，就自然同步了。
 *
 * 【为什么存下标而不是 key】
 *   附录是一叠横向排开的页，翻页就是"第几页"。
 *   下标直接对应横向轨道要平移多少，少一层映射。
 */
import { ref } from 'vue'

export interface MoyuTab {
  /** 稳定的标识，将来加页时不要改已有的 */
  key: string
  /** 导航和页签上显示的名字，两个字最好看 */
  label: string
  /** 这一页放的是什么，用在页脚那行小字里 */
  unit: string
}

export const MOYU_TABS: readonly MoyuTab[] = [
  { key: 'novel', label: '读本', unit: '一本小说' },
  { key: 'gacha', label: '抽签', unit: '一次抽签' },
  { key: 'quiz', label: '猜番', unit: '一轮猜番' },
  { key: 'top', label: '十佳', unit: '一份十佳' },
  { key: 'notes', label: '便条', unit: '一块便条板' },
] as const

/** 附录是否正占着视口中段。true 时顶部导航换成附录栏目 */
export const moyuActive = ref(false)

/** 当前翻到第几页（MOYU_TABS 的下标） */
export const moyuTab = ref(0)

export function setMoyuTab(i: number): void {
  moyuTab.value = Math.min(MOYU_TABS.length - 1, Math.max(0, Math.round(i)))
}

/** 翻一页。到头就停住，不循环——附录不是轮播图 */
export function stepMoyu(delta: number): void {
  setMoyuTab(moyuTab.value + delta)
}

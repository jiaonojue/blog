/**
 * 设置面板的状态 —— 主题、动效、导航显隐都存在这里。
 *
 * 数据落在 localStorage 的 'site:settings:v1'。
 * 想加一个新开关：在 Settings 接口加字段 → 在 DEFAULTS 加默认值 → 在设置面板加一行。
 */
import { ref, watch, computed } from 'vue'

export type ThemeName = 'daylight' | 'neon' | 'auto'

export interface Settings {
  theme: ThemeName
  /** 减少动效总开关 */
  motion: 'on' | 'off'
  /** 路由转场 */
  transition: 'slide' | 'wipe'
  /** 加载策略 */
  loading: 'minimal' | 'illustration' | 'off'
  /** 桌面鼠标光斑 */
  cursorGlow: boolean
  /** 自定义光标 */
  customCursor: boolean
  /** 光标拖尾（默认关） */
  cursorTrail: boolean
  /** 首页花瓣粒子 */
  petals: boolean
  /** 关于页插画气泡 */
  aboutIllustration: boolean
  /** 被隐藏的导航项 key 列表 */
  hiddenNav: string[]
}

export const DEFAULTS: Settings = {
  theme: 'daylight',
  motion: 'on',
  transition: 'slide',
  loading: 'minimal',
  cursorGlow: true,
  customCursor: true,
  cursorTrail: false,
  petals: false,
  aboutIllustration: true,
  hiddenNav: ['tools', 'now', 'credits'],
}

const STORAGE_KEY = 'site:settings:v1'

function load(): Settings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

/** 全局共享的响应式设置对象 */
export const settings = ref<Settings>(load())

/** 系统是否要求减少动效 */
const systemReduced = ref(false)
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  systemReduced.value = mq.matches
  mq.addEventListener('change', (e) => {
    systemReduced.value = e.matches
  })
}

/** 真正该不该播放动效：系统设置优先生效，站内开关只能再收紧 */
export const motionEnabled = computed(() => !systemReduced.value && settings.value.motion === 'on')

/** 当前实际生效的主题名（把 auto 解析成具体主题） */
export const resolvedTheme = computed(() => {
  const t = settings.value.theme
  if (t !== 'auto') return t
  if (typeof window === 'undefined') return 'daylight'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'neon' : 'daylight'
})

/** 把设置写回 localStorage，并同步到 <html> 的属性上 */
export function applySettings() {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.dataset.theme = resolvedTheme.value
  el.dataset.motion = motionEnabled.value ? 'on' : 'off'
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  } catch {
    /* 隐私模式下写不进去，忽略即可 */
  }
}

/** 监听设置变化，自动应用 */
watch(settings, applySettings, { deep: true })
watch(resolvedTheme, applySettings)

/** 恢复默认设置 */
export function resetSettings() {
  settings.value = { ...DEFAULTS, hiddenNav: [...DEFAULTS.hiddenNav] }
}

import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { routerOptions } from './router'
import { applySettings, settings, motionEnabled } from './composables/useSettings'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/prose.css'
import './styles/print.css'

/**
 * 应用入口。
 * ViteSSG 会在构建时把每个路由渲染成真实 HTML 文件（利于 SEO 和直接访问子页面）。
 */
export const createApp = ViteSSG(App, routerOptions, ({ router, isClient }) => {
  if (!isClient) return

  applySettings()

  // 每个页面都检查一次设置，保证刷新后主题不丢
  router.afterEach(() => {
    applySettings()
  })

  // 把"当前是否允许多效"暴露给 CSS，供个别组件判断
  document.documentElement.dataset.motion = motionEnabled.value ? 'on' : 'off'
  void settings
})

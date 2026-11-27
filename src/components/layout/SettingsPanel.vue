<script setup lang="ts">
/**
 * 设置面板 —— 右侧抽屉。
 * 所有选项都会存进 localStorage，刷新后保持。
 *
 * 【想加一个新开关】
 *   1. 在 src/composables/useSettings.ts 的 Settings 接口加字段 + DEFAULTS 加默认值
 *   2. 在下面模板里复制一组 .switch-row 改成你要的
 */
import { computed } from 'vue'
import { navItems } from '@/data/site.config'
import { site } from '@/data/site.config'
import { settings, resetSettings, DEFAULTS, type ThemeName } from '@/composables/useSettings'
import { X, RotateCcw } from '@lucide/vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const themes: { key: ThemeName; label: string }[] = [
  { key: 'daylight', label: '日间' },
  { key: 'neon', label: '霓虹' },
  { key: 'auto', label: '跟随系统' },
]

/** 导航显隐：勾上表示显示 */
function isNavVisible(key: string) {
  return !settings.value.hiddenNav.includes(key)
}

function toggleNav(key: string) {
  const hidden = settings.value.hiddenNav
  settings.value.hiddenNav = hidden.includes(key)
    ? hidden.filter((k) => k !== key)
    : [...hidden, key]
}

const version = '0.1.0'
const showChangelog = computed(() => props.open)
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="settings-root no-print">
      <!-- 点击遮罩关闭 -->
      <div class="settings-scrim" @click="emit('update:open', false)" />

      <aside class="settings-panel" role="dialog" aria-modal="true" aria-label="设置">
        <header class="panel-head">
          <h2 class="panel-title">设置</h2>
          <button class="panel-close" type="button" @click="emit('update:open', false)">
            <span class="sr-only">关闭设置</span>
            <X :size="18" :stroke-width="1.75" aria-hidden="true" />
          </button>
        </header>

        <div class="panel-body">
          <!-- ── 外观 ───────────────────────────────────── -->
          <section class="panel-group">
            <h3 class="group-title">外观</h3>

            <div class="switch-row">
              <span class="row-label">主题</span>
              <div class="seg">
                <button
                  v-for="t in themes"
                  :key="t.key"
                  type="button"
                  class="seg-btn"
                  :class="{ active: settings.theme === t.key }"
                  @click="settings.theme = t.key"
                >
                  {{ t.label }}
                </button>
              </div>
            </div>
          </section>

          <!-- ── 动效 ───────────────────────────────────── -->
          <section class="panel-group">
            <h3 class="group-title">动效</h3>

            <label class="switch-row">
              <span class="row-label">减少动效</span>
              <input
                type="checkbox"
                class="toggle"
                :checked="settings.motion === 'off'"
                @change="
                  settings.motion = ($event.target as HTMLInputElement).checked ? 'off' : 'on'
                "
              />
            </label>

            <div class="switch-row">
              <span class="row-label">页面转场</span>
              <div class="seg">
                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: settings.transition === 'drift' }"
                  @click="settings.transition = 'drift'"
                >
                  翻页
                </button>
                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: settings.transition === 'fade' }"
                  @click="settings.transition = 'fade'"
                >
                  淡入
                </button>
              </div>
            </div>

            <label class="switch-row">
              <span class="row-label">鼠标光斑（桌面）</span>
              <input v-model="settings.cursorGlow" type="checkbox" class="toggle" />
            </label>

            <label class="switch-row">
              <span class="row-label">自定义光标</span>
              <input v-model="settings.customCursor" type="checkbox" class="toggle" />
            </label>

            <label class="switch-row">
              <span class="row-label">光标拖尾</span>
              <input v-model="settings.cursorTrail" type="checkbox" class="toggle" />
            </label>

            <label class="switch-row">
              <span class="row-label">首页花瓣</span>
              <input v-model="settings.petals" type="checkbox" class="toggle" />
            </label>
          </section>

          <!-- ── 内容 ───────────────────────────────────── -->
          <section class="panel-group">
            <h3 class="group-title">内容</h3>

            <label class="switch-row">
              <span class="row-label">关于页插画气泡</span>
              <input v-model="settings.aboutIllustration" type="checkbox" class="toggle" />
            </label>

            <div class="nav-toggles">
              <span class="row-label">导航显示项</span>
              <label v-for="item in navItems" :key="item.key" class="nav-check">
                <input
                  type="checkbox"
                  :checked="isNavVisible(item.key)"
                  @change="toggleNav(item.key)"
                />
                <span>{{ item.label }}</span>
              </label>
            </div>
          </section>

          <!-- ── 关于 ───────────────────────────────────── -->
          <section class="panel-group">
            <h3 class="group-title">关于</h3>

            <p class="about-line">
              版本 {{ version }} ·
              <a :href="site.issuesUrl" target="_blank" rel="noopener noreferrer">仓库</a>
            </p>

            <details class="changelog">
              <summary>更新日志</summary>
              <p class="changelog-body">
                每次改动都会记录在仓库根目录的 CHANGELOG.md
                里。展开这里会显示最近几条（构建时注入）。
              </p>
            </details>

            <button class="reset-btn" type="button" @click="resetSettings">
              <RotateCcw :size="14" :stroke-width="1.75" aria-hidden="true" />
              恢复默认设置
            </button>
            <p class="sr-only">{{ showChangelog ? '' : '' }}{{ DEFAULTS.theme }}</p>
          </section>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.settings-root {
  position: fixed;
  inset: 0;
  z-index: var(--z-drawer);
}

.settings-scrim {
  position: absolute;
  inset: 0;
  background: rgba(20, 12, 20, 0.32);
  backdrop-filter: blur(2px);
}

.settings-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(360px, 88vw);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--line);
  box-shadow: var(--shadow-lift);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--line);
  flex: 0 0 auto;
}

.panel-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.panel-close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--r-pill);
  color: var(--ink-soft);
}

.panel-close:hover {
  background: var(--bg-soft);
  color: var(--ink);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 28px;
  /* 刘海屏底部安全区 */
  padding-bottom: calc(28px + env(safe-area-inset-bottom));
}

.panel-group {
  padding: 18px 0;
  border-bottom: 1px dashed var(--line);
}

.panel-group:last-child {
  border-bottom: 0;
}

.group-title {
  margin-bottom: 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 4px 0;
  cursor: pointer;
}

.row-label {
  font-size: 14px;
}

/* ── 分段控件 ───────────────────────────────────────────── */
.seg {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--r-pill);
  background: var(--bg-soft);
}

.seg-btn {
  padding: 5px 11px;
  border-radius: var(--r-pill);
  font-size: 12.5px;
  color: var(--ink-soft);
  transition:
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.seg-btn.active {
  background: var(--accent);
  color: var(--accent-ink);
}

/* ── 开关 ───────────────────────────────────────────────── */
.toggle {
  appearance: none;
  width: 42px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: var(--r-pill);
  background: var(--line);
  position: relative;
  cursor: pointer;
  transition: background-color var(--t-fast) var(--ease-out);
}

.toggle::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform var(--t-fast) var(--ease-out);
}

.toggle:checked {
  background: var(--accent);
}

.toggle:checked::after {
  transform: translateX(18px);
}

/* ── 导航勾选 ───────────────────────────────────────────── */
.nav-toggles {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.nav-check {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 34px;
  font-size: 14px;
  cursor: pointer;
}

.nav-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

/* ── 关于区 ─────────────────────────────────────────────── */
.about-line {
  font-size: 13px;
  color: var(--ink-soft);
}

.about-line a {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.changelog {
  margin-top: 12px;
  font-size: 13px;
}

.changelog summary {
  cursor: pointer;
  color: var(--ink-soft);
  /* 默认收起，点开才看得到内容 */
  list-style: none;
}

.changelog summary::-webkit-details-marker {
  display: none;
}

.changelog summary::before {
  content: '▸ ';
  color: var(--accent);
}

.changelog[open] summary::before {
  content: '▾ ';
}

.changelog-body {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--r-input);
  background: var(--bg-soft);
  color: var(--ink-soft);
  line-height: 1.7;
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
  padding: 8px 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  font-size: 13px;
  color: var(--ink-soft);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.reset-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── 抽屉动效 ───────────────────────────────────────────── */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity var(--t-base) var(--ease-out);
}

.drawer-enter-active .settings-panel,
.drawer-leave-active .settings-panel {
  transition: transform var(--t-base) var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .settings-panel,
.drawer-leave-to .settings-panel {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-from .settings-panel,
  .drawer-leave-to .settings-panel {
    transform: none;
  }
}
</style>

<script setup lang="ts">
import { site } from '@/data/site.config'
import SiteMark from '@/components/ui/SiteMark.vue'
import { navItems } from '@/data/site.config'
import { settings } from '@/composables/useSettings'
import { computed } from 'vue'

const year = new Date().getFullYear()

/** 页脚只放默认可见的次要链接，不放任何联系方式 */
const footerLinks = computed(() =>
  navItems.filter((i) => !settings.value.hiddenNav.includes(i.key) && i.key !== 'home'),
)
</script>

<template>
  <footer class="site-footer no-print">
    <div class="container">
      <div class="footer-line" aria-hidden="true" />

      <div class="footer-body">
        <div class="footer-brand">
          <SiteMark :size="22" :framed="false" />
          <p class="footer-copy">© {{ site.since }}–{{ year }} {{ site.handle }}</p>
        </div>

        <nav class="footer-links" aria-label="页脚导航">
          <RouterLink v-for="item in footerLinks" :key="item.key" :to="item.path">
            {{ item.label }}
          </RouterLink>
          <a :href="`${site.base}rss.xml`">RSS</a>
        </nav>
      </div>

      <!-- 页脚那句诗 / 彩蛋 -->
      <p class="footer-note">{{ site.footerNote }}</p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: 96px;
  padding-bottom: 48px;
}

/* 移动端底部 Dock 会盖住页脚，多留空间 */
@media (max-width: 767px) {
  .site-footer {
    margin-top: 64px;
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }
}

.footer-line {
  height: 1px;
  margin-bottom: 28px;
  background: var(--line);
}

.footer-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-copy {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 13px;
  color: var(--ink-soft);
}

.footer-links a {
  transition: color var(--t-fast) var(--ease-out);
}

.footer-links a:hover {
  color: var(--accent);
}

.footer-note {
  margin-top: 22px;
  font-family: var(--font-quote);
  font-size: 14px;
  color: var(--ink-soft);
  opacity: 0.85;
}

@media (max-width: 767px) {
  .footer-body {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
}
</style>

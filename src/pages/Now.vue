<script setup lang="ts">
import { now } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import TypeLine from '@/components/motion/TypeLine.vue'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'

useSeo({ title: 'Now', description: '我最近在做、在看、在想的事。' })

const updatedText = now.updated ? now.updated.replace(/-/g, '.') : ''
</script>

<template>
  <div class="container now-page">
    <header class="page-head">
      <TapeLabel>now</TapeLabel>
      <h1 class="now-title t-display">
        <TypeLine text="此刻" :speed="90" :start-delay="150" />
      </h1>
      <p v-if="updatedText" class="now-updated">最后更新于 {{ updatedText }}</p>
    </header>

    <EmptyState v-if="!now.html" title="还没写" desc="在 content/now.md 里写几行就出现了。" />

    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="prose now-prose" v-html="now.html" />

    <RevealOnScroll>
      <p class="now-foot">
        这一页记录"现在"的状态，所以它会变。想知道我平时写什么，去
        <RouterLink to="/posts">文章</RouterLink>
        。
      </p>
    </RevealOnScroll>
  </div>
</template>

<style scoped>
.now-page {
  padding-top: 24px;
  max-width: 760px;
}

.page-head {
  margin-bottom: 36px;
}

.now-title {
  margin-top: 12px;
}

.now-updated {
  margin-top: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
}

.now-prose {
  max-width: none;
}

.now-foot {
  margin-top: 46px;
  padding-top: 20px;
  border-top: 1px dashed var(--line);
  font-size: 13.5px;
  color: var(--ink-soft);
}

.now-foot a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>

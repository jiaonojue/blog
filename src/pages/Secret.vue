<script setup lang="ts">
/** 隐藏页 —— 只有输入 Konami 秘技才会来到这里 */
import { useSeo } from '@/composables/useSeo'
import SiteMark from '@/components/ui/SiteMark.vue'
import TapeLabel from '@/components/ui/TapeLabel.vue'

useSeo({ title: '秘密', noindex: true })
</script>

<template>
  <div class="container secret-page">
    <div class="secret-card">
      <TapeLabel tone="accent" :tilt="-2">secret</TapeLabel>

      <SiteMark :size="52" class="secret-mark" />

      <h1 class="secret-title">你找到了。</h1>

      <p class="secret-text">
        既然能摸到这里，说明你知道那串老密码。
        <br />
        这一页没有任何有用的东西 —— 只有一句话：
      </p>

      <blockquote class="secret-quote">
        「做站最难的不是把东西放上去，
        <br />
        而是有一天你还愿意打开它。」
      </blockquote>

      <RouterLink to="/" class="secret-back">回到首页</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.secret-page {
  display: grid;
  place-items: center;
  min-height: 60dvh;
  padding-top: 24px;
}

.secret-card {
  max-width: 520px;
  padding: 40px 34px 36px;
  border-radius: var(--r-card);
  border: var(--w-stroke) solid var(--ink);
  background: var(--surface);
  text-align: center;
}

.secret-mark {
  margin: 22px auto 18px;
}

.secret-title {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2.1rem);
}

.secret-text {
  margin-top: 16px;
  font-size: 14.5px;
  line-height: 1.9;
  color: var(--ink-soft);
}

.secret-quote {
  margin: 24px 0;
  padding: 18px 20px;
  border-radius: var(--r-input);
  background: var(--bg-soft);
  font-family: var(--font-quote);
  font-size: 15px;
  line-height: 1.9;
  color: var(--ink);
}

.secret-back {
  display: inline-block;
  margin-top: 6px;
  padding: 10px 22px;
  border-radius: var(--r-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 13.5px;
  transition: transform var(--t-fast) var(--ease-out);
}

.secret-back:hover {
  transform: translateY(-2px);
}

[data-motion='off'] .secret-back:hover {
  transform: none;
}
</style>

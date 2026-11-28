import type { RouteRecordRaw } from 'vue-router'

/**
 * 页面路由表。
 *
 * 【想加一个新页面】
 *   1. 在 src/pages/ 下新建一个 .vue 文件
 *   2. 在下面 routes 里加一条
 *   3. 想让它在导航里出现，就去 src/data/site.config.ts 的 navItems 加一项
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/Home.vue'),
  },
  {
    path: '/posts',
    name: 'posts',
    component: () => import('@/pages/Posts.vue'),
  },
  {
    path: '/posts/:year/:slug',
    name: 'post',
    component: () => import('@/pages/PostDetail.vue'),
    props: true,
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('@/pages/Favorites.vue'),
  },
  {
    path: '/gallery',
    name: 'gallery',
    component: () => import('@/pages/Gallery.vue'),
  },
  {
    path: '/tools',
    name: 'tools',
    component: () => import('@/pages/Tools.vue'),
  },
  {
    path: '/now',
    name: 'now',
    component: () => import('@/pages/Now.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/pages/About.vue'),
  },
  {
    path: '/changelog',
    name: 'changelog',
    component: () => import('@/pages/Changelog.vue'),
  },
  {
    path: '/credits',
    name: 'credits',
    component: () => import('@/pages/Credits.vue'),
  },
  {
    path: '/secret',
    name: 'secret',
    component: () => import('@/pages/Secret.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFound.vue'),
  },
]

/**
 * 路由配置。
 *
 * 【为什么没有写 history】
 *   vite-ssg 会自己决定用哪种路由历史：
 *     构建时（Node 里）用内存路由，浏览器里才用地址栏。
 *   base 由它统一设置，所以我们只需要给它 routes。
 *
 * 【想加一个新页面】
 *   1. 在 src/pages/ 下新建一个 .vue 文件
 *   2. 在下面 routes 里加一条
 *   3. 想让它在导航里出现，就去 src/data/site.config.ts 的 navItems 加一项
 */
export const routerOptions = {
  base: import.meta.env.BASE_URL,
  routes,
  scrollBehavior(to: { hash: string }, _from: unknown, savedPosition: unknown) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' as const, top: 96 }
    return { top: 0 }
  },
}

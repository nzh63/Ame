import { createRouter, createWebHashHistory } from 'vue-router';

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/translator',
      component: () => import('@render/views/Translator.vue'),
    },
    {
      path: '/hook-select',
      component: () => import('@render/views/HookSelect.vue'),
    },
    {
      path: '/extract-setting',
      component: () => import('@render/views/ExtractSetting.vue'),
    },
    {
      path: '/',
      redirect: '/hook-select',
    },
  ],
});

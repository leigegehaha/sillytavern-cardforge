import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './styles/global.css';

// 路由配置
const routes = [
  { path: '/', redirect: '/basic' },
  { path: '/basic', component: () => import('./views/BasicInfo.vue'), meta: { title: '基本信息' } },
  { path: '/greeting', component: () => import('./views/GreetingEditor.vue'), meta: { title: '开场白' } },
  { path: '/worldbook', component: () => import('./views/WorldBookEditor.vue'), meta: { title: '世界书' } },
  { path: '/regex', component: () => import('./views/RegexEditor.vue'), meta: { title: '正则脚本' } },
  { path: '/script', component: () => import('./views/ScriptEditor.vue'), meta: { title: '酒馆脚本' } },
  { path: '/ejs', component: () => import('./views/EjsEditor.vue'), meta: { title: 'EJS 模板' } },
  { path: '/mvu', component: () => import('./views/MvuEditor.vue'), meta: { title: 'MVU 变量' } },
  { path: '/statusbar', component: () => import('./views/StatusBarEditor.vue'), meta: { title: '状态栏' } },
  { path: '/npc', component: () => import('./views/NpcGenerator.vue'), meta: { title: 'NPC 生成' } },
  { path: '/stats', component: () => import('./views/Statistics.vue'), meta: { title: '卡片统计' } },
  { path: '/api', component: () => import('./views/ApiSettings.vue'), meta: { title: 'API 设置' } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

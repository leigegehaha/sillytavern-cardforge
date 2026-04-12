import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './styles/global.css';

const routes = [
  { path: '/', redirect: '/basic' },
  // 必填
  { path: '/basic', component: () => import('./views/BasicInfo.vue') },
  { path: '/charsetting', component: () => import('./views/CharSetting.vue') },
  { path: '/worldbook', component: () => import('./views/WorldBookEditor.vue') },
  { path: '/greeting', component: () => import('./views/GreetingEditor.vue') },
  // 可选
  { path: '/npc', component: () => import('./views/NpcGenerator.vue') },
  { path: '/player', component: () => import('./views/PlayerChar.vue') },
  { path: '/dialogue', component: () => import('./views/DialogueSample.vue') },
  { path: '/extra', component: () => import('./views/ExtraRules.vue') },
  // 高级
  { path: '/mvu', component: () => import('./views/MvuEditor.vue') },
  { path: '/regex', component: () => import('./views/RegexEditor.vue') },
  { path: '/script', component: () => import('./views/ScriptEditor.vue') },
  { path: '/ejs', component: () => import('./views/EjsEditor.vue') },
  { path: '/statusbar', component: () => import('./views/StatusBarEditor.vue') },
  // 工具
  { path: '/assistant', component: () => import('./views/AiAssistant.vue') },
  { path: '/stats', component: () => import('./views/Statistics.vue') },
  // 设置
  { path: '/api', component: () => import('./views/ApiSettings.vue') },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

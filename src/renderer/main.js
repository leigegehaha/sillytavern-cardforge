import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';

// Views
import Dashboard from './views/Dashboard.vue';
import BasicInfo from './views/BasicInfo.vue';
import CharSetting from './views/CharSetting.vue';
import GreetingEditor from './views/GreetingEditor.vue';
import WorldBookEditor from './views/WorldBookEditor.vue';
import RegexEditor from './views/RegexEditor.vue';
import ScriptEditor from './views/ScriptEditor.vue';
import EjsEditor from './views/EjsEditor.vue';
import StatusBarEditor from './views/StatusBarEditor.vue';
import NpcGenerator from './views/NpcGenerator.vue';
import PlayerChar from './views/PlayerChar.vue';
import DialogueSample from './views/DialogueSample.vue';
import ExtraRules from './views/ExtraRules.vue';
import MvuEditor from './views/MvuEditor.vue';
import PackageExport from './views/PackageExport.vue';
import AiAssistant from './views/AiAssistant.vue';
import Statistics from './views/Statistics.vue';
import ApiSettings from './views/ApiSettings.vue';

// Styles
import './styles/main.scss';

const routes = [
  { path: '/', name: 'dashboard', component: Dashboard, meta: { title: '工作台' } },
  { path: '/basic', name: 'basic', component: BasicInfo, meta: { title: '基本信息' } },
  { path: '/charsetting', name: 'charsetting', component: CharSetting, meta: { title: '角色设定' } },
  { path: '/worldbook', name: 'worldbook', component: WorldBookEditor, meta: { title: '世界书' } },
  { path: '/npc', name: 'npc', component: NpcGenerator, meta: { title: 'NPC 生成器' } },
  { path: '/greeting', name: 'greeting', component: GreetingEditor, meta: { title: '开场白' } },
  { path: '/player', name: 'player', component: PlayerChar, meta: { title: '玩家角色' } },
  { path: '/dialogue', name: 'dialogue', component: DialogueSample, meta: { title: '对话样本' } },
  { path: '/extra', name: 'extra', component: ExtraRules, meta: { title: '额外需求' } },
  { path: '/mvu', name: 'mvu', component: MvuEditor, meta: { title: 'MVU 变量系统' } },
  { path: '/regex', name: 'regex', component: RegexEditor, meta: { title: '正则脚本' } },
  { path: '/scripts', name: 'scripts', component: ScriptEditor, meta: { title: '酒馆助手脚本' } },
  { path: '/ejs', name: 'ejs', component: EjsEditor, meta: { title: 'EJS 模板' } },
  { path: '/statusbar', name: 'statusbar', component: StatusBarEditor, meta: { title: '前端状态栏' } },
  { path: '/package', name: 'package', component: PackageExport, meta: { title: '打包角色卡' } },
  { path: '/assistant', name: 'assistant', component: AiAssistant, meta: { title: 'AI 助手' } },
  { path: '/statistics', name: 'statistics', component: Statistics, meta: { title: '卡片统计' } },
  { path: '/api', name: 'api', component: ApiSettings, meta: { title: 'API 设置' } }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

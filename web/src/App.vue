<template>
  <div class="app" :class="{ 'sidebar-open': sidebarOpen }">
    <!-- 移动端顶部栏 -->
    <header class="topbar">
      <button class="topbar__menu" @click="sidebarOpen = !sidebarOpen">
        <span></span><span></span><span></span>
      </button>
      <h1 class="topbar__title">CardForge</h1>
      <div class="topbar__actions">
        <button class="btn btn--sm btn--accent" @click="importCard">导入</button>
        <button class="btn btn--sm btn--primary" @click="exportCard">导出</button>
      </div>
    </header>

    <!-- 侧边栏 -->
    <aside class="sidebar" @click.self="sidebarOpen = false">
      <nav class="sidebar__nav">
        <div class="sidebar__section">文件</div>
        <button class="sidebar__btn" @click="importCard">导入 PNG/JSON</button>
        <button class="sidebar__btn" @click="exportCard">导出 PNG</button>
        <button class="sidebar__btn" @click="exportJson">导出 JSON</button>
        <button class="sidebar__btn sidebar__btn--danger" @click="newCard">新建空卡</button>

        <template v-for="section in navSections" :key="section.title">
          <div class="sidebar__section">{{ section.title }}</div>
          <template v-for="(link, idx) in section.links" :key="link.path || link.action || idx">
            <router-link v-if="link.path"
              :to="link.path" class="sidebar__link"
              :class="{ active: $route.path === link.path }"
              @click="sidebarOpen = false">
              {{ link.label }}
            </router-link>
            <button v-else-if="link.action === 'errorLog'"
              class="sidebar__link"
              @click="showErrorLog = true; sidebarOpen = false">
              {{ link.label }}
            </button>
          </template>
        </template>
      </nav>
      <div class="sidebar__footer">
        <span class="sidebar__card-name">{{ cardStore.cardName || '未加载' }}</span>
      </div>
    </aside>

    <!-- 遮罩层（移动端点击关闭侧边栏） -->
    <div class="overlay" v-if="sidebarOpen" @click="sidebarOpen = false"></div>

    <!-- 主内容 -->
    <main class="main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>

    <!-- 右侧 AI 助手抽屉 -->
    <div class="ai-drawer" :class="{ open: showDrawer }">
      <div class="ai-drawer__niangs">
        <button v-for="n in niangs" :key="n.id"
          :class="['ai-drawer__niang-btn', drawerMode === n.id ? 'active' : '']"
          :style="drawerMode === n.id ? { borderColor: n.color, color: n.color } : {}"
          @click="drawerMode = n.id">{{ n.name }}</button>
      </div>
      <div class="ai-drawer__header">
        <div class="flex-row">
          <button class="btn btn--sm" @click="drawerAnalyze" :disabled="drawerLoading">诊断</button>
          <button class="btn btn--accent btn--sm" @click="drawerNewChat">新对话</button>
          <button class="btn btn--ghost btn--sm" @click="showDrawerHistory = !showDrawerHistory">记录({{ drawerHistory.length }})</button>
          <button class="ai-drawer__close" @click="showDrawer = false">x</button>
        </div>
      </div>
      <div v-if="showDrawerHistory" class="ai-drawer__history">
        <div v-if="drawerHistory.length === 0" style="text-align:center;color:var(--cf-text-muted);padding:16px;font-size:13px">暂无历史</div>
        <div v-for="(h, i) in drawerHistory" :key="i" class="history-item" @click="loadDrawerHistoryItem(i)">
          <div class="flex-between">
            <span class="history-item__title">{{ h.title }}</span>
            <span class="history-item__time">{{ h.time }}</span>
          </div>
          <div class="history-item__preview">{{ h.preview }}</div>
        </div>
      </div>
      <div v-show="!showDrawerHistory" class="ai-drawer__messages" ref="drawerMsgBox">
        <div v-if="drawerMessages.length === 0" style="text-align:center;color:var(--cf-text-muted);padding:40px 20px;font-size:13px">
          <div :style="{ color: activeNiang.color }">{{ activeNiang.name }}</div>
          <div style="margin-top:8px">{{ activeNiang.greeting }}</div>
        </div>
        <div v-for="(msg, i) in drawerMessages" :key="i"
          :class="['float-msg', msg.role === 'user' ? 'float-msg--user' : 'float-msg--ai']">
          <div class="float-msg__name" :style="{ color: msg.color }">{{ msg.name }}</div>
          <div class="float-msg__text">{{ msg.content }}</div>
        </div>
        <div v-if="drawerLoading" class="float-msg float-msg--ai">
          <div class="float-msg__text" style="color:var(--cf-text-muted);font-style:italic">思考中...</div>
        </div>
      </div>
      <div class="ai-drawer__input">
        <textarea class="textarea" v-model="drawerInput" rows="2" placeholder="输入消息... (Ctrl+Enter 发送)"
          @keydown.ctrl.enter="sendDrawerMsg" :disabled="drawerLoading"></textarea>
        <button class="btn btn--primary" @click="sendDrawerMsg" :disabled="drawerLoading || !drawerInput.trim()">
          {{ drawerLoading ? '...' : '发送' }}
        </button>
      </div>
    </div>
    <button class="ai-drawer-toggle" :class="{ open: showDrawer }" @click="showDrawer = !showDrawer" title="AI 助手">
      {{ showDrawer ? '>' : 'AI' }}
    </button>

    <!-- 错误日志弹窗 -->
    <ErrorLogModal :visible="showErrorLog" @close="showErrorLog = false" />

    <!-- 自定义确认弹窗 -->
    <div v-if="appStore.confirmVisible" class="cf-confirm-overlay" @click.self="appStore.confirmNo()">
      <div class="cf-confirm-dialog">
        <div class="cf-confirm-msg">{{ appStore.confirmMessage }}</div>
        <div class="cf-confirm-btns">
          <button class="btn btn--danger" @click="appStore.confirmYes()">确认</button>
          <button class="btn" @click="appStore.confirmNo()">取消</button>
        </div>
      </div>
    </div>

    <!-- Toast 提示 -->
    <div class="toast-container">
      <div v-for="t in appStore.toasts" :key="t.id"
        class="toast" :class="'toast--' + t.type">
        {{ t.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue';
import { useCardStore } from './stores/card.js';
import { useApiStore } from './stores/api.js';
import { useAppStore } from './stores/app.js';
import { buildCardContext } from './utils/card-context.js';
import ErrorLogModal from './components/ErrorLogModal.vue';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const sidebarOpen = ref(false);
const showErrorLog = ref(false);

// AI 助手抽屉
const niangs = [
  { id: 'yeli', name: '夜璃', color: '#a78bfa', greeting: '有什么需要帮忙的吗？', personality: '冷静、理性、专业。说话简洁直接，偶尔带点毒舌。擅长分析问题和给出解决方案。' },
  { id: 'liangxiao', name: '凉宵', color: '#f472b6', greeting: '嗨~有什么想聊的？', personality: '温柔、体贴、耐心。说话温和亲切，喜欢鼓励人。擅长引导思路和启发创意。' },
  { id: 'youxi', name: '柚溪', color: '#34d399', greeting: '来来来，有啥问题尽管问！', personality: '活泼、开朗、热情。说话充满活力，喜欢用口语化的表达。擅长用轻松的方式解释复杂问题。' },
];

const showDrawer = ref(false);
const drawerMode = ref('youxi');
const drawerMessages = ref([]);
const drawerInput = ref('');
const drawerLoading = ref(false);
const drawerMsgBox = ref(null);
const showDrawerHistory = ref(false);
const drawerHistory = ref([]);
let dMsgId = 0;

const DRAWER_HISTORY_KEY = 'cardforge_drawer_history';
const activeNiang = computed(() => niangs.find(n => n.id === drawerMode.value) || niangs[2]);

function loadDrawerHistory() {
  try { drawerHistory.value = JSON.parse(localStorage.getItem(DRAWER_HISTORY_KEY) || '[]'); } catch (e) {}
}
function saveDrawerHistory() {
  try { localStorage.setItem(DRAWER_HISTORY_KEY, JSON.stringify(drawerHistory.value)); } catch (e) {}
}
function isSameDrawerMessages(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if ((a[i].role || '') !== (b[i].role || '')) return false;
    if ((a[i].content || '') !== (b[i].content || '')) return false;
  }
  return true;
}

function saveDrawerToHistory() {
  if (drawerMessages.value.length === 0) return;
  // 防重复：当前 messages 和历史里某条完全一致就不再保存（修复载入历史后再载入会复制的 bug）
  if (drawerHistory.value.some(h => isSameDrawerMessages(h.messages, drawerMessages.value))) return;
  const first = drawerMessages.value.find(m => m.role === 'user');
  const last = drawerMessages.value[drawerMessages.value.length - 1];
  const now = new Date();
  drawerHistory.value.unshift({
    title: first ? first.content.slice(0, 30) : '无标题',
    preview: (last.content || '').slice(0, 50),
    time: `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,
    messages: JSON.parse(JSON.stringify(drawerMessages.value))
  });
  if (drawerHistory.value.length > 100) drawerHistory.value = drawerHistory.value.slice(0, 100);
  saveDrawerHistory();
}
function drawerNewChat() {
  saveDrawerToHistory();
  drawerMessages.value = [];
  showDrawerHistory.value = false;
}
function loadDrawerHistoryItem(i) {
  const h = drawerHistory.value[i];
  if (!h) return;
  saveDrawerToHistory();
  drawerMessages.value = h.messages.map(m => ({ ...m }));
  dMsgId = Math.max(0, ...drawerMessages.value.map(m => m.id || 0)) + 1;
  showDrawerHistory.value = false;
  scrollDrawer();
}
async function sendDrawerMsg() {
  if (!drawerInput.value.trim() || drawerLoading.value) return;
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  const text = drawerInput.value.trim();
  const n = activeNiang.value;
  drawerMessages.value.push({ id: ++dMsgId, role: 'user', name: '你', content: text, color: '#f59e42' });
  drawerInput.value = '';
  drawerLoading.value = true;
  scrollDrawer();
  try {
    const context = buildCardContext(cardStore);
    let sys = `你是${n.name}，一个 SillyTavern 角色卡制作助手。\n性格：${n.personality}\n用中文回答，保持你的角色性格。`;
    if (context && context.length > 10) sys += '\n\n当前角色卡：\n' + context;
    const history = drawerMessages.value.filter(m => m.role === 'user' || m.niangId === n.id).slice(-10);
    const msgs = [{ role: 'system', content: sys }, ...history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))];
    const result = await apiStore.chat(msgs, { temperature: 0.85, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    drawerMessages.value.push({ id: ++dMsgId, role: 'assistant', niangId: n.id, name: n.name, content: result, color: n.color });
  } catch (e) {
    drawerMessages.value.push({ id: ++dMsgId, role: 'assistant', name: '系统', content: '出错了: ' + e.message, color: '#f87171' });
  } finally { drawerLoading.value = false; scrollDrawer(); }
}
async function drawerAnalyze() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  const context = buildCardContext(cardStore);
  if (!context || context.length < 10) { appStore.toastWarning('请先导入一张角色卡'); return; }
  const n = activeNiang.value;
  drawerMessages.value.push({ id: ++dMsgId, role: 'user', name: '你', content: '请诊断当前角色卡', color: '#f59e42' });
  drawerLoading.value = true;
  scrollDrawer();
  try {
    const sys = `你是${n.name}。性格：${n.personality}\n你现在要诊断一张角色卡，从问题诊断、解决方案、优化建议、评分四个方面分析。用你的角色性格来回答。`;
    const result = await apiStore.chat([{ role: 'system', content: sys }, { role: 'user', content: `请诊断：\n${context}` }], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    drawerMessages.value.push({ id: ++dMsgId, role: 'assistant', niangId: n.id, name: n.name, content: result, color: n.color });
  } catch (e) {
    drawerMessages.value.push({ id: ++dMsgId, role: 'assistant', name: '系统', content: '诊断失败: ' + e.message, color: '#f87171' });
  } finally { drawerLoading.value = false; scrollDrawer(); }
}
function scrollDrawer() {
  nextTick(() => { if (drawerMsgBox.value) drawerMsgBox.value.scrollTop = drawerMsgBox.value.scrollHeight; });
}

onMounted(() => {
  loadDrawerHistory();
  window.addEventListener('beforeunload', () => { saveDrawerToHistory(); });
});

const navSections = [
  { title: '必填', links: [
    { path: '/basic', label: '基本信息' },
    { path: '/charsetting', label: '角色设定' },
    { path: '/worldbook', label: '世界书' },
    { path: '/greeting', label: '开场白' },
  ]},
  { title: '可选', links: [
    { path: '/npc', label: 'NPC 生成器' },
    { path: '/player', label: '玩家角色' },
    { path: '/dialogue', label: '对话样本' },
    { path: '/extra', label: '额外需求' },
  ]},
  { title: '高级', links: [
    { path: '/mvu', label: 'MVU 变量系统' },
    { path: '/regex', label: '正则脚本' },
    { path: '/script', label: '酒馆助手脚本' },
    { path: '/ejs', label: 'EJS 模板' },
    { path: '/statusbar', label: '前端状态栏' },
  ]},
  { title: '工具', links: [
    { path: '/assistant', label: 'AI 助手' },
    { path: '/stats', label: '卡片统计' },
  ]},
  { title: '设置', links: [
    { path: '/api', label: 'API 设置' },
    { action: 'errorLog', label: '错误日志' },
  ]},
];
const navLinks = navSections.flatMap(s => s.links);

async function importCard() {
  sidebarOpen.value = false;
  await cardStore.importFromFile();
}

function exportCard() {
  sidebarOpen.value = false;
  cardStore.exportPng();
}

function exportJson() {
  sidebarOpen.value = false;
  cardStore.exportJson();
}

function newCard() {
  sidebarOpen.value = false;
  if (confirm('新建空卡会丢失当前未保存的内容，确认？')) {
    cardStore.newCard();
    appStore.toastSuccess('已创建新的空白角色卡');
  }
}
</script>

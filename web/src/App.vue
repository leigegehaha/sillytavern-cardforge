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
        <button class="sidebar__btn" @click="importFromWorldbook">以世界书生成卡</button>
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

    <!-- 全局浮动工具集（AI 助手 / 诊断页隐藏） -->
    <FloatingTools v-if="$route.path !== '/assistant' && $route.path !== '/diagnostic'" />

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

    <!-- 多选项弹窗（三按钮及以上） -->
    <div v-if="appStore.chooseVisible" class="cf-confirm-overlay" @click.self="appStore.chooseResolve(null)">
      <div class="cf-confirm-dialog">
        <div class="cf-confirm-msg">{{ appStore.chooseMessage }}</div>
        <div class="cf-confirm-btns">
          <button v-for="opt in appStore.chooseOptions" :key="opt.value"
            class="btn" :class="opt.cls || 'btn--secondary'"
            @click="appStore.chooseResolve(opt.value)">
            {{ opt.label }}
          </button>
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
import { ref, onMounted } from 'vue';
import { useCardStore } from './stores/card.js';
import { useAppStore } from './stores/app.js';
import ErrorLogModal from './components/ErrorLogModal.vue';
import FloatingTools from './components/FloatingTools.vue';
import { parseStWorldbookEntries } from './utils/st-worldbook-import.js';

const cardStore = useCardStore();
const appStore = useAppStore();
const sidebarOpen = ref(false);
const showErrorLog = ref(false);

onMounted(() => {
  // Check for auto-saved card data
  if (cardStore.hasAutosave()) {
    appStore.confirmAction(
      '检测到上次未保存的编辑内容，是否恢复？',
      () => {
        if (cardStore.restoreAutosave()) {
          appStore.toastSuccess('已恢复上次的编辑内容');
        }
      },
      () => {
        cardStore.clearAutosave();
      }
    );
  }
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
    { path: '/novel-extract', label: '小说转世界书' },
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
    { path: '/diagnostic', label: '角色卡诊断' },
    { path: '/sandbox', label: '状态栏沙盒' },
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

async function importFromWorldbook() {
  sidebarOpen.value = false;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rawJson = JSON.parse(text);
      const { entries, unsupportedPosition } = parseStWorldbookEntries(rawJson);
      if (entries.length === 0) {
        appStore.toastWarning('未在 JSON 中找到有效世界书条目');
        return;
      }
      cardStore.newCard();
      const fileName = file.name.replace(/\.json$/i, '');
      cardStore.cardData.character_book.name = fileName;
      cardStore.cardData.character_book.entries = entries;
      cardStore.markDirty();

      let msg = `已用世界书生成空白卡：${entries.length} 条条目`;
      if (unsupportedPosition > 0) {
        msg += `（${unsupportedPosition} 条 position 类型不支持，已转为 after_char）`;
      }
      appStore.toastSuccess(msg);
      setTimeout(() => {
        appStore.toastInfo('请在编辑器里填写角色名 / 描述 / 开场白');
      }, 1500);
    } catch (err) {
      appStore.toastError(`导入失败: ${err.message}`);
    }
  };
  input.click();
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

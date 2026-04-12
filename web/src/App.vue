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
          <router-link v-for="link in section.links" :key="link.path"
            :to="link.path" class="sidebar__link"
            :class="{ active: $route.path === link.path }"
            @click="sidebarOpen = false">
            {{ link.label }}
          </router-link>
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
      <router-view />
    </main>

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
import { ref } from 'vue';
import { useCardStore } from './stores/card.js';
import { useAppStore } from './stores/app.js';

const cardStore = useCardStore();
const appStore = useAppStore();
const sidebarOpen = ref(false);

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

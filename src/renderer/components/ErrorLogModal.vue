<template>
  <div v-if="visible" class="cf-confirm-overlay" @click.self="close">
    <div class="cf-log-dialog">
      <div class="cf-log-header">
        <div class="cf-log-title">错误日志 <span class="cf-log-count">({{ entries.length }})</span></div>
        <button class="cf-log-close" @click="close">x</button>
      </div>

      <div class="cf-log-toolbar">
        <input class="input cf-log-search" v-model="filter" placeholder="过滤关键字（类型/消息/来源）" />
        <button class="btn btn--secondary btn--sm" @click="reload" :disabled="loading">{{ loading ? '...' : '刷新' }}</button>
        <button class="btn btn--secondary btn--sm" @click="copyAll" :disabled="!entries.length">复制全部</button>
        <button class="btn btn--secondary btn--sm" @click="exportTxt" :disabled="!entries.length">导出 txt</button>
        <button class="btn btn--secondary btn--sm" @click="openFolder">打开文件夹</button>
        <button class="btn btn--danger btn--sm" @click="confirmClear" :disabled="!entries.length">清空</button>
      </div>

      <div v-if="logDir" class="cf-log-path">日志位置：{{ logDir }}</div>

      <div class="cf-log-list">
        <div v-if="!filteredEntries.length" class="cf-log-empty">
          {{ entries.length === 0 ? '暂无错误日志' : '没有匹配的日志' }}
        </div>
        <div v-for="(e, i) in filteredEntries" :key="i" class="cf-log-item" :class="'cf-log-item--' + e.source">
          <div class="cf-log-item-head">
            <span class="cf-log-time">{{ formatTime(e.time) }}</span>
            <span class="cf-log-source">{{ e.source }}</span>
            <span class="cf-log-type">{{ e.type }}</span>
          </div>
          <div class="cf-log-msg">{{ e.message }}</div>
          <pre v-if="e.stack" class="cf-log-stack">{{ e.stack }}</pre>
          <div v-if="e.extra" class="cf-log-extra">{{ formatExtra(e.extra) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '../stores/app.js';
import errorLogger from '../utils/error-logger.js';

const props = defineProps({
  visible: { type: Boolean, default: false }
});
const emit = defineEmits(['close']);

const appStore = useAppStore();
const entries = ref([]);
const logDir = ref('');
const filter = ref('');
const loading = ref(false);

const filteredEntries = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return entries.value;
  return entries.value.filter(e =>
    (e.message || '').toLowerCase().includes(q) ||
    (e.type || '').toLowerCase().includes(q) ||
    (e.source || '').toLowerCase().includes(q) ||
    (e.stack || '').toLowerCase().includes(q)
  );
});

watch(() => props.visible, (v) => { if (v) reload(); });

async function reload() {
  loading.value = true;
  try {
    const res = await window.cardForgeAPI.readErrorLog();
    if (res && res.success) {
      const fileEntries = res.entries || [];
      // 合并 buffer 中尚未刷盘的内容（极小概率重复，但宁可重复也别漏）
      const buffer = errorLogger.getBuffer();
      const all = [...fileEntries, ...buffer];
      // 按时间倒序去重（time + message 作为 key）
      const seen = new Set();
      const dedup = [];
      for (const e of all.sort((a, b) => (b.time || '').localeCompare(a.time || ''))) {
        const k = (e.time || '') + '|' + (e.message || '');
        if (seen.has(k)) continue;
        seen.add(k);
        dedup.push(e);
      }
      entries.value = dedup;
      logDir.value = res.dir || '';
    } else {
      appStore.toastError('读取日志失败：' + (res?.error || '未知错误'));
    }
  } catch (e) {
    appStore.toastError('读取日志失败：' + e.message);
  } finally {
    loading.value = false;
  }
}

function close() { emit('close'); }

function formatTime(t) {
  if (!t) return '-';
  try {
    const d = new Date(t);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch (e) { return t; }
}

function formatExtra(extra) {
  try { return typeof extra === 'string' ? extra : JSON.stringify(extra); }
  catch (e) { return String(extra); }
}

function buildText() {
  return filteredEntries.value.map(e => {
    let s = `[${formatTime(e.time)}] [${e.source}] [${e.type}] ${e.message}`;
    if (e.stack) s += '\n' + e.stack;
    if (e.extra) s += '\n  extra: ' + formatExtra(e.extra);
    return s;
  }).join('\n\n');
}

async function copyAll() {
  try {
    await navigator.clipboard.writeText(buildText());
    appStore.toastSuccess('已复制到剪贴板');
  } catch (e) {
    appStore.toastError('复制失败：' + e.message);
  }
}

function openFolder() {
  try {
    window.cardForgeAPI.openLogFolder();
  } catch (e) {
    appStore.toastError('打开文件夹失败：' + e.message);
  }
}

async function exportTxt() {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `cardforge-error-log-${ts}.txt`;
    const filePath = await window.cardForgeAPI.saveFile({
      defaultPath: defaultName,
      filters: [{ name: '文本文件', extensions: ['txt'] }]
    });
    if (!filePath) return;
    const res = await window.cardForgeAPI.writeFile(filePath, buildText(), 'utf-8');
    if (res && res.success) {
      appStore.toastSuccess('已导出：' + filePath);
    } else {
      appStore.toastError('导出失败：' + (res?.error || '未知错误'));
    }
  } catch (e) {
    appStore.toastError('导出失败：' + e.message);
  }
}

function confirmClear() {
  appStore.confirmAction('确定要清空所有错误日志吗？这会同时删除日志文件（不可恢复）', async () => {
    try {
      const res = await window.cardForgeAPI.clearErrorLog();
      if (res && res.success) {
        errorLogger.clearBuffer();
        entries.value = [];
        appStore.toastSuccess('日志已清空');
      } else {
        appStore.toastError('清空失败：' + (res?.error || '未知错误'));
      }
    } catch (e) {
      appStore.toastError('清空失败：' + e.message);
    }
  });
}
</script>

<style lang="scss" scoped>
.cf-log-dialog {
  background: var(--cf-bg-card, #1a1f2e);
  border: 1px solid var(--cf-border, rgba(255,255,255,0.1));
  border-radius: 12px;
  padding: 16px;
  width: 90vw;
  max-width: 1000px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.cf-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.cf-log-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--cf-text-primary, #e6edf3);
}
.cf-log-count {
  font-size: 13px;
  color: var(--cf-text-muted, #8b95a7);
  font-weight: normal;
}
.cf-log-close {
  background: transparent;
  border: 1px solid var(--cf-border);
  color: var(--cf-text-primary);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.08); }
}
.cf-log-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.cf-log-search {
  flex: 1;
  min-width: 0;
}
.cf-log-path {
  font-size: 11px;
  color: var(--cf-text-muted);
  margin-bottom: 8px;
  word-break: break-all;
}
.cf-log-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--cf-border, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 8px;
  background: rgba(0,0,0,0.2);
}
.cf-log-empty {
  text-align: center;
  color: var(--cf-text-muted);
  padding: 40px 20px;
  font-size: 13px;
}
.cf-log-item {
  border: 1px solid rgba(255,255,255,0.06);
  border-left: 3px solid #f87171;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: rgba(255,255,255,0.02);
}
.cf-log-item--main { border-left-color: #fbbf24; }
.cf-log-item--renderer { border-left-color: #f87171; }
.cf-log-item--unknown { border-left-color: #94a3b8; }
.cf-log-item-head {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--cf-text-muted);
  margin-bottom: 4px;
}
.cf-log-time { color: var(--cf-text-muted); }
.cf-log-source {
  background: rgba(255,255,255,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
}
.cf-log-type {
  background: rgba(248,113,113,0.15);
  color: #fca5a5;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
}
.cf-log-msg {
  font-size: 13px;
  color: var(--cf-text-primary, #e6edf3);
  word-break: break-word;
  white-space: pre-wrap;
}
.cf-log-stack {
  margin-top: 6px;
  padding: 6px 8px;
  background: rgba(0,0,0,0.4);
  border-radius: 4px;
  font-size: 11px;
  color: var(--cf-text-muted, #94a3b8);
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
.cf-log-extra {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cf-text-muted);
  font-family: monospace;
  word-break: break-all;
}
</style>

<template>
  <div class="page">
    <div class="page__header">
      <h1>打包角色卡</h1>
      <p>上传封面图片，导出为 PNG 角色卡或 JSON 文件</p>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        做完所有设定后在这里导出你的角色卡：<br>
        · <strong>PNG 格式</strong>（推荐）— 角色数据嵌入在图片里，发图片就能分享，对方导入就能用<br>
        · <strong>JSON 格式</strong> — 纯数据文件，适合开发调试和备份<br>
        · 导出 PNG 需要先上传一张封面图片（角色头像）
      </div>
    </div>

    <!-- 封面图片 -->
    <div class="card mb-md">
      <div class="card__header"><h3>封面图片</h3></div>
      <div class="card__body">
        <div class="cover-area" @click="selectCover">
          <div v-if="coverPreview" class="cover-preview">
            <img :src="coverPreview" alt="封面预览">
            <div class="cover-overlay">点击更换</div>
          </div>
          <div v-else class="cover-placeholder">
            <div style="font-size:48px;margin-bottom:12px"></div>
            <div style="font-size:14px">点击上传封面图片</div>
            <div class="hint mt-md">支持 PNG / JPG / WEBP</div>
          </div>
        </div>
        <div class="hint mt-md" v-if="store.coverImagePath">
          当前图片：{{ store.coverImagePath }}
        </div>
      </div>
    </div>

    <!-- 角色卡概览 -->
    <div class="card mb-md">
      <div class="card__header"><h3>角色卡概览</h3></div>
      <div class="card__body">
        <div class="form-row">
          <div class="pack-stat">
            <div class="pack-stat__label">角色名</div>
            <div class="pack-stat__value">{{ store.cardName }}</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">世界书条目</div>
            <div class="pack-stat__value">{{ s.totalEntries }} 条</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">正则脚本</div>
            <div class="pack-stat__value">{{ s.regexCount }} 个</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">酒馆助手脚本</div>
            <div class="pack-stat__value">{{ s.scriptCount }} 个</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">备选开场白</div>
            <div class="pack-stat__value">{{ s.alternateGreetings }} 个</div>
          </div>
          <div class="pack-stat">
            <div class="pack-stat__label">预估 Token</div>
            <div class="pack-stat__value">~{{ s.estimatedTokens.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 健康检查（仅参考，不阻止导出） -->
    <div class="card mb-md" v-if="healthIssues.length > 0">
      <div class="card__header flex-between">
        <h3>导出前检查</h3>
        <span class="badge badge--info">仅供参考 · 不阻止导出</span>
      </div>
      <div class="card__body">
        <div class="hint mb-md">以下是发现的潜在问题，可以忽略后继续导出：</div>
        <div v-for="(issue, i) in healthIssues" :key="i" style="margin-bottom:6px;font-size:13px">
          <span class="badge badge--info" style="margin-right:8px">提示</span>
          {{ issue.msg }}
        </div>
      </div>
    </div>

    <!-- 覆盖原文件保存（仅当从外部 PNG 导入时显示） -->
    <div v-if="canQuickSave" class="card mb-md quick-save-card">
      <div class="card__header"><h3>快速保存</h3></div>
      <div class="card__body">
        <p class="hint mb-md">
          检测到这张卡是从外部导入的 PNG 文件。修改完后可以直接覆盖原文件，无需重新选择保存位置。<br>
          原文件路径：<code style="font-size:11px">{{ store.filePath }}</code>
        </p>
        <button class="btn btn--primary" style="width:100%" @click="quickSaveOriginal">
          覆盖原文件保存
        </button>
      </div>
    </div>

    <!-- 导出按钮 -->
    <div class="card">
      <div class="card__header"><h3>导出（另存为）</h3></div>
      <div class="card__body">
        <div class="form-row">
          <div class="export-option" @click="exportPng">
            <div style="font-size:32px;margin-bottom:8px"></div>
            <strong>导出为 PNG 角色卡</strong>
            <p class="hint">将角色数据嵌入封面图片中，标准的角色卡分享格式</p>
            <span class="badge badge--warning mt-md" v-if="!store.coverImagePath">需要先上传封面</span>
          </div>
          <div class="export-option" @click="exportJson">
            <div style="font-size:32px;margin-bottom:8px"></div>
            <strong>导出为 JSON 文件</strong>
            <p class="hint">纯数据格式，适合开发调试和备份</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const store = useCardStore();
const appStore = useAppStore();
const api = window.cardForgeAPI;

const s = computed(() => store.stats);

// 是否可以快速保存（从外部 PNG 导入的卡）
const canQuickSave = computed(() => {
  return store.filePath &&
         store.filePath.toLowerCase().endsWith('.png') &&
         store.coverImagePath;
});

async function quickSaveOriginal() {
  if (!store.filePath) { appStore.toastError('未检测到原文件路径'); return; }
  try {
    const json = store.exportJson();
    const result = await api.embedCharaData(store.coverImagePath, json, store.filePath);
    if (!result.success) throw new Error(result.error);
    store.isDirty = false;
    appStore.toastSuccess('已保存到原文件：' + store.filePath);
  } catch (e) {
    appStore.toastError('保存失败：' + e.message);
  }
}

const healthIssues = computed(() => {
  const issues = [];
  const d = store.cardData;
  if (!d.name) issues.push({ level: 'danger', msg: '角色名称为空（必填）' });
  if (!d.first_mes) issues.push({ level: 'danger', msg: '开场白为空（必填）' });
  if (s.value.scriptCount > 0 && s.value.regexCount === 0) issues.push({ level: 'warning', msg: '有酒馆助手脚本但没有正则脚本，可能缺少变量折叠/清理正则' });
  if (s.value.regexCount > 0 && s.value.totalEntries === 0) issues.push({ level: 'warning', msg: '有正则脚本但没有世界书条目' });
  if (s.value.scriptCount > 0 && !d.creator_notes?.includes('酒馆助手')) {
    issues.push({ level: 'warning', msg: '使用了脚本但 creator_notes 未提醒玩家安装酒馆助手插件' });
  }
  const hasStatusPlaceholder = (d.first_mes || '').includes('StatusPlaceHolderImpl');
  const hasStatusRegex = (d.extensions?.regex_scripts || []).some(r => r.replaceString?.includes('StatusPlaceHolderImpl') || r.findRegex?.includes('StatusPlaceHolderImpl'));
  if (hasStatusRegex && !hasStatusPlaceholder) issues.push({ level: 'warning', msg: '有状态栏正则但开场白缺少 <StatusPlaceHolderImpl/> 占位符' });
  if (!d.description && s.value.totalEntries === 0) issues.push({ level: 'warning', msg: 'description 和世界书都是空的，AI 不知道要扮演什么角色' });
  return issues;
});
const coverPreview = ref(null);

onMounted(async () => {
  if (store.coverImagePath) {
    await loadCoverPreview(store.coverImagePath);
  }
});

async function loadCoverPreview(path) {
  try {
    const result = await api.readFile(path);
    if (result.success) {
      const ext = path.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      coverPreview.value = `data:${mime};base64,${result.data}`;
    }
  } catch (e) {}
}

async function selectCover() {
  const path = await api.openImage();
  if (path) {
    store.coverImagePath = path;
    await loadCoverPreview(path);
    appStore.toastSuccess('封面图片已设置');
  }
}

async function exportPng() {
  if (!store.coverImagePath) {
    await selectCover();
    if (!store.coverImagePath) return;
  }

  const name = store.cardData.name || 'character';
  const savePath = await api.saveFile({
    defaultPath: name + '.png',
    filters: [{ name: 'PNG 角色卡', extensions: ['png'] }]
  });
  if (!savePath) return;

  try {
    const json = store.exportJson();
    const result = await api.embedCharaData(store.coverImagePath, json, savePath);
    if (!result.success) throw new Error(result.error);
    appStore.toastSuccess('PNG 角色卡导出成功！');
  } catch (e) {
    appStore.toastError(`导出失败: ${e.message}`);
  }
}

async function exportJson() {
  const name = store.cardData.name || 'character';
  const savePath = await api.saveFile({
    defaultPath: name + '.json',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (!savePath) return;

  try {
    const json = store.exportJson();
    await api.writeFile(savePath, JSON.stringify(json, null, 2));
    appStore.toastSuccess('JSON 导出成功！');
  } catch (e) {
    appStore.toastError(`导出失败: ${e.message}`);
  }
}
</script>

<style scoped>
.cover-area {
  width: 280px;
  height: 360px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--cf-radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--cf-transition);
  overflow: hidden;
  position: relative;
}
.cover-area:hover {
  border-color: rgba(0, 229, 255, 0.4);
}
.cover-preview {
  width: 100%;
  height: 100%;
  position: relative;
}
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  opacity: 0;
  transition: var(--cf-transition);
}
.cover-area:hover .cover-overlay { opacity: 1; }

.cover-placeholder {
  text-align: center;
  color: var(--cf-text-muted);
}

.pack-stat {
  padding: 8px 0;
}
.pack-stat__label {
  font-size: 11px;
  color: var(--cf-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 2px;
}
.pack-stat__value {
  font-size: 15px;
  font-weight: 600;
}

.export-option {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-md);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: var(--cf-transition);
}
.export-option:hover {
  border-color: rgba(0, 229, 255, 0.3);
  transform: translateY(-2px);
}
.quick-save-card {
  border: 1px solid rgba(255, 215, 0, 0.3);
  background: rgba(255, 215, 0, 0.04);
}
.quick-save-card code {
  background: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--cf-text-primary);
}
</style>

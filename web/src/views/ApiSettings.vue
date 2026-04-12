<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>API 设置</h1>
        <p>配置 AI 服务商，用于世界书生成、NPC 生成等 AI 辅助功能</p>
      </div>
      <button class="btn btn--accent" @click="addProvider">+ 添加服务商</button>
    </div>

    <!-- 当前状态 -->
    <div class="card mb-md">
      <div class="card__body">
        <div v-if="apiStore.isConfigured" class="hint" style="color: var(--cf-success)">
          当前使用: {{ apiStore.activeProvider.name }} ({{ apiStore.activeProvider.model }})
        </div>
        <div v-else class="hint" style="color: var(--cf-warning)">
          未配置任何 API Key，AI 辅助功能不可用
        </div>
      </div>
    </div>

    <!-- 服务商列表 -->
    <div v-for="p in apiStore.providers" :key="p.id" class="card mb-md">
      <div class="card__header flex-between">
        <div class="flex-row">
          <label class="toggle-label">
            <input type="radio" :checked="apiStore.activeProviderId === p.id"
              @change="apiStore.setActiveProvider(p.id)">
            <span style="font-weight: 600">{{ p.name }}</span>
          </label>
          <span v-if="apiStore.activeProviderId === p.id" class="badge badge--accent">当前</span>
        </div>
        <button class="btn btn--danger btn--sm" @click="removeProvider(p.id)">删除</button>
      </div>
      <div class="card__body">
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>名称</label>
            <input class="input" v-model="p.name">
          </div>
          <div class="form-group" style="flex:1">
            <label>类型</label>
            <select class="select" v-model="p.type">
              <option value="openai">OpenAI 兼容</option>
              <option value="claude">Claude (Anthropic)</option>
              <option value="gemini">Gemini (Google)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input class="input" v-model="p.apiKey" type="password" placeholder="填入你的 API Key">
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>Base URL</label>
            <input class="input" v-model="p.baseUrl" placeholder="API 地址">
          </div>
          <div class="form-group" style="flex:1">
            <label>模型</label>
            <div class="flex-row">
              <select v-if="modelLists[p.id]?.length" class="select flex-1" v-model="p.model">
                <option value="">-- 选择模型 --</option>
                <option v-for="m in modelLists[p.id]" :key="m" :value="m">{{ m }}</option>
              </select>
              <input v-else class="input flex-1" v-model="p.model" placeholder="填入Key后点获取">
              <button class="btn btn--sm" @click="loadModels(p)" :disabled="modelLoading[p.id] || !p.apiKey">
                {{ modelLoading[p.id] ? '...' : '获取' }}
              </button>
            </div>
          </div>
        </div>
        <div class="flex-row">
          <label class="toggle-label">
            <input type="checkbox" v-model="p.enabled"> 启用
          </label>
          <button class="btn btn--sm" @click="testConnection(p)">
            {{ testing === p.id ? '测试中...' : '测试连接' }}
          </button>
        </div>
      </div>
    </div>

    <div class="hint">
      设置会自动保存到浏览器本地存储中，刷新页面不会丢失。API Key 不会上传到任何服务器。
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';

const apiStore = useApiStore();
const appStore = useAppStore();
const testing = ref(null);
const modelLists = reactive({});
const modelLoading = reactive({});

async function loadModels(provider) {
  if (!provider.apiKey) { appStore.toastWarning('请先填写 API Key'); return; }
  if (!provider.baseUrl) { appStore.toastWarning('请先填写 Base URL'); return; }
  modelLoading[provider.id] = true;
  try {
    const models = await apiStore.fetchModels(provider);
    if (models.length > 0) {
      modelLists[provider.id] = models;
      if (!provider.model || !models.includes(provider.model)) {
        provider.model = models[0];
      }
      appStore.toastSuccess(`获取到 ${models.length} 个模型`);
    } else {
      appStore.toastWarning('未获取到模型列表，请检查 Key 和 Base URL');
    }
  } catch (e) {
    appStore.toastError('获取模型失败: ' + e.message);
  } finally { modelLoading[provider.id] = false; }
}

function addProvider() {
  apiStore.addProvider();
}

function removeProvider(id) {
  appStore.confirmAction('确认删除这个服务商？', () => {
    apiStore.removeProvider(id);
  });
}

async function testConnection(provider) {
  if (testing.value) return;
  if (!provider.apiKey) {
    appStore.toastWarning('请先填写 API Key');
    return;
  }
  testing.value = provider.id;
  try {
    const result = await apiStore.chatWithProvider(provider, [
      { role: 'user', content: '请回复"连接成功"四个字。' }
    ], { temperature: 0, maxTokens: 50 });
    appStore.toastSuccess(`${provider.name} 连接成功: ${(result || '').slice(0, 30)}`);
  } catch (e) {
    appStore.toastError(`${provider.name} 连接失败: ${e.message}`);
  } finally {
    testing.value = null;
  }
}
</script>

<style scoped>
.form-row {
  display: flex;
  gap: 12px;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>

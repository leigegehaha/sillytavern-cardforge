import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useApiStore } from './api.js';
import { buildCardContext } from '../utils/card-context.js';

const STORAGE_KEY = 'cardforge_image_gen_settings';
const MAX_IMAGES = 20;

export const useImageGenStore = defineStore('imageGen', () => {
  const providers = ref([]);
  const activeProviderId = ref(null);

  const activeProvider = computed(() => {
    if (activeProviderId.value) {
      const p = providers.value.find(p => p.id === activeProviderId.value);
      if (p && p.apiKey) return p;
    }
    return providers.value.find(p => p.enabled && p.apiKey);
  });

  const isConfigured = computed(() => !!activeProvider.value);

  function initDefaults() {
    if (providers.value.length === 0) {
      providers.value = [{
        id: 'tavern-image',
        name: '酒馆图片生成',
        type: 'openai-image',
        baseUrl: '/v1',
        apiKey: '',
        model: 'gpt-image-2',
        size: '1024x1536',
        enabled: true
      }];
    }
  }

  const STORAGE_LOADED_KEY = STORAGE_KEY;
  let _loaded = false;
  let _saveTimer = null;

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.providers) providers.value = data.providers;
        if (data.activeProviderId) activeProviderId.value = data.activeProviderId;
      }
    } catch (e) {}
    initDefaults();
    _loaded = true;
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        providers: JSON.parse(JSON.stringify(providers.value)),
        activeProviderId: activeProviderId.value
      }));
    } catch (e) {}
  }

  function scheduleSave() {
    if (!_loaded) return;
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => { saveToStorage(); _saveTimer = null; }, 300);
  }

  watch(providers, scheduleSave, { deep: true });
  watch(activeProviderId, scheduleSave);

  loadFromStorage();

  function setActiveProvider(id) {
    activeProviderId.value = id;
  }

  function addProvider() {
    const id = 'custom_img_' + Date.now();
    providers.value.push({
      id,
      name: '自定义图片生成',
      type: 'openai-image',
      baseUrl: '/v1',
      apiKey: '',
      model: 'gpt-image-2',
      size: '1024x1536',
      enabled: true
    });
    return id;
  }

  function removeProvider(id) {
    const idx = providers.value.findIndex(p => p.id === id);
    if (idx !== -1) providers.value.splice(idx, 1);
    if (activeProviderId.value === id) activeProviderId.value = null;
  }

  // 登录后自动配置酒馆图片 provider
  function applyTavernImageProvider(api) {
    const idx = providers.value.findIndex(p => p.id === 'tavern-image');
    const provider = {
      id: 'tavern-image',
      name: '酒馆图片生成',
      type: 'openai-image',
      baseUrl: '/v1',
      apiKey: api.key,
      model: api.model || 'gpt-image-2',
      size: '1024x1536',
      enabled: true
    };
    if (idx >= 0) providers.value[idx] = provider;
    else providers.value.push(provider);
    activeProviderId.value = 'tavern-image';
  }

  function removeTavernImageProvider() {
    const idx = providers.value.findIndex(p => p.id === 'tavern-image');
    if (idx >= 0) providers.value.splice(idx, 1);
    if (activeProviderId.value === 'tavern-image') activeProviderId.value = null;
  }

  // 生成图片：POST {baseUrl}/images/generations
  async function generateImage(prompt) {
    const p = activeProvider.value;
    if (!p || !p.apiKey) {
      throw new Error('请先配置图片生成模型');
    }
    const baseUrl = (p.baseUrl || '').replace(/\/+$/, '');
    const body = {
      model: p.model,
      prompt,
      n: 1,
      size: p.size || '1024x1536'
    };
    const resp = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${p.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`图片生成失败 (${resp.status}): ${errText.slice(0, 200)}`);
    }
    const data = await resp.json();
    const item = data.data?.[0];
    if (!item) throw new Error('图片生成返回为空');
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item.url) return item.url;
    throw new Error('图片生成返回格式异常');
  }

  // 用文本 provider 生成中英文提示词
  async function genPromptFromCard(cardStore) {
    const apiStore = useApiStore();
    if (!apiStore.isConfigured) {
      throw new Error('请先在 API 设置配置文本模型');
    }
    const ctx = buildCardContext(cardStore, '');
    const systemPrompt = `你是角色卡封面图提示词专家。根据角色信息生成一张角色封面图的提示词。封面图比例固定为 3:4 竖图。

输出严格的 JSON（不要 markdown 代码块，不要多余文字）：
{"chinese":"中文提示词","english":"English prompt"}

提示词要包含：人物外貌特征、服装、表情、姿态、场景背景、光影氛围、画风（二次元/写实/水彩等）、构图。英文提示词用于调用图片生成模型，要详细具体。`;

    const userPrompt = `${ctx}\n\n请根据以上角色信息生成封面图提示词。`;

    const result = await apiStore.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.8, maxTokens: 1200 });

    // 解析 JSON（容错：提取第一个 {...}）
    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch (e) {
      const m = result.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (e2) {}
      }
    }
    if (!parsed || !parsed.chinese) {
      // 解析失败，整段当中文提示词
      return { chinese: result.trim(), english: result.trim() };
    }
    return {
      chinese: parsed.chinese,
      english: parsed.english || parsed.chinese
    };
  }

  // 中文 -> 英文翻译
  async function translatePrompt(chinese) {
    const apiStore = useApiStore();
    if (!apiStore.isConfigured) {
      throw new Error('请先配置文本模型');
    }
    const result = await apiStore.chat([
      { role: 'system', content: '你把用户给的中文图片提示词翻译成英文，用于 AI 图片生成模型。只输出英文提示词，不要任何解释或额外文字。' },
      { role: 'user', content: chinese }
    ], { temperature: 0.3, maxTokens: 800 });
    return result.trim();
  }

  return {
    providers, activeProviderId, activeProvider, isConfigured,
    generateImage, genPromptFromCard, translatePrompt,
    setActiveProvider, addProvider, removeProvider,
    applyTavernImageProvider, removeTavernImageProvider,
    MAX_IMAGES
  };
});

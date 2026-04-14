import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export const useApiStore = defineStore('api', () => {
  // State
  const providers = ref([]);
  const activeProviderId = ref(null);

  // Create default providers
  function initDefaults() {
    if (providers.value.length === 0) {
      providers.value = [
        {
          id: 'openai',
          name: 'OpenAI 兼容',
          type: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o',
          enabled: true
        },
        {
          id: 'claude',
          name: 'Claude (Anthropic)',
          type: 'claude',
          baseUrl: 'https://api.anthropic.com',
          apiKey: '',
          model: 'claude-sonnet-4-20250514',
          enabled: false
        },
        {
          id: 'gemini',
          name: 'Gemini (Google)',
          type: 'gemini',
          baseUrl: 'https://generativelanguage.googleapis.com',
          apiKey: '',
          model: 'gemini-2.0-flash',
          enabled: false
        }
      ];
    }
  }

  const activeProvider = computed(() => {
    if (activeProviderId.value) {
      const p = providers.value.find(p => p.id === activeProviderId.value);
      // 主动选的就用，即使没启用也用（用户意图优先）
      if (p && p.apiKey) return p;
    }
    // fallback：第一个启用且有 key 的
    return providers.value.find(p => p.enabled && p.apiKey);
  });

  const isConfigured = computed(() => {
    return !!activeProvider.value;
  });

  // AI API call
  async function chat(messages, options = {}) {
    const provider = activeProvider.value;
    if (!provider || !provider.apiKey) {
      throw new Error('请先在 API 设置中配置至少一个 AI 服务商的 API Key');
    }
    return _callProvider(provider, messages, options);
  }

  // 用指定 provider 直接调用，不污染 store（用于 AI 娘自带 API 配置等场景）
  async function chatWithProvider(provider, messages, options = {}) {
    if (!provider || !provider.apiKey) {
      throw new Error('provider 缺少 apiKey');
    }
    return _callProvider(provider, messages, options);
  }

  function getModelMaxTokens(model) {
    const m = (model || '').toLowerCase();
    // Claude
    if (m.includes('opus') || m.includes('sonnet-4') || m.includes('claude-4')) return 16384;
    if (m.includes('claude-3-5') || m.includes('claude-3.5')) return 8192;
    if (m.includes('claude')) return 4096;
    // OpenAI
    if (m.includes('gpt-4o') || m.includes('gpt-4-turbo') || m.includes('o1') || m.includes('o3') || m.includes('o4')) return 16384;
    if (m.includes('gpt-4')) return 8192;
    if (m.includes('gpt-3.5')) return 4096;
    // Gemini
    if (m.includes('gemini-2') || m.includes('gemini-1.5-pro')) return 8192;
    if (m.includes('gemini')) return 8192;
    // DeepSeek / Qwen 等中转常见模型
    if (m.includes('deepseek')) return 8192;
    if (m.includes('qwen')) return 8192;
    return 4096;
  }

  async function _callProvider(provider, messages, options) {
    const temperature = options.temperature ?? 0.8;
    const modelMax = getModelMaxTokens(provider.model);
    const maxTokens = Math.min(options.maxTokens ?? 4096, modelMax);

    if (provider.type === 'openai') {
      return callOpenAI(provider, messages, temperature, maxTokens);
    } else if (provider.type === 'claude') {
      return callClaude(provider, messages, temperature, maxTokens);
    } else if (provider.type === 'gemini') {
      return callGemini(provider, messages, temperature, maxTokens);
    }
    throw new Error(`不支持的 API 类型: ${provider.type}`);
  }

  async function callOpenAI(provider, messages, temperature, maxTokens) {
    const baseUrl = (provider.baseUrl || '').replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API 错误 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenAI 返回数据异常：' + JSON.stringify(data).slice(0, 200));
    }
    return content;
  }

  async function callClaude(provider, messages, temperature, maxTokens) {
    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: provider.model,
      max_tokens: maxTokens,
      temperature,
      messages: userMessages.map(m => ({ role: m.role, content: m.content }))
    };
    if (systemMsg) body.system = systemMsg.content;

    const baseUrl = (provider.baseUrl || '').replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API 错误 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Claude 返回数据异常：' + JSON.stringify(data).slice(0, 200));
    }
    return text;
  }

  async function callGemini(provider, messages, temperature, maxTokens) {
    // Convert messages to Gemini format
    const contents = [];
    let systemInstruction = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    const body = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const baseUrl = (provider.baseUrl || '').replace(/\/+$/, '');
    // 用 header 传 API Key（避免出现在 URL 里被日志/历史记录捕获）
    const url = `${baseUrl}/v1beta/models/${provider.model}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': provider.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API 错误 (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Gemini 返回数据异常：' + JSON.stringify(data).slice(0, 200));
    }
    return text;
  }

  // localStorage 持久化
  const STORAGE_KEY = 'cardforge_api_settings';
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

  // 初始化时自动加载
  loadFromStorage();

  // 兼容旧接口名
  async function loadFromDisk() { loadFromStorage(); }
  async function saveToDisk() { saveToStorage(); }

  // 设置当前激活服务商
  function setActiveProvider(id) {
    activeProviderId.value = id;
  }

  function addProvider() {
    const id = 'custom_' + Date.now();
    providers.value.push({
      id,
      name: '自定义服务',
      type: 'openai',
      baseUrl: '',
      apiKey: '',
      model: '',
      enabled: true
    });
    return id;
  }

  function removeProvider(id) {
    const idx = providers.value.findIndex(p => p.id === id);
    if (idx !== -1) providers.value.splice(idx, 1);
    // 如果删的是当前激活的，清空 activeProviderId
    if (activeProviderId.value === id) activeProviderId.value = null;
  }

  async function fetchModels(provider) {
    if (!provider || !provider.apiKey) return [];
    const baseUrl = (provider.baseUrl || '').replace(/\/+$/, '');
    try {
      if (provider.type === 'openai') {
        const resp = await fetch(`${baseUrl}/models`, {
          headers: { 'Authorization': `Bearer ${provider.apiKey}` }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.data || []).map(m => m.id).sort();
      } else if (provider.type === 'claude') {
        const resp = await fetch(`${baseUrl}/v1/models`, {
          headers: { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
        });
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.data || []).map(m => m.id).sort();
      } else if (provider.type === 'gemini') {
        const resp = await fetch(`${baseUrl}/v1beta/models?key=${provider.apiKey}`);
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.models || []).map(m => m.name.replace('models/', '')).sort();
      }
    } catch (e) {}
    return [];
  }

  return {
    providers, activeProviderId, activeProvider, isConfigured,
    chat, chatWithProvider, getModelMaxTokens, fetchModels, loadFromDisk, saveToDisk, addProvider, removeProvider, initDefaults,
    setActiveProvider
  };
});

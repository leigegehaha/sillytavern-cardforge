import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApiStore } from './api.js';

const STORAGE_KEY = 'cardforge_auth';
const TAVERN_MODEL = 'deepseek-tavern-v2-pro';

export const useAuthStore = defineStore('auth', () => {
  // user = { id, username, display_name, group, balance_usd }
  const user = ref(null);
  const apiKey = ref('');

  const isLoggedIn = computed(() => !!apiKey.value);

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: user.value,
        apiKey: apiKey.value
      }));
    } catch (e) {}
  }

  function clear() {
    user.value = null;
    apiKey.value = '';
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // data = { success, user, api: { endpoint, model, key } }
  function applyAuth(data) {
    user.value = data.user;
    apiKey.value = data.api.key;
    persist();
    const apiStore = useApiStore();
    apiStore.applyTavernProvider(data.api);
  }

  async function login(username, password) {
    const resp = await fetch('/auth.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      throw new Error(data.error || data.message || '登录失败');
    }
    applyAuth(data);
    return data;
  }

  async function register(payload) {
    const resp = await fetch('/auth.php?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      const err = new Error(data.error || data.message || '注册失败');
      err.need_verification = !!data.need_verification;
      throw err;
    }
    applyAuth(data);
    return data;
  }

  async function sendCode(email) {
    const resp = await fetch('/auth.php?action=send_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      throw new Error(data.message || data.error || '发送验证码失败');
    }
    return data;
  }

  async function refreshBalance() {
    if (!apiKey.value) return;
    const resp = await fetch('/auth.php?action=balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: apiKey.value })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      throw new Error(data.error || '查询余额失败');
    }
    if (user.value) {
      user.value = { ...user.value, balance_usd: data.balance.balance_usd };
      persist();
    }
  }

  function logout() {
    const apiStore = useApiStore();
    apiStore.removeTavernProvider();
    clear();
  }

  // 从 localStorage 恢复登录态（同步），并重新注入酒馆 provider
  function restore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.apiKey && data.user) {
        user.value = data.user;
        apiKey.value = data.apiKey;
        const apiStore = useApiStore();
        apiStore.applyTavernProvider({
          key: data.apiKey,
          model: TAVERN_MODEL
        });
      }
    } catch (e) {}
  }

  return {
    user, apiKey, isLoggedIn,
    login, register, sendCode, refreshBalance, logout, restore
  };
});

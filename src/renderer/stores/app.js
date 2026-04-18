import { defineStore } from 'pinia';
import { ref } from 'vue';
import errorLogger from '../utils/error-logger.js';

export const useAppStore = defineStore('app', () => {
  const theme = ref('dark');
  const sidebarCollapsed = ref(false);
  const glowEnabled = ref(true);
  const toasts = ref([]);

  // 自定义确认弹窗状态
  const confirmVisible = ref(false);
  const confirmMessage = ref('');
  let _confirmResolve = null;

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme.value);
    saveTheme();
  }

  function setTheme(t) {
    theme.value = t;
    document.documentElement.setAttribute('data-theme', t);
    saveTheme();
  }

  async function saveTheme() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      settings.theme = theme.value;
      await window.cardForgeAPI.saveSettings(settings);
    } catch (e) {}
  }

  async function loadTheme() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      if (settings.theme) {
        theme.value = settings.theme;
        document.documentElement.setAttribute('data-theme', settings.theme);
      }
      if (settings.glowEnabled === false) {
        glowEnabled.value = false;
        document.body.classList.add('no-glow');
      }
    } catch (e) {}
  }

  function toggleGlow() {
    glowEnabled.value = !glowEnabled.value;
    if (glowEnabled.value) {
      document.body.classList.remove('no-glow');
    } else {
      document.body.classList.add('no-glow');
    }
    saveGlow();
  }

  async function saveGlow() {
    try {
      const settings = await window.cardForgeAPI.loadSettings() || {};
      settings.glowEnabled = glowEnabled.value;
      await window.cardForgeAPI.saveSettings(settings);
    } catch (e) {}
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  // Toast notifications
  let toastId = 0;
  function toast(message, type = 'info', duration = 3000) {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  }

  // 自定义确认弹窗（不用 window.confirm，避免焦点丢失）
  function confirmAction(msg, callback) {
    confirmMessage.value = msg;
    confirmVisible.value = true;
    _confirmResolve = callback;
  }

  function confirmYes() {
    confirmVisible.value = false;
    if (_confirmResolve) {
      _confirmResolve();
      _confirmResolve = null;
    }
  }

  function confirmNo() {
    confirmVisible.value = false;
    _confirmResolve = null;
  }

  function toastSuccess(msg) { toast(msg, 'success'); }
  function toastError(msg) { toast(msg, 'error', 5000); errorLogger.logManual(msg, { level: 'error' }); }
  function toastWarning(msg) { toast(msg, 'warning'); errorLogger.logManual(msg, { level: 'warning' }); }
  function toastInfo(msg) { toast(msg, 'info'); }

  return {
    theme, sidebarCollapsed, glowEnabled, toasts,
    confirmVisible, confirmMessage,
    toggleTheme, setTheme, loadTheme, toggleSidebar, toggleGlow,
    toast, toastSuccess, toastError, toastWarning, toastInfo,
    confirmAction, confirmYes, confirmNo
  };
});

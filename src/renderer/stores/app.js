import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const theme = ref('dark');
  const sidebarCollapsed = ref(false);
  const toasts = ref([]);

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

  // 确认弹窗
  function confirmAction(msg, callback) {
    if (window.confirm(msg)) {
      callback();
    }
  }

  function toastSuccess(msg) { toast(msg, 'success'); }
  function toastError(msg) { toast(msg, 'error', 5000); }
  function toastWarning(msg) { toast(msg, 'warning'); }
  function toastInfo(msg) { toast(msg, 'info'); }

  return {
    theme, sidebarCollapsed, toasts,
    toggleTheme, setTheme, loadTheme, toggleSidebar,
    toast, toastSuccess, toastError, toastWarning, toastInfo, confirmAction
  };
});

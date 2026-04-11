import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const toasts = ref([]);
  let toastId = 0;

  function toast(message, type = 'info', duration = 3000) {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  }

  function toastSuccess(msg) { toast(msg, 'success'); }
  function toastError(msg) { toast(msg, 'error', 5000); }
  function toastWarning(msg) { toast(msg, 'warning'); }
  function toastInfo(msg) { toast(msg, 'info'); }

  function confirmAction(msg, callback) {
    if (window.confirm(msg)) {
      callback();
    }
  }

  return {
    toasts,
    toast, toastSuccess, toastError, toastWarning, toastInfo, confirmAction
  };
});

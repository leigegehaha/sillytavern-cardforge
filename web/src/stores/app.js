import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const toasts = ref([]);
  let toastId = 0;

  // 自定义确认弹窗状态
  const confirmVisible = ref(false);
  const confirmMessage = ref('');
  let _confirmResolve = null;
  let _confirmReject = null;

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

  function confirmAction(msg, callback, onCancel) {
    confirmMessage.value = msg;
    confirmVisible.value = true;
    _confirmResolve = callback;
    _confirmReject = onCancel || null;
  }

  function confirmYes() {
    confirmVisible.value = false;
    if (_confirmResolve) {
      _confirmResolve();
      _confirmResolve = null;
    }
    _confirmReject = null;
  }

  function confirmNo() {
    confirmVisible.value = false;
    if (_confirmReject) {
      _confirmReject();
      _confirmReject = null;
    }
    _confirmResolve = null;
  }

  return {
    toasts, confirmVisible, confirmMessage,
    toast, toastSuccess, toastError, toastWarning, toastInfo,
    confirmAction, confirmYes, confirmNo
  };
});

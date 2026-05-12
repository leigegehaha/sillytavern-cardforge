import { defineStore } from 'pinia';
import { ref } from 'vue';
import errorLogger from '../utils/error-logger.js';

export const useAppStore = defineStore('app', () => {
  const toasts = ref([]);
  let toastId = 0;

  // 自定义确认弹窗状态
  const confirmVisible = ref(false);
  const confirmMessage = ref('');
  let _confirmResolve = null;
  let _confirmReject = null;

  // 多选项弹窗状态（三按钮及以上）
  const chooseVisible = ref(false);
  const chooseMessage = ref('');
  const chooseOptions = ref([]);
  let _chooseResolve = null;

  function toast(message, type = 'info', duration = 3000) {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  }

  function toastSuccess(msg) { toast(msg, 'success'); }
  function toastError(msg) { toast(msg, 'error', 5000); errorLogger.logManual(msg, { level: 'error' }); }
  function toastWarning(msg) { toast(msg, 'warning'); errorLogger.logManual(msg, { level: 'warning' }); }
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

  // 三选项及以上弹窗
  // options 形如 [{ value, label, cls?: 'btn--primary'|'btn--secondary'|'btn--danger'|'btn--ghost' }]
  // 用户点遮罩或取消时 callback 收到 null
  function chooseAction(msg, options, callback) {
    chooseMessage.value = msg;
    chooseOptions.value = options || [];
    chooseVisible.value = true;
    _chooseResolve = callback;
  }

  function chooseResolve(value) {
    chooseVisible.value = false;
    if (_chooseResolve) {
      _chooseResolve(value);
      _chooseResolve = null;
    }
  }

  return {
    toasts, confirmVisible, confirmMessage,
    chooseVisible, chooseMessage, chooseOptions,
    toast, toastSuccess, toastError, toastWarning, toastInfo,
    confirmAction, confirmYes, confirmNo,
    chooseAction, chooseResolve
  };
});

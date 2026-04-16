// 错误日志模块 — 网页版
// 持久化用 localStorage，最多保留 500 条（环形覆盖最旧的）
// 没有文件系统，无法"打开文件夹"，改成"下载为 .txt"

const STORAGE_KEY = 'cardforge_error_log';
const MAX_ENTRIES = 500;
const MAX_BUFFER = 200; // 内存缓冲（即时显示 + 兜底）

const buffer = [];

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function save(entries) {
  try {
    // localStorage 写入失败一般是配额超限 — 砍半重试一次
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    try {
      const half = entries.slice(-Math.floor(entries.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
    } catch (err) {
      // 仍然失败就放弃，避免死循环
    }
  }
}

function buildEntry(type, message, stack, extra) {
  return {
    time: new Date().toISOString(),
    source: 'web',
    type,
    message: String(message || ''),
    stack: stack ? String(stack) : '',
    extra: extra || null
  };
}

function append(entry) {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const all = load();
  all.push(entry);
  if (all.length > MAX_ENTRIES) all.splice(0, all.length - MAX_ENTRIES);
  save(all);
}

function record(type, message, stack, extra) {
  append(buildEntry(type, message, stack, extra));
}

function logManual(message, extra) {
  record('manual', message, '', extra);
}

function logVueError(err, instance, info) {
  const msg = err && err.message ? err.message : String(err);
  const stack = err && err.stack ? err.stack : '';
  record('vue', msg, stack, { hookInfo: info });
}

function patchConsoleError() {
  const original = console.error.bind(console);
  console.error = function (...args) {
    try {
      const msg = args.map(a => {
        if (a instanceof Error) return a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        }
        return String(a);
      }).join(' ');
      const stack = args.find(a => a instanceof Error)?.stack || '';
      record('console.error', msg, stack);
    } catch (e) {}
    original(...args);
  };
}

function install() {
  window.addEventListener('error', (event) => {
    const err = event.error;
    record('window.error', event.message || (err && err.message), err && err.stack, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason && reason.message ? reason.message : String(reason);
    const stack = reason && reason.stack ? reason.stack : '';
    record('unhandledRejection', msg, stack);
  });

  patchConsoleError();
}

function readAll() {
  // 合并文件中和 buffer 中的日志，按时间倒序去重
  const stored = load();
  const all = [...stored, ...buffer];
  const seen = new Set();
  const dedup = [];
  for (const e of all.sort((a, b) => (b.time || '').localeCompare(a.time || ''))) {
    const k = (e.time || '') + '|' + (e.message || '');
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(e);
  }
  return dedup;
}

function clear() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  buffer.length = 0;
}

export default {
  install,
  logManual,
  logVueError,
  readAll,
  clear
};

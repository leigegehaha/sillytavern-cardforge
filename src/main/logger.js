// 错误日志模块 — 主进程
// 写入路径：app.getPath('userData')/error.log（轮转保留3份：error.log / error.log.1 / error.log.2）
// 单文件上限 1MB，超过后轮转

const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

const MAX_SIZE = 1024 * 1024; // 1MB
const MAX_FILES = 3; // 当前 + .1 + .2

let logDir = null;
let logFile = null;

function init() {
  logDir = app.getPath('userData');
  logFile = path.join(logDir, 'error.log');
  if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
  }
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(logFile)) return;
    const stat = fs.statSync(logFile);
    if (stat.size < MAX_SIZE) return;

    // error.log.1 -> error.log.2，error.log -> error.log.1，error.log.2 被覆盖
    for (let i = MAX_FILES - 2; i >= 1; i--) {
      const src = `${logFile}.${i}`;
      const dst = `${logFile}.${i + 1}`;
      if (fs.existsSync(src)) {
        try { fs.renameSync(src, dst); } catch (e) {}
      }
    }
    try { fs.renameSync(logFile, `${logFile}.1`); } catch (e) {}
  } catch (e) {}
}

function append(entry) {
  if (!logFile) init();
  try {
    rotateIfNeeded();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logFile, line, 'utf-8');
  } catch (e) {
    // 日志写入失败时不能再抛错（避免循环）
  }
}

function buildEntry(source, type, message, stack, extra) {
  return {
    time: new Date().toISOString(),
    source,           // 'main' | 'renderer'
    type,             // 'uncaughtException' | 'unhandledRejection' | 'ipc' | 'window' | 'manual' | ...
    message: String(message || ''),
    stack: stack ? String(stack) : '',
    extra: extra || null
  };
}

function logError(source, type, message, stack, extra) {
  append(buildEntry(source, type, message, stack, extra));
}

// 读取所有日志（合并 3 份，按时间倒序返回）
function readAll() {
  if (!logFile) init();
  const entries = [];
  const files = [logFile, `${logFile}.1`, `${logFile}.2`];
  for (const f of files) {
    try {
      if (!fs.existsSync(f)) continue;
      const content = fs.readFileSync(f, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch (e) {
          // 无法解析的行（比如旧格式）作为纯文本条目
          entries.push({ time: '', source: 'unknown', type: 'raw', message: line, stack: '', extra: null });
        }
      }
    } catch (e) {}
  }
  // 按时间倒序
  entries.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  return entries;
}

function clear() {
  if (!logFile) init();
  const files = [logFile, `${logFile}.1`, `${logFile}.2`];
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
  }
}

function getLogDir() {
  if (!logDir) init();
  return logDir;
}

function openLogFolder() {
  if (!logDir) init();
  try {
    shell.openPath(logDir);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 注册主进程全局错误捕获
function installGlobalHandlers() {
  process.on('uncaughtException', (err) => {
    logError('main', 'uncaughtException', err && err.message, err && err.stack);
  });
  process.on('unhandledRejection', (reason) => {
    const msg = reason && reason.message ? reason.message : String(reason);
    const stack = reason && reason.stack ? reason.stack : '';
    logError('main', 'unhandledRejection', msg, stack);
  });
}

module.exports = {
  init,
  installGlobalHandlers,
  logError,
  readAll,
  clear,
  getLogDir,
  openLogFolder
};

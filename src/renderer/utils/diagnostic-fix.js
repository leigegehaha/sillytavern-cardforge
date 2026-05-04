/**
 * 角色卡诊断 —— 纯前端修复函数 + 撤销栈
 * 朔规则：order 全 100；蓝灯只开 exclude_recursion；绿灯两个都开
 */

const undoStack = [];
const MAX_UNDO = 5;

function recordUndo(entry, fixId, label) {
  undoStack.push({
    fixId,
    entryId: entry?.id ?? null,
    snapshot: entry ? JSON.parse(JSON.stringify(entry)) : null,
    label
  });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

/**
 * 应用单条修复
 * @param {object} cardStore - useCardStore() 实例
 * @param {string} fixId
 * @param {object} payload - { entryId, ... }
 * @returns {boolean} 是否成功
 */
export function applyFix(cardStore, fixId, payload) {
  const entries = cardStore.worldEntries || [];
  const entry = payload?.entryId != null ? entries.find(e => e.id === payload.entryId) : null;

  switch (fixId) {
    case 'fix_order_100':
      if (!entry) return false;
      recordUndo(entry, fixId, `把 #${entry.id} 的 order 改成 100`);
      entry.insertion_order = 100;
      break;

    case 'fix_make_constant':
      if (!entry) return false;
      recordUndo(entry, fixId, `把孤立条目 #${entry.id} 改成蓝灯`);
      entry.constant = true;
      entry.selective = false;
      // 切换灯色后同步递归规则（蓝灯只开 exclude_recursion）
      if (!entry.extensions) entry.extensions = {};
      entry.extensions.exclude_recursion = true;
      entry.extensions.prevent_recursion = false;
      break;

    case 'fix_delete_entry':
      if (!entry) return false;
      recordUndo(entry, fixId, `删除条目 #${entry.id}「${entry.comment || '(未命名)'}」`);
      cardStore.removeWorldEntry(entry.id);
      break;

    case 'fix_filter_empty_keys':
      if (!entry) return false;
      recordUndo(entry, fixId, `过滤 #${entry.id} keys 里的空字符串`);
      entry.keys = (entry.keys || []).filter(k => k && String(k).trim());
      break;

    case 'fix_recursion_for_constant':
      if (!entry) return false;
      recordUndo(entry, fixId, `修复蓝灯 #${entry.id} 的递归设置`);
      if (!entry.extensions) entry.extensions = {};
      entry.extensions.exclude_recursion = true;
      entry.extensions.prevent_recursion = false;
      break;

    case 'fix_recursion_for_triggered':
      if (!entry) return false;
      recordUndo(entry, fixId, `修复绿灯 #${entry.id} 的递归设置`);
      if (!entry.extensions) entry.extensions = {};
      entry.extensions.exclude_recursion = true;
      entry.extensions.prevent_recursion = true;
      break;

    default:
      return false;
  }

  cardStore.markDirty();
  return true;
}

/**
 * 一键修复全部 —— 跑遍所有诊断结果，自动修每个 fixable 的问题
 * @param {object} cardStore
 * @param {Array} allCheckResults - runAllChecks() 的返回值
 * @returns {{ fixed, skipped }} 修复统计
 */
export function applyAllFixes(cardStore, allCheckResults) {
  let fixed = 0;
  let skipped = 0;

  for (const check of allCheckResults) {
    for (const issue of (check.issues || [])) {
      if (issue.fixable && issue.fixId) {
        if (applyFix(cardStore, issue.fixId, issue.fixPayload)) {
          fixed++;
        } else {
          skipped++;
        }
      }
    }
  }

  return { fixed, skipped };
}

/**
 * 撤销最近 1 次修复
 * @returns {{ label } | null}
 */
export function undoLastFix(cardStore) {
  const last = undoStack.pop();
  if (!last) return null;
  const entries = cardStore.worldEntries || [];
  const entry = entries.find(e => e.id === last.entryId);

  if (entry && last.snapshot) {
    // 把字段恢复（保留 entry 引用，避免 v-for key 重渲染问题）
    Object.assign(entry, last.snapshot);
    if (entry.extensions && last.snapshot.extensions) {
      Object.assign(entry.extensions, last.snapshot.extensions);
    }
  } else if (!entry && last.fixId === 'fix_delete_entry' && last.snapshot) {
    // 之前的修复是"删除"，恢复 = 重新加回去
    const restored = cardStore.addWorldEntry();
    Object.assign(restored, last.snapshot);
    if (last.snapshot.extensions) {
      restored.extensions = { ...last.snapshot.extensions };
    }
    // addWorldEntry 会分配新 id，原 id 失去意义；但条目内容恢复了
  }

  cardStore.markDirty();
  return { label: last.label };
}

/**
 * 当前撤销栈大小
 */
export function getUndoStackSize() {
  return undoStack.length;
}

/**
 * 清空撤销栈
 */
export function clearUndoStack() {
  undoStack.length = 0;
}

/**
 * 撤销栈摘要（最近 N 步的标签）
 */
export function getUndoStackLabels() {
  return undoStack.map(u => u.label);
}

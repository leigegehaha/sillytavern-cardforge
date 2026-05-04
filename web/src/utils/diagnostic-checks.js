/**
 * 角色卡诊断 —— 7 个纯前端专项检查（无 AI 调用，瞬间出结果）
 *
 * 每个 check 函数返回标准化结构：
 * {
 *   key: 'check_id',
 *   name: '专项名称',
 *   passed: boolean,        // 是否完全通过（无问题）
 *   summary: '一句话总结',   // 显示在仪表盘
 *   stats: {...},           // 可选，附加统计数据
 *   issues: [               // 问题清单
 *     {
 *       severity: 'error' | 'warning' | 'info',
 *       title: '问题标题',
 *       description: '问题详细描述',
 *       location: '所在位置（如：条目#3 / description）',
 *       fixable: boolean,   // 是否可一键修复
 *       fixId: 'fix_id',    // 对应 diagnostic-fix.js 里的修复函数 key
 *       fixPayload: {...}   // 修复需要的参数
 *     }
 *   ]
 * }
 */

import { scanBagua } from './npc-checker.js';

// ====================================================================
// 1. 基础信息体检
// ====================================================================

export function checkBasicInfo(cardStore) {
  const d = cardStore.cardData;
  const issues = [];

  const requiredFields = [
    { key: 'name', label: '角色名', minLen: 1 },
    { key: 'description', label: '角色描述 (description)', minLen: 50 },
    { key: 'personality', label: '性格 (personality)', minLen: 10 },
    { key: 'first_mes', label: '开场白 (first_mes)', minLen: 30 }
  ];

  for (const f of requiredFields) {
    const val = (d[f.key] || '').trim();
    if (!val) {
      issues.push({
        severity: 'error',
        title: `${f.label} 为空`,
        description: `必填字段 ${f.key} 没填写`,
        location: f.key,
        fixable: false
      });
    } else if (val.length < f.minLen) {
      issues.push({
        severity: 'warning',
        title: `${f.label} 字数过少 (${val.length}/${f.minLen})`,
        description: `当前 ${val.length} 字，建议至少 ${f.minLen} 字才能让 AI 充分理解角色`,
        location: f.key,
        fixable: false
      });
    }
  }

  // 可选字段提示
  const optionalFields = [
    { key: 'scenario', label: '场景设定 (scenario)' },
    { key: 'mes_example', label: '对话样本 (mes_example)' }
  ];
  for (const f of optionalFields) {
    if (!(d[f.key] || '').trim()) {
      issues.push({
        severity: 'info',
        title: `${f.label} 为空`,
        description: `可选字段，但有助于提升角色一致性`,
        location: f.key,
        fixable: false
      });
    }
  }

  // Token 估算
  const totalChars = ['description', 'personality', 'scenario', 'first_mes', 'mes_example', 'system_prompt']
    .reduce((sum, k) => sum + (d[k] || '').length, 0);
  const tokenEst = Math.round(totalChars * 1.3);

  if (tokenEst > 4000) {
    issues.push({
      severity: 'warning',
      title: `基础字段总 token 偏多 (~${tokenEst})`,
      description: '基础字段（description+personality+scenario+first_mes+mes_example+system_prompt）合计估算超过 4000 token，可能挤占世界书空间',
      location: '基础信息',
      fixable: false
    });
  }

  return {
    key: 'basic_info',
    name: '基础信息体检',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: issues.length === 0 ? '基础字段齐全' : `${issues.length} 处问题（${tokenEst} token）`,
    stats: { totalChars, tokenEst, alternateGreetings: (d.alternate_greetings || []).length },
    issues
  };
}

// ====================================================================
// 2. 世界书结构诊断
// ====================================================================

export function checkWorldbookStructure(cardStore) {
  const entries = cardStore.worldEntries || [];
  const issues = [];

  if (entries.length === 0) {
    return {
      key: 'worldbook_structure',
      name: '世界书结构诊断',
      passed: true,
      summary: '世界书为空（如果不需要可忽略）',
      stats: { total: 0 },
      issues
    };
  }

  const enabled = entries.filter(e => e.enabled);
  const constant = enabled.filter(e => e.constant);
  const triggered = enabled.filter(e => !e.constant);
  const disabled = entries.filter(e => !e.enabled);

  // order 不是 100 的（朔规则）
  for (const e of entries) {
    if (e.insertion_order !== 100) {
      issues.push({
        severity: 'warning',
        title: `条目「${e.comment || '(未命名)'}」 order=${e.insertion_order}，建议 100`,
        description: 'CardForge 默认规则：所有 order 统一 100',
        location: `条目 #${e.id}`,
        fixable: true,
        fixId: 'fix_order_100',
        fixPayload: { entryId: e.id }
      });
    }
  }

  // 孤立条目（绿灯但 keys 空）
  for (const e of entries) {
    if (!e.constant && e.enabled && (!e.keys || e.keys.length === 0)) {
      issues.push({
        severity: 'error',
        title: `条目「${e.comment || '(未命名)'}」是绿灯但没关键词`,
        description: '绿灯条目（关键词触发）必须有关键词，否则永远不会触发',
        location: `条目 #${e.id}`,
        fixable: true,
        fixId: 'fix_make_constant',
        fixPayload: { entryId: e.id }
      });
    }
  }

  // 字段空检查
  for (const e of entries) {
    if (!(e.content || '').trim()) {
      issues.push({
        severity: 'error',
        title: `条目「${e.comment || '(未命名)'}」内容 (content) 为空`,
        description: 'content 为空的条目即使触发也不会注入任何内容',
        location: `条目 #${e.id}`,
        fixable: true,
        fixId: 'fix_delete_entry',
        fixPayload: { entryId: e.id }
      });
    }
    if (!(e.comment || '').trim()) {
      issues.push({
        severity: 'warning',
        title: `条目 #${e.id} 没起名字（comment 空）`,
        description: '建议给条目起名方便管理',
        location: `条目 #${e.id}`,
        fixable: false
      });
    }
  }

  // keys 数组里有空字符串
  for (const e of entries) {
    if (Array.isArray(e.keys) && e.keys.some(k => !k || !String(k).trim())) {
      issues.push({
        severity: 'warning',
        title: `条目「${e.comment || '(未命名)'}」keys 含空字符串`,
        description: 'keys 数组里有空白元素，应过滤掉',
        location: `条目 #${e.id}`,
        fixable: true,
        fixId: 'fix_filter_empty_keys',
        fixPayload: { entryId: e.id }
      });
    }
  }

  return {
    key: 'worldbook_structure',
    name: '世界书结构诊断',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: `${entries.length} 条（蓝灯 ${constant.length}/绿灯 ${triggered.length}/禁用 ${disabled.length}）${issues.length > 0 ? '，' + issues.length + ' 处问题' : ''}`,
    stats: { total: entries.length, enabled: enabled.length, constant: constant.length, triggered: triggered.length, disabled: disabled.length },
    issues
  };
}

// ====================================================================
// 3. 关键词冲突分析
// ====================================================================

export function checkKeywordConflicts(cardStore) {
  const entries = (cardStore.worldEntries || []).filter(e => e.enabled && !e.constant);
  const issues = [];

  // 收集所有 keys + 来源条目
  const keyMap = {};  // key -> [{entryId, comment}]
  for (const e of entries) {
    for (const k of (e.keys || [])) {
      const trimmed = String(k).trim();
      if (!trimmed) continue;
      if (!keyMap[trimmed]) keyMap[trimmed] = [];
      keyMap[trimmed].push({ entryId: e.id, comment: e.comment || '(未命名)' });
    }
  }

  // 同一关键词触发多个条目
  for (const [k, list] of Object.entries(keyMap)) {
    if (list.length > 1) {
      issues.push({
        severity: 'warning',
        title: `关键词「${k}」会同时触发 ${list.length} 个条目`,
        description: '可能导致 token 浪费——出现一次关键词就把所有同 key 条目全部注入。建议把 key 改成更精确的词',
        location: list.map(l => `#${l.entryId} ${l.comment}`).join(' / '),
        fixable: false
      });
    }
  }

  // 过度通用关键词检测
  const tooCommon = ['的', '了', '是', '在', '有', '修炼', '等级', '系统', '世界', '人物'];
  for (const k of Object.keys(keyMap)) {
    if (tooCommon.includes(k)) {
      issues.push({
        severity: 'error',
        title: `关键词「${k}」过度通用，会乱触发`,
        description: '这种词在每条 RP 消息里都可能出现，会让条目几乎一直被触发，浪费 token',
        location: keyMap[k].map(l => `#${l.entryId} ${l.comment}`).join(' / '),
        fixable: false
      });
    }
  }

  return {
    key: 'keyword_conflicts',
    name: '关键词冲突分析',
    passed: issues.length === 0,
    summary: `${Object.keys(keyMap).length} 个独立关键词${issues.length > 0 ? '，' + issues.length + ' 处冲突/通用词' : ''}`,
    stats: { totalKeys: Object.keys(keyMap).length, conflicts: issues.length },
    issues
  };
}

// ====================================================================
// 4. Token 占用统计
// ====================================================================

export function checkTokenUsage(cardStore) {
  const entries = cardStore.worldEntries || [];
  const issues = [];

  // 每条目 token 估算
  const ranked = entries
    .filter(e => e.enabled)
    .map(e => ({
      id: e.id,
      comment: e.comment || '(未命名)',
      constant: e.constant,
      chars: (e.content || '').length,
      tokens: Math.round((e.content || '').length * 1.3)
    }))
    .sort((a, b) => b.tokens - a.tokens);

  const constantTokens = ranked.filter(e => e.constant).reduce((s, e) => s + e.tokens, 0);
  const triggeredTokens = ranked.filter(e => !e.constant).reduce((s, e) => s + e.tokens, 0);

  // 常驻条目超过 8000 token 警告
  if (constantTokens > 8000) {
    issues.push({
      severity: 'warning',
      title: `常驻条目总 token 偏多 (~${constantTokens})`,
      description: '常驻条目永久注入到每次对话里，过多会挤占 context 空间。建议把不必要的改成绿灯触发',
      location: '世界书 - 蓝灯条目合计',
      fixable: false
    });
  }

  // Top 5 占用条目
  const top5 = ranked.slice(0, 5);

  return {
    key: 'token_usage',
    name: 'Token 占用统计',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: `常驻 ~${constantTokens} token / 触发 ~${triggeredTokens} token / 总 ~${constantTokens + triggeredTokens} token`,
    stats: { constantTokens, triggeredTokens, top5 },
    issues
  };
}

// ====================================================================
// 5. 递归风险检查（朔规则）
// ====================================================================

export function checkRecursionSettings(cardStore) {
  const entries = cardStore.worldEntries || [];
  const issues = [];

  for (const e of entries) {
    if (!e.enabled) continue;
    const ext = e.extensions || {};

    if (e.constant) {
      // 蓝灯：必须开 exclude_recursion，不开 prevent_recursion
      if (!ext.exclude_recursion) {
        issues.push({
          severity: 'warning',
          title: `蓝灯条目「${e.comment || '(未命名)'}」没开「不可递归」`,
          description: 'CardForge 规则：蓝灯条目应开 exclude_recursion',
          location: `条目 #${e.id}`,
          fixable: true,
          fixId: 'fix_recursion_for_constant',
          fixPayload: { entryId: e.id }
        });
      }
    } else {
      // 绿灯：两个都要开
      if (!ext.exclude_recursion || !ext.prevent_recursion) {
        const missing = [];
        if (!ext.exclude_recursion) missing.push('不可递归');
        if (!ext.prevent_recursion) missing.push('防止进一步递归');
        issues.push({
          severity: 'warning',
          title: `绿灯条目「${e.comment || '(未命名)'}」没开「${missing.join('+')}」`,
          description: 'CardForge 规则：绿灯条目两个递归选项都要开（防 token 爆炸）',
          location: `条目 #${e.id}`,
          fixable: true,
          fixId: 'fix_recursion_for_triggered',
          fixPayload: { entryId: e.id }
        });
      }
    }
  }

  return {
    key: 'recursion_settings',
    name: '递归风险检查',
    passed: issues.length === 0,
    summary: issues.length === 0 ? '所有条目递归设置合规' : `${issues.length} 个条目递归设置不合规`,
    issues
  };
}

// ====================================================================
// 6. 写作质量评分（八股化扫描）
// ====================================================================

export function checkWritingQuality(cardStore) {
  const d = cardStore.cardData;
  const issues = [];

  const fields = [
    { key: 'description', label: 'description' },
    { key: 'personality', label: 'personality' },
    { key: 'scenario', label: 'scenario' },
    { key: 'first_mes', label: 'first_mes' },
    { key: 'mes_example', label: 'mes_example' }
  ];

  let totalBagua = 0;

  for (const f of fields) {
    const text = d[f.key] || '';
    if (!text) continue;
    const baguaIssues = scanBagua(text);
    totalBagua += baguaIssues.length;

    // 按八股类型分组
    const byType = {};
    for (const i of baguaIssues) {
      if (!byType[i.type]) byType[i.type] = [];
      byType[i.type].push(i.word);
    }

    for (const [type, words] of Object.entries(byType)) {
      const uniqueWords = [...new Set(words)];
      issues.push({
        severity: 'warning',
        title: `${f.label} 含 ${type}（${words.length} 处）`,
        description: `命中词：${uniqueWords.slice(0, 5).join('、')}${uniqueWords.length > 5 ? '...' : ''}`,
        location: f.label,
        fixable: false  // 八股修复需要 AI（在阶段 2 加）
      });
    }
  }

  // 世界书条目八股扫描
  for (const e of cardStore.worldEntries || []) {
    if (!e.enabled || !e.content) continue;
    const baguaIssues = scanBagua(e.content);
    if (baguaIssues.length > 0) {
      totalBagua += baguaIssues.length;
      const byType = {};
      for (const i of baguaIssues) {
        if (!byType[i.type]) byType[i.type] = (byType[i.type] || 0) + 1;
        byType[i.type]++;
      }
      const summary = Object.entries(byType).map(([t, c]) => `${t}×${c}`).join('、');
      issues.push({
        severity: 'info',
        title: `条目「${e.comment || '(未命名)'}」含八股化`,
        description: summary,
        location: `条目 #${e.id}`,
        fixable: false
      });
    }
  }

  return {
    key: 'writing_quality',
    name: '写作质量评分',
    passed: totalBagua === 0,
    summary: totalBagua === 0 ? '未发现八股化表达' : `共 ${totalBagua} 处八股化（建议用 AI 修复改写）`,
    stats: { totalBagua },
    issues
  };
}

// ====================================================================
// 7. 正则脚本检查
// ====================================================================

export function checkRegexScripts(cardStore) {
  const scripts = cardStore.regexScripts || [];
  const issues = [];

  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    if (s.disabled) continue;

    // findRegex 为空
    if (!s.findRegex || !s.findRegex.trim()) {
      issues.push({
        severity: 'error',
        title: `正则脚本「${s.scriptName || '(未命名)'}」findRegex 为空`,
        description: '没有匹配模式，脚本无法工作',
        location: `脚本 #${i}`,
        fixable: false
      });
      continue;
    }

    // 死循环风险：贪婪量词 + 无锚定
    if (/\.\*\?[^$]/.test(s.findRegex) || /\([^)]*\.\*\)[^$]/.test(s.findRegex)) {
      issues.push({
        severity: 'warning',
        title: `正则脚本「${s.scriptName || '(未命名)'}」含贪婪量词，可能匹配过宽`,
        description: '`.*` 没有锚定符，可能误匹配大段文本',
        location: `脚本 #${i}`,
        fixable: false
      });
    }

    // 测试正则是否能编译
    try {
      new RegExp(s.findRegex);
    } catch (e) {
      issues.push({
        severity: 'error',
        title: `正则脚本「${s.scriptName || '(未命名)'}」语法错误`,
        description: e.message,
        location: `脚本 #${i}`,
        fixable: false
      });
    }

    // 应用范围（placement）为空
    if (!Array.isArray(s.placement) || s.placement.length === 0) {
      issues.push({
        severity: 'warning',
        title: `正则脚本「${s.scriptName || '(未命名)'}」没设置应用范围`,
        description: '需要勾选应用到 user/AI/slash 命令等其中之一',
        location: `脚本 #${i}`,
        fixable: false
      });
    }
  }

  return {
    key: 'regex_scripts',
    name: '正则脚本检查',
    passed: issues.filter(i => i.severity === 'error').length === 0,
    summary: scripts.length === 0 ? '无正则脚本' : `${scripts.length} 个脚本${issues.length > 0 ? '，' + issues.length + ' 处问题' : ''}`,
    issues
  };
}

// ====================================================================
// 跑全部专项
// ====================================================================

export function runAllChecks(cardStore) {
  return [
    checkBasicInfo(cardStore),
    checkWorldbookStructure(cardStore),
    checkKeywordConflicts(cardStore),
    checkTokenUsage(cardStore),
    checkRecursionSettings(cardStore),
    checkWritingQuality(cardStore),
    checkRegexScripts(cardStore)
  ];
}

// 7 个专项的元数据（用于 UI 渲染）
export const CHECK_METADATA = [
  { key: 'basic_info', name: '基础信息体检', desc: '核心字段齐全度+token 估算' },
  { key: 'worldbook_structure', name: '世界书结构诊断', desc: '蓝绿灯比例+order+孤立条目' },
  { key: 'keyword_conflicts', name: '关键词冲突分析', desc: '重复 key+过度通用 key' },
  { key: 'token_usage', name: 'Token 占用统计', desc: '常驻 vs 触发 token 比例+Top5' },
  { key: 'recursion_settings', name: '递归风险检查', desc: '按 CardForge 规则检查蓝绿灯递归选项' },
  { key: 'writing_quality', name: '写作质量评分', desc: '八股化+万能美人+性格标签化扫描' },
  { key: 'regex_scripts', name: '正则脚本检查', desc: '语法错误+死循环风险+应用范围' }
];

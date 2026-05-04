/**
 * 角色卡诊断 —— 3 个 AI 专项 + AI 修复函数
 * 跟 diagnostic-checks.js 的纯前端 7 个互补
 */

import { parseAiJsonArray } from './json-repair.js';
import { JSON_QUOTE_RULE } from './npc-rules.js';

// ====================================================================
// 8. 角色一致性诊断（AI）
// ====================================================================

export async function checkCharacterConsistency(apiStore, cardStore) {
  if (!apiStore.isConfigured) {
    return {
      key: 'character_consistency',
      name: '角色一致性诊断',
      passed: false,
      summary: 'API 未配置，无法运行 AI 检查',
      issues: []
    };
  }

  const d = cardStore.cardData;
  const fields = {
    name: d.name || '',
    description: (d.description || '').slice(0, 1500),
    personality: d.personality || '',
    scenario: (d.scenario || '').slice(0, 1000),
    first_mes: (d.first_mes || '').slice(0, 1500)
  };

  if (!fields.name && !fields.description && !fields.personality && !fields.first_mes) {
    return {
      key: 'character_consistency',
      name: '角色一致性诊断',
      passed: true,
      summary: '基础字段为空，无可检查内容',
      issues: []
    };
  }

  const sysMsg = '你是 SillyTavern 写卡审查专家，找角色卡四大字段（description / personality / scenario / first_mes）之间的逻辑矛盾。' + JSON_QUOTE_RULE;
  const userPrompt = `请检查以下角色卡四个字段之间的一致性，找出矛盾点：

【name】
${fields.name || '(空)'}

【description】
${fields.description || '(空)'}

【personality】
${fields.personality || '(空)'}

【scenario】
${fields.scenario || '(空)'}

【first_mes】
${fields.first_mes || '(空)'}

检查标准：
- 性格描述跟开场白的实际表现是否一致（如说"温柔"但开场冷漠）
- 年龄/性别/身份在不同字段是否一致
- 场景设定跟开场白是否对得上
- 角色行为是否符合 personality 设定

输出 JSON 数组（无问题则空数组 []）：
\`\`\`json
[
  {
    "field": "first_mes",
    "conflict_with": "personality",
    "title": "矛盾标题",
    "description": "具体矛盾说明",
    "fix_suggestion": "建议修改方向"
  }
]
\`\`\`

只输出 JSON 数组，不要其他文字。`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    const parsed = parseAiJsonArray(result);
    const issues = (Array.isArray(parsed) ? parsed : [])
      .filter(p => p && (p.title || p.description))
      .map(p => ({
        severity: 'warning',
        title: p.title || '角色一致性问题',
        description: `${p.description || ''}\n建议：${p.fix_suggestion || '请人工裁决'}`,
        location: `${p.field || '?'} ↔ ${p.conflict_with || '?'}`,
        fixable: true,
        fixId: 'ai_fix_field',
        fixPayload: { field: p.field, suggestion: p.fix_suggestion, conflictDesc: p.description }
      }));

    return {
      key: 'character_consistency',
      name: '角色一致性诊断',
      passed: issues.length === 0,
      summary: issues.length === 0 ? '四大字段一致性 OK' : `发现 ${issues.length} 处矛盾`,
      issues
    };
  } catch (e) {
    return {
      key: 'character_consistency',
      name: '角色一致性诊断',
      passed: false,
      summary: 'AI 调用失败：' + e.message,
      issues: []
    };
  }
}

// ====================================================================
// 9. MVU 变量诊断（AI）
// ====================================================================

export async function checkMvuVariables(apiStore, cardStore) {
  if (!apiStore.isConfigured) {
    return {
      key: 'mvu_variables',
      name: 'MVU 变量诊断',
      passed: false,
      summary: 'API 未配置，无法运行 AI 检查',
      issues: []
    };
  }

  const varGroups = cardStore.cardData.extensions?.cfMvuVarGroups || [];
  if (varGroups.length === 0) {
    return {
      key: 'mvu_variables',
      name: 'MVU 变量诊断',
      passed: true,
      summary: '未启用 MVU 变量系统（如不需要可忽略）',
      issues: []
    };
  }

  const allVars = [];
  for (const g of varGroups) {
    for (const f of (g.fields || [])) {
      allVars.push(`${g.name}.${f.name}（${f.type}${f.defaultValue ? '=' + f.defaultValue : ''}）`);
    }
  }

  const worldbookContent = (cardStore.worldEntries || [])
    .filter(e => e.enabled)
    .map(e => `[${e.comment || '(未命名)'}]\n${(e.content || '').slice(0, 500)}`)
    .join('\n\n');

  const sysMsg = '你是 SillyTavern MVU 变量系统审查专家。' + JSON_QUOTE_RULE;
  const userPrompt = `请检查 MVU 变量定义和使用是否合理：

【已定义的变量】
${allVars.join('\n')}

【世界书内容（看变量被引用情况）】
${worldbookContent.slice(0, 5000)}

检查项：
1. 是否有定义了但世界书中从未引用的变量？
2. 是否有变量类型不合理（如战斗系统全用 string 没 number）？
3. 是否缺少常见 MVU 系统应有的变量（如时间/位置/状态）？
4. 是否有变量名歧义或重复？

输出 JSON 数组（无问题则空数组 []）：
\`\`\`json
[
  {
    "title": "问题标题",
    "description": "具体问题",
    "variable": "涉及的变量名",
    "fix_suggestion": "建议"
  }
]
\`\`\`

只输出 JSON 数组。`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    const parsed = parseAiJsonArray(result);
    const issues = (Array.isArray(parsed) ? parsed : [])
      .filter(p => p && (p.title || p.description))
      .map(p => ({
        severity: 'info',
        title: p.title || 'MVU 变量问题',
        description: `${p.description || ''}\n建议：${p.fix_suggestion || ''}`,
        location: p.variable || 'MVU 变量',
        fixable: false  // MVU 变量诊断只输出建议，不做 AI 自动修
      }));

    return {
      key: 'mvu_variables',
      name: 'MVU 变量诊断',
      passed: issues.length === 0,
      summary: `${allVars.length} 个变量${issues.length === 0 ? '，无问题' : '，' + issues.length + ' 处建议'}`,
      issues
    };
  } catch (e) {
    return {
      key: 'mvu_variables',
      name: 'MVU 变量诊断',
      passed: false,
      summary: 'AI 调用失败：' + e.message,
      issues: []
    };
  }
}

// ====================================================================
// 10. 最佳实践审查（AI）
// ====================================================================

export async function checkBestPractices(apiStore, cardStore) {
  if (!apiStore.isConfigured) {
    return {
      key: 'best_practices',
      name: '最佳实践审查',
      passed: false,
      summary: 'API 未配置，无法运行 AI 检查',
      issues: []
    };
  }

  const d = cardStore.cardData;
  const description = d.description || '';
  const personality = d.personality || '';

  if (!description && !personality) {
    return {
      key: 'best_practices',
      name: '最佳实践审查',
      passed: true,
      summary: 'description/personality 为空，无可审查内容',
      issues: []
    };
  }

  const sysMsg = '你是 SillyTavern 写卡审查专家，按"绝对零度+特征差异化+关系禁标签"原则审查。' + JSON_QUOTE_RULE;
  const userPrompt = `请按以下铁律审查角色卡的写作质量：

【description】
${description.slice(0, 2000)}

【personality】
${personality}

审查标准：
1. **特征差异化**：外貌是否只写了"偏离 AI 默认认知"的部分？还是堆了"精致脸蛋/白皙皮肤"等万能美人描写？
2. **关系禁标签**：是否用"温顺乖巧/真诚信赖/嫉妒驱动"等抽象标签描述关系？应该用具体行为代替
3. **性格禁标签化**：是否直接说"她很温柔/他很善良"？应该用具体行为体现
4. **绝对零度**：是否有作者主观评价/八股化语言（似乎/仿佛/嘴角微微上扬）？

输出 JSON 数组（无问题则空数组 []）：
\`\`\`json
[
  {
    "field": "description" 或 "personality",
    "title": "问题标题（如：description 含万能美人描写）",
    "description": "具体问题说明",
    "violations": ["命中的具体词/句"],
    "fix_suggestion": "建议改写方向"
  }
]
\`\`\`

只输出 JSON 数组。`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    const parsed = parseAiJsonArray(result);
    const issues = (Array.isArray(parsed) ? parsed : [])
      .filter(p => p && (p.title || p.description))
      .map(p => ({
        severity: 'warning',
        title: p.title || '最佳实践问题',
        description: `${p.description || ''}${p.violations ? '\n命中：' + (Array.isArray(p.violations) ? p.violations.join('、') : p.violations) : ''}\n建议：${p.fix_suggestion || ''}`,
        location: p.field || 'description',
        fixable: true,
        fixId: 'ai_fix_field',
        fixPayload: { field: p.field, suggestion: p.fix_suggestion, conflictDesc: p.description }
      }));

    return {
      key: 'best_practices',
      name: '最佳实践审查',
      passed: issues.length === 0,
      summary: issues.length === 0 ? '写作风格符合最佳实践' : `${issues.length} 处违反铁律`,
      issues
    };
  } catch (e) {
    return {
      key: 'best_practices',
      name: '最佳实践审查',
      passed: false,
      summary: 'AI 调用失败：' + e.message,
      issues: []
    };
  }
}

// ====================================================================
// 跑全部 AI 专项
// ====================================================================

export async function runAllAiChecks(apiStore, cardStore, onProgress) {
  const checks = [
    { fn: checkCharacterConsistency, name: '角色一致性诊断' },
    { fn: checkMvuVariables, name: 'MVU 变量诊断' },
    { fn: checkBestPractices, name: '最佳实践审查' }
  ];

  const results = [];
  for (let i = 0; i < checks.length; i++) {
    if (onProgress) onProgress(i, checks.length, checks[i].name);
    try {
      const r = await checks[i].fn(apiStore, cardStore);
      results.push(r);
    } catch (e) {
      results.push({
        key: 'unknown',
        name: checks[i].name,
        passed: false,
        summary: '检查失败：' + e.message,
        issues: []
      });
    }
    // 间隔避免限流
    if (i < checks.length - 1) await new Promise(r => setTimeout(r, 13000));
  }
  return results;
}

// AI 专项元数据
export const AI_CHECK_METADATA = [
  { key: 'character_consistency', name: '角色一致性诊断', desc: 'description ↔ personality ↔ first_mes 矛盾检测' },
  { key: 'mvu_variables', name: 'MVU 变量诊断', desc: '变量定义合理性 + 未引用检测' },
  { key: 'best_practices', name: '最佳实践审查', desc: '按写卡铁律检查（特征差异化/关系禁标签）' }
];

// ====================================================================
// AI 修复：改写指定字段
// ====================================================================

/**
 * AI 改写角色卡某个字段
 * @returns {Promise<{ original, rewritten, field }>}
 */
export async function aiFixField(apiStore, cardStore, field, suggestion, conflictDesc) {
  if (!apiStore.isConfigured) throw new Error('API 未配置');

  const d = cardStore.cardData;
  const original = d[field] || '';
  if (!original.trim()) throw new Error(`字段 ${field} 为空，无法改写`);

  const sysMsg = '你是 SillyTavern 写卡专家，按要求改写角色卡字段，保持原长度和风格框架。' + JSON_QUOTE_RULE;
  const userPrompt = `请按建议改写以下字段。

【字段名】${field}
【原内容】
${original}

【发现的问题】
${conflictDesc || '(无具体描述)'}

【改写建议】
${suggestion || '修复上述问题'}

要求：
- 只改有问题的部分，不要全文重写
- 保持原文的整体结构和风格
- 输出改写后的完整内容（不是 diff，是完整的新版本）
- 不要加任何解释、前缀、Markdown 代码块包裹

直接输出改写后的完整内容：`;

  const result = await apiStore.chat([
    { role: 'system', content: sysMsg },
    { role: 'user', content: userPrompt }
  ], { temperature: 0.6, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

  // 清理 AI 可能加的 Markdown 包裹
  const rewritten = String(result || '').replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();

  return { original, rewritten, field };
}

/**
 * 把 AI 改写后的字段写回 cardStore
 */
export function applyAiFix(cardStore, field, newValue) {
  if (!field) return false;
  cardStore.cardData[field] = newValue;
  cardStore.markDirty();
  return true;
}

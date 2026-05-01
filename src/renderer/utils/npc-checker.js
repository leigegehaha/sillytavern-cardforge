/**
 * NPC 内容八股化 / 质量自查
 * - scanBagua：纯前端正则扫描，秒响应（用于实时输入提示）
 * - aiCheckField：AI 单字段语义自查（onBlur 时用，1-2 分钟内出结果）
 * - aiCheckFullNpc：AI 完整 NPC 自查（生成完后调一次）
 */

import { BAGUA_PATTERNS, NPC_SELF_CHECK_PROMPT, JSON_QUOTE_RULE } from './npc-rules.js';
import { normalizeNpc, isValidNpc } from './npc-format.js';

/**
 * 纯前端正则扫描 —— 输入文本，返回所有命中的八股化警告
 * 用于 textarea oninput 实时高亮
 * @param {string} text
 * @returns {Array<{word, index, type, suggest}>}
 */
export function scanBagua(text) {
  if (!text || typeof text !== 'string') return [];
  const issues = [];
  for (const rule of BAGUA_PATTERNS) {
    // 重置 lastIndex 防止 g 标志的全局正则状态污染
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      issues.push({
        word: m[0],
        index: m.index,
        type: rule.type,
        suggest: rule.suggest
      });
      // 防止零宽匹配导致死循环
      if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
    }
  }
  return issues;
}

/**
 * AI 单字段语义自查 —— onBlur 时调，5-10 字段共 1-2 分钟出结果
 * 用于检查 scanBagua 抓不到的语义问题（比如"白皙的皮肤"算不算万能美人）
 * @param {object} apiStore
 * @param {string} fieldLabel - 字段中文名（如"外貌特征"）
 * @param {string} fieldValue - 字段当前内容
 * @returns {Promise<{hasIssue, issues, suggest} | null>}
 */
export async function aiCheckField(apiStore, fieldLabel, fieldValue) {
  if (!fieldValue || typeof fieldValue !== 'string' || fieldValue.trim().length < 5) return null;
  if (!apiStore.isConfigured) return null;

  const sysMsg = '你是 SillyTavern 写卡审查专家，按写卡方法论检查内容是否符合"绝对零度/白描/特征差异化/八股禁令"。' + JSON_QUOTE_RULE;
  const userPrompt = `请检查以下 NPC 的「${fieldLabel}」字段，找出八股化、万能美人、性格标签化、主观评价等问题。

字段内容：
${fieldValue}

输出 JSON（无问题时 hasIssue 为 false）：
{"hasIssue": true 或 false, "issues": ["问题1描述", "问题2描述"], "suggest": "具体修改建议"}

只输出 JSON，不要其他文字。`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3 });

    const cleaned = String(result || '').replace(/```(?:json)?\s*/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      hasIssue: !!parsed.hasIssue,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggest: String(parsed.suggest || '')
    };
  } catch (e) {
    // 自查失败不影响主流程
    return null;
  }
}

/**
 * AI 完整 NPC 自查 —— 生成完后调一次，按内置规则清单全量审查并修正
 * @param {object} apiStore
 * @param {object} npc - 6 块 NPC JSON
 * @returns {Promise<object>} 修正后的 NPC（失败则返回原 NPC）
 */
export async function aiCheckFullNpc(apiStore, npc) {
  if (!npc || !apiStore.isConfigured) return npc;

  const sysMsg = '你是 SillyTavern 写卡审查专家。按写卡方法论检查并修正 NPC，必须输出完整 6 块 JSON 结构。' + JSON_QUOTE_RULE;
  const userPrompt = NPC_SELF_CHECK_PROMPT + '\n\n当前 NPC JSON：\n' + JSON.stringify(npc, null, 2);

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3 });

    const cleaned = String(result || '').replace(/```(?:json)?\s*/gi, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return npc;
    const parsed = JSON.parse(match[0]);
    const fixed = normalizeNpc(parsed);
    if (!isValidNpc(fixed)) return npc;
    return fixed;
  } catch (e) {
    return npc;
  }
}

/**
 * 统计 NPC 整体八股化数量（用于结果区显示"质量评分"）
 * @param {object} npc
 * @returns {{total, byType}} 总数 + 按类型分组
 */
export function summarizeBagua(npc) {
  if (!npc) return { total: 0, byType: {} };
  const allText = collectNpcText(npc);
  const issues = scanBagua(allText);
  const byType = {};
  for (const i of issues) {
    byType[i.type] = (byType[i.type] || 0) + 1;
  }
  return { total: issues.length, byType };
}

// 把整个 NPC 的所有文本字段拼成一段，用于整体扫描
function collectNpcText(npc) {
  const parts = [];
  for (const block of ['basic', 'appearance', 'personality', 'relationship', 'language']) {
    const data = npc[block];
    if (data && typeof data === 'object') {
      for (const v of Object.values(data)) {
        if (typeof v === 'string') parts.push(v);
      }
    }
  }
  if (Array.isArray(npc.sample_dialogues)) {
    parts.push(...npc.sample_dialogues.filter(d => typeof d === 'string'));
  }
  return parts.join('\n');
}

/**
 * 小说转世界书 —— 提取结果质量检查
 * - scanBaguaInExtraction：八股化扫描（复用 npc-checker 的 scanBagua）
 * - checkChapterReferences：章节号锚定缺失检测
 * - checkAbstractRelationLabels：关系抽象标签检测
 * - aiSelfCheck：AI 自检（生成完一类后调一次）
 * - mergeR1R2：R1+R2 双跑合并
 */

import { scanBagua } from './npc-checker.js';
import { SELF_CHECK_PROMPT, JSON_QUOTE_RULE } from './novel-extract-rules.js';
import { normalizeExtractionArray } from './novel-extract-format.js';
import { parseAiJsonArray } from './json-repair.js';

// ====================================================================
// 收集所有字符串字段（按 type 不同字段不同）
// ====================================================================

function collectTextFromArray(arr, type) {
  if (!Array.isArray(arr)) return [];
  const texts = [];

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;

    if (type === 'character') {
      if (item.appearance) texts.push(item.appearance);
      const tracks = item.tracks || {};
      for (const trackArr of Object.values(tracks)) {
        if (!Array.isArray(trackArr)) continue;
        for (const t of trackArr) {
          if (t.evidence) texts.push(t.evidence);
          if (t.summary) texts.push(t.summary);
          if (t.boundary) texts.push(t.boundary);
          if (t.decisions) texts.push(t.decisions);
          if (Array.isArray(t.behaviors)) {
            for (const b of t.behaviors) {
              if (b.behavior) texts.push(b.behavior);
              if (b.context) texts.push(b.context);
            }
          }
          if (Array.isArray(t.dialogues)) texts.push(...t.dialogues.filter(d => typeof d === 'string'));
        }
      }
    } else if (type === 'eventline') {
      if (item.cause?.summary) texts.push(item.cause.summary);
      if (item.cause?.dialogue) texts.push(item.cause.dialogue);
      for (const p of item.passages || []) {
        if (p.node) texts.push(p.node);
        if (p.dialogue) texts.push(p.dialogue);
      }
      if (item.result?.summary) texts.push(item.result.summary);
      if (item.result?.dialogue) texts.push(item.result.dialogue);
      if (item.follow_up) texts.push(item.follow_up);
    } else if (type === 'timeline') {
      if (item.summary) texts.push(item.summary);
      if (item.protagonist_status) texts.push(item.protagonist_status);
    } else if (type === 'setting') {
      if (item.effect) texts.push(item.effect);
      if (item.description) texts.push(item.description);
    } else if (type === 'item_trajectory') {
      for (const e of item.events || []) {
        if (e.source) texts.push(e.source);
        if (e.destination) texts.push(e.destination);
        if (e.evidence) texts.push(e.evidence);
      }
    }
  }
  return texts;
}

// ====================================================================
// 八股化扫描
// ====================================================================

export function scanBaguaInExtraction(arr, type) {
  const texts = collectTextFromArray(arr, type);
  const allIssues = [];
  for (const text of texts) {
    const issues = scanBagua(text);
    allIssues.push(...issues);
  }
  const byType = {};
  for (const i of allIssues) {
    byType[i.type] = (byType[i.type] || 0) + 1;
  }
  return { total: allIssues.length, byType, items: allIssues.slice(0, 30) };
}

// ====================================================================
// 章节号锚定缺失检测
// ====================================================================

export function checkChapterReferences(arr, type) {
  if (!Array.isArray(arr)) return [];
  const issues = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemName = item?.name || item?.stage_name || item?.item_name || `#${i}`;

    if (type === 'character') {
      const tracks = item?.tracks || {};
      for (const [trackName, trackArr] of Object.entries(tracks)) {
        if (!Array.isArray(trackArr)) continue;
        for (let ti = 0; ti < trackArr.length; ti++) {
          const t = trackArr[ti];
          if (!t.chapter || t.chapter === '') {
            issues.push({ path: `${itemName} / 轨迹·${trackName}[${ti}]`, expected: '章节号', current: '空' });
          }
          if (Array.isArray(t.behaviors)) {
            for (let bi = 0; bi < t.behaviors.length; bi++) {
              if (!t.behaviors[bi].chapter) {
                issues.push({ path: `${itemName} / 关系·行为[${bi}]`, expected: '章节号', current: '空' });
              }
            }
          }
        }
      }
    } else if (type === 'eventline') {
      if (item?.cause && !item.cause.chapter) {
        issues.push({ path: `${itemName} / 起因`, expected: '章节号', current: '空' });
      }
      for (let pi = 0; pi < (item?.passages || []).length; pi++) {
        if (!item.passages[pi].chapter) {
          issues.push({ path: `${itemName} / 经过[${pi}]`, expected: '章节号', current: '空' });
        }
      }
      if (item?.result && !item.result.chapter) {
        issues.push({ path: `${itemName} / 结果`, expected: '章节号', current: '空' });
      }
    } else if (type === 'item_trajectory') {
      for (let ei = 0; ei < (item?.events || []).length; ei++) {
        if (!item.events[ei].chapter) {
          issues.push({ path: `${itemName} / 流转[${ei}]`, expected: '章节号', current: '空' });
        }
      }
    }
  }
  return issues;
}

// ====================================================================
// 关系抽象标签检测
// ====================================================================

const ABSTRACT_LABEL_PATTERNS = [
  /温顺乖巧|俏皮撒娇|真诚信赖|嫉妒驱动|被征服的女性|慈爱却略显笨拙/g,
  /^(温柔|善良|坚强|聪明|开朗|内向|傲娇|腹黑|温暖|冷漠|可爱|漂亮|帅气)[、，,]/gm,
  /^(成熟|成长|蜕变|升华|觉醒)$/gm
];

export function checkAbstractRelationLabels(characters) {
  if (!Array.isArray(characters)) return [];
  const issues = [];

  for (const char of characters) {
    const tracks = char?.tracks || {};
    for (const r of tracks.关系 || []) {
      if (typeof r.summary === 'string') {
        for (const pattern of ABSTRACT_LABEL_PATTERNS) {
          pattern.lastIndex = 0;
          let m;
          while ((m = pattern.exec(r.summary)) !== null) {
            issues.push({ char: char.name, target: r.target, label: m[0], field: '互动特征' });
            if (m.index === pattern.lastIndex) pattern.lastIndex++;
          }
        }
      }
    }
    for (const stage of tracks.行为模式 || []) {
      if (typeof stage.decisions === 'string') {
        for (const pattern of ABSTRACT_LABEL_PATTERNS) {
          pattern.lastIndex = 0;
          let m;
          while ((m = pattern.exec(stage.decisions)) !== null) {
            issues.push({ char: char.name, stage: stage.stage, label: m[0], field: '决策倾向' });
            if (m.index === pattern.lastIndex) pattern.lastIndex++;
          }
        }
      }
    }
  }
  return issues;
}

// ====================================================================
// AI 自检
// ====================================================================

export async function aiSelfCheckExtraction(apiStore, extractionArray, type) {
  if (!apiStore.isConfigured) return extractionArray;
  if (!Array.isArray(extractionArray) || extractionArray.length === 0) return extractionArray;

  const sysMsg = '你是 SillyTavern 写卡审查专家。按写卡铁律检查并修正提取结果，必须输出完整 JSON 数组结构。' + JSON_QUOTE_RULE;
  const userPrompt = SELF_CHECK_PROMPT + `\n\n## 当前提取结果（type: ${type}）\n\n` + JSON.stringify(extractionArray, null, 2);

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.3,
      maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
    });
    const parsed = parseAiJsonArray(result);
    const normalized = normalizeExtractionArray(parsed, type);
    return normalized.length > 0 ? normalized : extractionArray;
  } catch (e) {
    return extractionArray;
  }
}

// ====================================================================
// R1+R2 双跑合并
// ====================================================================

export async function mergeR1R2(apiStore, r1Array, r2Array, type) {
  if (!apiStore.isConfigured) {
    return mergeArraysFallback(r1Array, r2Array, type);
  }
  if (!Array.isArray(r1Array) || !Array.isArray(r2Array)) {
    return r1Array || r2Array || [];
  }

  const sysMsg = '你是合并引擎。比对两份独立提取结果，输出去重合并后的完整 JSON 数组。' + JSON_QUOTE_RULE;
  const userPrompt = `## 任务：合并 R1 和 R2 的提取结果（type: ${type}）

合并规则：
- 同名/同义条目取并集，章节号取信息更完整的版本
- 一方独有的条目保留
- 关系/行为模式轨迹的台词/节点取并集去重
- 输出完整 JSON 数组（同 R1/R2 字段结构）

===R1===
${JSON.stringify(r1Array, null, 2)}

===R2===
${JSON.stringify(r2Array, null, 2)}

只输出合并后的 JSON 数组，不要其他文字。`;

  try {
    const result = await apiStore.chat([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.3,
      maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
    });
    const parsed = parseAiJsonArray(result);
    const normalized = normalizeExtractionArray(parsed, type);
    return normalized.length > 0 ? normalized : mergeArraysFallback(r1Array, r2Array, type);
  } catch (e) {
    return mergeArraysFallback(r1Array, r2Array, type);
  }
}

function mergeArraysFallback(r1, r2, type) {
  const arr = [...(r1 || []), ...(r2 || [])];
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    const key = item?.name || item?.stage_name || item?.item_name || JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

// ====================================================================
// 整体质量评分
// ====================================================================

export function summarizeExtractionQuality(extraction) {
  let baguaCount = 0;
  let missingChapterCount = 0;

  for (const type of ['character', 'eventline', 'timeline', 'setting', 'item_trajectory']) {
    const arr = extraction[type === 'character' ? 'characters' :
                            type === 'eventline' ? 'eventlines' :
                            type === 'timeline' ? 'timeline' :
                            type === 'setting' ? 'settings' :
                            'item_trajectories'];
    const baguaScan = scanBaguaInExtraction(arr, type);
    baguaCount += baguaScan.total;
    missingChapterCount += checkChapterReferences(arr, type).length;
  }

  const abstractLabelCount = checkAbstractRelationLabels(extraction.characters).length;
  const totalIssues = baguaCount + missingChapterCount + abstractLabelCount;
  const score = Math.max(0, 100 - baguaCount * 2 - missingChapterCount * 1 - abstractLabelCount * 3);

  const suggestions = [];
  if (baguaCount > 0) suggestions.push(`${baguaCount} 处八股化表达，建议 AI 自检修正`);
  if (missingChapterCount > 0) suggestions.push(`${missingChapterCount} 个事实缺章节号`);
  if (abstractLabelCount > 0) suggestions.push(`${abstractLabelCount} 处关系抽象标签`);

  return {
    score,
    baguaCount,
    missingChapterCount,
    abstractLabelCount,
    totalIssues,
    suggestions
  };
}

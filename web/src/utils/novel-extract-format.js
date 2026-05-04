/**
 * 小说转世界书 —— 提取结果数据结构 + 世界书条目转换 + 章节切片
 */

import { CHAPTER_REGEXES } from './novel-extract-rules.js';

// ====================================================================
// 默认数据模板
// ====================================================================

export function emptyExtraction() {
  return {
    characters: [],
    eventlines: [],
    timeline: [],
    settings: [],
    item_trajectories: []
  };
}

export function emptyExtractConfig() {
  return {
    novelName: '',
    chapterName: '',
    protagonistName: '',
    userMode: 'replace',
    enableR2DoubleCheck: false,
    enableContinuationSummary: false,
    chunkStrategy: 'auto',
    chaptersPerChunk: 5,
    wordsPerChunk: 10000,
    chapterRangeStart: 1,
    chapterRangeEnd: 0,
    selectedTypes: ['character', 'eventline', 'timeline', 'setting', 'item_trajectory']
  };
}

// ====================================================================
// 章节切片
// ====================================================================

const COMBINED_CHAPTER_REGEX = /(?=^[\s]*(?:第[一二三四五六七八九十百千零\d]+[章话节卷話章節]|Chapter\s+\d+|Episode\s+\d+|Part\s+\d+|Scene\s+\d+|序章|プロローグ|Prologue|Epilogue|尾声))/m;

export function chunkNovel(text, opts = {}) {
  const strategy = opts.strategy || 'auto';
  const chaptersPerChunk = opts.chaptersPerChunk || 5;
  const wordsPerChunk = opts.wordsPerChunk || 10000;

  if (!text || !text.trim()) {
    return { strategy: 'words', chunks: [], totalChapters: 0, fallback: false };
  }

  if (strategy === 'auto' || strategy === 'chapter') {
    const chapters = splitByChapters(text);
    if (chapters.length >= 3 || strategy === 'chapter') {
      const chunks = groupChapters(chapters, chaptersPerChunk);
      return {
        strategy: 'chapter',
        chunks,
        totalChapters: chapters.length,
        fallback: false
      };
    }
  }

  const chunks = splitByWords(text, wordsPerChunk);
  return {
    strategy: 'words',
    chunks,
    totalChapters: 0,
    fallback: strategy === 'auto'
  };
}

function splitByChapters(text) {
  const parts = text.split(new RegExp(COMBINED_CHAPTER_REGEX.source, 'gm'))
    .filter(p => p && p.trim().length > 50);
  return parts;
}

function groupChapters(chapters, chaptersPerChunk) {
  const chunks = [];
  for (let i = 0; i < chapters.length; i += chaptersPerChunk) {
    const slice = chapters.slice(i, i + chaptersPerChunk);
    chunks.push(slice.join('\n\n'));
  }
  return chunks.length > 0 ? chunks : [chapters.join('\n\n')];
}

function splitByWords(text, wordsPerChunk) {
  const chunks = [];
  const totalLen = text.length;
  for (let i = 0; i < totalLen; i += wordsPerChunk) {
    let end = Math.min(i + wordsPerChunk, totalLen);
    if (end < totalLen) {
      const breakMatch = text.slice(end - 200, end).match(/.*[。！？\n]/);
      if (breakMatch) end = (end - 200) + breakMatch.index + breakMatch[0].length;
    }
    chunks.push(text.slice(i, end));
    if (end >= totalLen) break;
  }
  return chunks.length > 0 ? chunks : [text];
}

// ====================================================================
// 提取结果 → 世界书条目（含自动分蓝灯/绿灯）
// ====================================================================

export function extractionToWorldEntries(extraction, config) {
  const entries = [];
  const characters = extraction.characters || [];
  const isMultiChar = characters.filter(c => c.role === 'major').length > 1;
  const chapterName = config.chapterName || '';
  const prefix = chapterName ? `[${chapterName}] ` : '';

  for (const char of characters.filter(c => c.role === 'major')) {
    entries.push(buildEntry({
      comment: `${prefix}角色·${char.name}`,
      keys: [char.name],
      content: characterToYaml(char),
      constant: !isMultiChar,
      selective: isMultiChar,
      position: !isMultiChar ? 'before_char' : 'after_char'
    }));
  }

  for (const char of characters.filter(c => c.role === 'minor')) {
    entries.push(buildEntry({
      comment: `${prefix}次要角色·${char.name}`,
      keys: [char.name],
      content: characterToYaml(char),
      constant: false,
      selective: true,
      position: 'after_char'
    }));
  }

  for (const event of extraction.eventlines || []) {
    const isMain = event.type === '主线';
    entries.push(buildEntry({
      comment: `${prefix}事件线·${event.type}·${event.name}`,
      keys: buildEventlineKeys(event),
      content: eventlineToYaml(event),
      constant: isMain,
      selective: !isMain,
      position: isMain ? 'before_char' : 'after_char'
    }));
  }

  for (const stage of extraction.timeline || []) {
    entries.push(buildEntry({
      comment: `${prefix}时间线·${stage.stage_name}`,
      keys: [],
      content: timelineStageToYaml(stage),
      constant: true,
      selective: false,
      position: 'before_char'
    }));
  }

  for (const setting of extraction.settings || []) {
    entries.push(buildEntry({
      comment: `${prefix}设定·${setting.subtype}·${setting.name}`,
      keys: [setting.name],
      content: settingToYaml(setting),
      constant: false,
      selective: true,
      position: 'after_char'
    }));
  }

  for (const item of extraction.item_trajectories || []) {
    entries.push(buildEntry({
      comment: `${prefix}物品·${item.item_name}`,
      keys: [item.item_name],
      content: itemTrajectoryToYaml(item),
      constant: false,
      selective: true,
      position: 'after_char'
    }));
  }

  return entries;
}

function buildEntry({ comment, keys, content, constant, selective, position }) {
  return {
    comment,
    keys: keys.filter(Boolean),
    secondary_keys: [],
    content,
    constant,
    selective,
    enabled: true,
    position,
    insertion_order: 100,
    extensions: {
      position: position === 'before_char' ? 0 : 1,
      depth: 4,
      // 朔规则：蓝灯只开 exclude_recursion（不可递归）；绿灯两个都开
      exclude_recursion: true,
      prevent_recursion: !constant,
      probability: 100,
      useProbability: true,
      selectiveLogic: 0,
      group: '',
      group_weight: 100
    }
  };
}

function buildEventlineKeys(event) {
  const keys = [event.name];
  for (const p of event.passages || []) {
    if (Array.isArray(p.key_characters)) {
      keys.push(...p.key_characters.slice(0, 3));
    }
  }
  return [...new Set(keys.filter(Boolean))];
}

// ====================================================================
// 各类 → YAML 序列化
// ====================================================================

function characterToYaml(char) {
  const lines = [];
  lines.push(`角色: ${char.name || '(未命名)'}`);
  if (char.role) lines.push(`类型: ${char.role === 'major' ? '重要角色' : '次要角色'}`);
  if (char.first_chapter) lines.push(`首次出场: ${char.first_chapter}`);
  if (char.last_chapter) lines.push(`最后出场: ${char.last_chapter}`);

  if (char.basic && typeof char.basic === 'object') {
    lines.push('基础信息:');
    for (const [k, v] of Object.entries(char.basic)) {
      if (v) lines.push(`  ${k}: ${esc(v)}`);
    }
  }

  if (char.appearance) {
    lines.push(`外貌特征: ${esc(char.appearance)}`);
  }

  const tracks = char.tracks || {};

  if (Array.isArray(tracks.境界) && tracks.境界.length) {
    lines.push('境界轨迹:');
    for (const t of tracks.境界) {
      lines.push(`  - [${t.chapter || '未明确章节'}] ${esc(t.state || '')}${t.evidence ? '（' + esc(t.evidence) + '）' : ''}`);
    }
  }

  if (Array.isArray(tracks.位置) && tracks.位置.length) {
    lines.push('位置轨迹:');
    for (const t of tracks.位置) {
      lines.push(`  - [${t.chapter || '未明确章节'}] ${esc(t.location || '')}`);
    }
  }

  if (Array.isArray(tracks.物品) && tracks.物品.length) {
    lines.push('物品轨迹:');
    for (const t of tracks.物品) {
      lines.push(`  - [${t.chapter || '未明确章节'}] ${esc(t.action || '')} ${esc(t.item || '')}${t.source ? '（来源: ' + esc(t.source) + '）' : ''}${t.destination ? '（去向: ' + esc(t.destination) + '）' : ''}`);
    }
  }

  if (Array.isArray(tracks.关系) && tracks.关系.length) {
    lines.push('关系:');
    for (const r of tracks.关系) {
      lines.push(`  与 ${esc(r.target || '(未指定)')}:`);
      if (Array.isArray(r.behaviors) && r.behaviors.length) {
        for (const b of r.behaviors) {
          lines.push(`    - [${b.chapter || '未明确章节'}] ${esc(b.behavior || '')}${b.context ? ' ' + esc(b.context) : ''}`);
        }
      }
      if (r.summary) lines.push(`    互动特征: ${esc(r.summary)}`);
      if (r.boundary) lines.push(`    原著边界: ${esc(r.boundary)}`);
    }
  }

  if (Array.isArray(tracks.行为模式) && tracks.行为模式.length) {
    lines.push('行为模式:');
    for (const stage of tracks.行为模式) {
      lines.push(`  ${esc(stage.stage || '阶段')}（${esc(stage.range || '未明确')}）:`);
      if (Array.isArray(stage.dialogues) && stage.dialogues.length) {
        lines.push('    台词:');
        for (const d of stage.dialogues) {
          lines.push(`      - ${esc(d)}`);
        }
      }
      if (stage.decisions) lines.push(`    决策倾向: ${esc(stage.decisions)}`);
    }
  }

  return lines.join('\n');
}

function eventlineToYaml(event) {
  const lines = [];
  lines.push(`事件线: ${event.name || '(未命名)'}`);
  lines.push(`类型: ${event.type || '支线'}`);

  if (event.cause) {
    lines.push('起因:');
    lines.push(`  章节: ${event.cause.chapter || '未明确章节'}`);
    if (event.cause.summary) lines.push(`  概括: ${esc(event.cause.summary)}`);
    if (event.cause.dialogue) lines.push(`  代表性台词: ${esc(event.cause.dialogue)}`);
  }

  if (Array.isArray(event.passages) && event.passages.length) {
    lines.push('经过:');
    for (let i = 0; i < event.passages.length; i++) {
      const p = event.passages[i];
      lines.push(`  ${i + 1}. [${p.chapter || '未明确章节'}] ${esc(p.node || '')}`);
      if (p.location) lines.push(`     地点: ${esc(p.location)}`);
      if (Array.isArray(p.key_characters) && p.key_characters.length) {
        lines.push(`     关键人物: ${p.key_characters.map(esc).join('、')}`);
      }
      if (p.dialogue) lines.push(`     代表性台词: ${esc(p.dialogue)}`);
    }
  }

  if (event.result) {
    lines.push('结果:');
    lines.push(`  章节: ${event.result.chapter || '未明确章节'}`);
    if (event.result.summary) lines.push(`  概括: ${esc(event.result.summary)}`);
    if (event.result.dialogue) lines.push(`  代表性台词: ${esc(event.result.dialogue)}`);
  }

  if (event.follow_up) {
    lines.push(`后续影响: ${esc(event.follow_up)}`);
  }

  return lines.join('\n');
}

function timelineStageToYaml(stage) {
  const lines = [];
  lines.push(`时间线阶段: ${stage.stage_name || '(未命名)'}`);
  if (stage.chapter_range) lines.push(`章节范围: ${stage.chapter_range}`);

  if (Array.isArray(stage.time_markers) && stage.time_markers.length) {
    lines.push('时间标记:');
    for (const t of stage.time_markers) {
      lines.push(`  - [${t.chapter || '未明确章节'}] ${esc(t.raw || '')}${t.annotation ? '（' + esc(t.annotation) + '）' : ''}`);
    }
  }

  if (stage.summary) lines.push(`概括: ${esc(stage.summary)}`);
  if (stage.protagonist_status) lines.push(`主角状态: ${esc(stage.protagonist_status)}`);

  return lines.join('\n');
}

function settingToYaml(setting) {
  const lines = [];
  lines.push(`${setting.subtype || '设定'}: ${setting.name || '(未命名)'}`);
  if (setting.level) lines.push(`等级: ${esc(setting.level)}`);
  if (setting.grade) lines.push(`品级: ${esc(setting.grade)}`);
  if (setting.user) lines.push(`使用者: ${esc(setting.user)}`);
  if (setting.refiner) lines.push(`炼制者: ${esc(setting.refiner)}`);
  if (setting.first_chapter) lines.push(`首次出现: ${setting.first_chapter}`);
  if (setting.effect) lines.push(`效果: ${esc(setting.effect)}`);
  if (setting.description) lines.push(`描述: ${esc(setting.description)}`);
  return lines.join('\n');
}

function itemTrajectoryToYaml(item) {
  const lines = [];
  lines.push(`物品: ${item.item_name || '(未命名)'}`);
  if (item.owner) lines.push(`持有者: ${esc(item.owner)}`);
  if (Array.isArray(item.events) && item.events.length) {
    lines.push('流转记录:');
    for (const e of item.events) {
      const action = e.action || '获得';
      const detail = e.source ? `来源: ${esc(e.source)}` : (e.destination ? `去向: ${esc(e.destination)}` : '');
      lines.push(`  - [${e.chapter || '未明确章节'}] ${action}${detail ? '（' + detail + '）' : ''}${e.evidence ? ' / 证据: ' + esc(e.evidence) : ''}`);
    }
  }
  return lines.join('\n');
}

function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[:#\n"]/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

// ====================================================================
// 校验 + 默认值
// ====================================================================

export function normalizeExtractionArray(arr, type) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => isValidExtractionItem(item, type))
    .map(item => normalizeExtractionItem(item, type));
}

function isValidExtractionItem(item, type) {
  if (!item || typeof item !== 'object') return false;
  if (type === 'character') return !!item.name;
  if (type === 'eventline') return !!item.name;
  if (type === 'timeline') return !!item.stage_name;
  if (type === 'setting') return !!item.name && !!item.subtype;
  if (type === 'item_trajectory') return !!item.item_name;
  return false;
}

function normalizeExtractionItem(item, type) {
  if (type === 'character') {
    return {
      name: item.name,
      role: item.role === 'major' ? 'major' : 'minor',
      first_chapter: item.first_chapter || '',
      last_chapter: item.last_chapter || '',
      basic: item.basic || {},
      appearance: item.appearance || '',
      tracks: {
        境界: Array.isArray(item.tracks?.境界) ? item.tracks.境界 : [],
        位置: Array.isArray(item.tracks?.位置) ? item.tracks.位置 : [],
        物品: Array.isArray(item.tracks?.物品) ? item.tracks.物品 : [],
        关系: Array.isArray(item.tracks?.关系) ? item.tracks.关系 : [],
        行为模式: Array.isArray(item.tracks?.行为模式) ? item.tracks.行为模式 : []
      }
    };
  }
  if (type === 'eventline') {
    const validTypes = ['主线', '支线', '暗线', '伏笔'];
    return {
      name: item.name,
      type: validTypes.includes(item.type) ? item.type : '支线',
      cause: item.cause || null,
      passages: Array.isArray(item.passages) ? item.passages : [],
      result: item.result || null,
      follow_up: item.follow_up || ''
    };
  }
  if (type === 'timeline') {
    return {
      stage_name: item.stage_name,
      chapter_range: item.chapter_range || '',
      time_markers: Array.isArray(item.time_markers) ? item.time_markers : [],
      summary: item.summary || '',
      protagonist_status: item.protagonist_status || ''
    };
  }
  if (type === 'setting') {
    const validSubtypes = ['功法', '丹药', '地理', '势力', '世界观常识'];
    return {
      ...item,
      subtype: validSubtypes.includes(item.subtype) ? item.subtype : '世界观常识',
      name: item.name,
      first_chapter: item.first_chapter || ''
    };
  }
  if (type === 'item_trajectory') {
    return {
      item_name: item.item_name,
      owner: item.owner || '',
      events: Array.isArray(item.events) ? item.events.map(e => ({
        chapter: e.chapter || '未明确章节',
        action: ['获得', '消耗', '转赠'].includes(e.action) ? e.action : '获得',
        source: e.source || '',
        destination: e.destination || '',
        evidence: e.evidence || ''
      })) : []
    };
  }
  return item;
}

// ====================================================================
// 工具函数
// ====================================================================

export function estimateTotalCalls(chunkCount, selectedTypes, enableR2 = false) {
  const baseCalls = chunkCount * (selectedTypes?.length || 5);
  return enableR2 ? baseCalls * 2 + chunkCount : baseCalls;
}

export function estimateTotalTime(totalCalls, intervalMs = 13000) {
  return Math.ceil(totalCalls * intervalMs / 1000);
}

export function estimateTokens(text) {
  return Math.round((text || '').length * 1.3);
}

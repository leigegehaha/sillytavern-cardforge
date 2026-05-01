/**
 * NPC 6 块结构 ↔ YAML 互转
 * - 生成时：6 块 JSON → YAML 字符串注入世界书 content
 * - 回填时：老 NPC content（YAML 或纯文本）→ 6 块 JSON 给编辑器
 */

// 内部 JSON key → YAML 显示 key 的映射（特殊字段）
const KEY_DISPLAY_MAP = {
  '与user关系': '与{{user}}的关系'
};

function displayKey(k) {
  return KEY_DISPLAY_MAP[k] || k;
}

// 反向：YAML 显示 key → 内部 JSON key
function internalKey(k) {
  for (const [internal, display] of Object.entries(KEY_DISPLAY_MAP)) {
    if (k === display) return internal;
  }
  return k;
}

// 空白 NPC 模板（IDE 表单初始数据 / 新建空 NPC 用）
export function emptyNpc() {
  return {
    name: '',
    keys: [],
    basic: { 姓名: '', 年龄: '', 性别: '', 身份: '' },
    appearance: { 整体印象: '', 关键特征: '', 穿着风格: '' },
    personality: { 核心特质: '', 行为模式: '' },
    relationship: { '与user关系': '', 态度: '', 互动方式: '' },
    language: { 说话风格: '', 口头禅: '' },
    sample_dialogues: []
  };
}

// 6 块 JSON → YAML 字符串（注入世界书 content 用）
export function npcToYaml(npc) {
  if (!npc) return '';
  const lines = [];
  const blocks = [
    ['basic', '基础信息'],
    ['appearance', '外貌特征'],
    ['personality', '性格核心'],
    ['relationship', '关系定位'],
    ['language', '语言特征']
  ];

  lines.push(`NPC: ${npc.name || '(未命名)'}`);

  for (const [field, label] of blocks) {
    const data = npc[field];
    if (!data || typeof data !== 'object') continue;
    const entries = Object.entries(data).filter(([_, v]) => v && String(v).trim());
    if (entries.length === 0) continue;
    lines.push(`  ${label}:`);
    for (const [k, v] of entries) {
      lines.push(`    ${displayKey(k)}: ${escapeYamlValue(String(v))}`);
    }
  }

  if (Array.isArray(npc.sample_dialogues) && npc.sample_dialogues.length > 0) {
    const filtered = npc.sample_dialogues.filter(d => d && String(d).trim());
    if (filtered.length > 0) {
      lines.push('  参考语料:');
      for (const d of filtered) {
        lines.push(`    - "${String(d).replace(/"/g, '\\"')}"`);
      }
    }
  }

  return lines.join('\n');
}

// 单行 YAML 值转义：含特殊字符就用双引号包
function escapeYamlValue(v) {
  if (/[:#\n"]/.test(v)) {
    return `"${v.replace(/"/g, '\\"')}"`;
  }
  return v;
}

// YAML/纯文本 → 6 块 JSON（回填编辑器用，best-effort 解析）
export function yamlToNpc(text) {
  const npc = emptyNpc();
  if (!text || typeof text !== 'string') return npc;

  const sections = {
    '基础信息': 'basic',
    '外貌特征': 'appearance',
    '性格核心': 'personality',
    '关系定位': 'relationship',
    '语言特征': 'language',
    '参考语料': 'sample_dialogues'
  };

  // 顶部 NPC: xxx 提取 name
  const nameMatch = text.match(/^NPC:\s*(.+)$/m);
  if (nameMatch) npc.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');

  let currentSection = null;
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // 检测 section 标题（缩进 2 空格 + 字段名 + 冒号）
    const sectionMatch = line.match(/^\s{0,4}([^:]+):\s*$/);
    if (sectionMatch && sections[sectionMatch[1].trim()]) {
      currentSection = sections[sectionMatch[1].trim()];
      continue;
    }

    if (!currentSection) continue;

    if (currentSection === 'sample_dialogues') {
      const dialMatch = line.match(/^\s*-\s*["']?(.+?)["']?\s*$/);
      if (dialMatch) {
        npc.sample_dialogues.push(dialMatch[1].replace(/\\"/g, '"'));
      }
      continue;
    }

    // key: value
    const kvMatch = line.match(/^\s+([^:]+?):\s*(.+)$/);
    if (kvMatch) {
      const k = internalKey(kvMatch[1].trim());
      let v = kvMatch[2].trim();
      // 去掉两端引号
      v = v.replace(/^["']|["']$/g, '').replace(/\\"/g, '"');
      if (npc[currentSection] && typeof npc[currentSection] === 'object') {
        npc[currentSection][k] = v;
      }
    }
  }

  return npc;
}

// 校验 NPC JSON 是否符合 6 块结构（用于 AI 输出后检查）
export function isValidNpc(npc) {
  if (!npc || typeof npc !== 'object') return false;
  if (!npc.name) return false;
  const required = ['basic', 'appearance', 'personality', 'relationship', 'language'];
  for (const f of required) {
    if (!npc[f] || typeof npc[f] !== 'object') return false;
  }
  if (!Array.isArray(npc.sample_dialogues)) return false;
  return true;
}

// 修复缺字段的 NPC JSON：缺哪个字段就补空的
export function normalizeNpc(npc) {
  const empty = emptyNpc();
  const out = { ...empty, ...(npc || {}) };
  for (const k of ['basic', 'appearance', 'personality', 'relationship', 'language']) {
    out[k] = { ...empty[k], ...(npc?.[k] || {}) };
  }
  out.keys = Array.isArray(npc?.keys) ? npc.keys : (npc?.name ? [npc.name] : []);
  out.sample_dialogues = Array.isArray(npc?.sample_dialogues) ? npc.sample_dialogues : [];
  return out;
}

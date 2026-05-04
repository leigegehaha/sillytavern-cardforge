/**
 * 小说转世界书 —— 共用规则文本和 prompt 模板
 * 5 类分步提取：角色 / 事件线 / 时间线 / 设定 / 物品轨迹
 */

import { BAGUA_PATTERNS, JSON_QUOTE_RULE } from './npc-rules.js';
export { BAGUA_PATTERNS, JSON_QUOTE_RULE };

// 5 类提取的 type 元数据
export const EXTRACTION_TYPES = [
  { key: 'character', label: '角色', desc: '5 种轨迹（境界/位置/物品/关系/行为模式）' },
  { key: 'eventline', label: '事件线', desc: '主线/支线/暗线/伏笔，含起因/经过/结果' },
  { key: 'timeline', label: '时间线', desc: '阶段+时间标记+境界状态' },
  { key: 'setting', label: '设定', desc: '功法/丹药/地理/势力/世界观常识' },
  { key: 'item_trajectory', label: '物品轨迹', desc: '获得章节+消耗章节，不存当前持有' }
];

// 筛选数字（朔 2026-05-01 敲定）
export const FILTER_LIMITS = {
  major_characters: 0,           // 0 = 不限
  minor_characters: 15,
  main_storylines: 0,            // 0 = 不限（主线全保留）
  side_storylines_total: 10,     // 支线/暗线/伏笔合计 10
  techniques: 10,                // 功法/斗技
  pills: 10,                     // 丹药
  geo_factions: 10,              // 地理/势力（合计）
  worldview_per_subsystem: 1     // 世界观常识每子系统 1 条
};

// 主角处理模式
export const PROTAGONIST_MODES = [
  { value: 'replace', label: '替代主角（{{user}} 就是小说主角）', desc: '适合穿越同人——玩家代入主角' },
  { value: 'npc', label: '独立角色（主角作为 NPC，{{user}} 是另一个人）', desc: '适合剧情体验——玩家跟主角互动' }
];

// 写作铁律基础（所有 5 类共用，注入 sysMsg）
export const WRITING_RULES_BASE = `## 写作铁律（必须严格遵守）

### 一、绝对零度 + 白描手法
- 客观叙述，不带主观判断
- 用具体行为代替抽象描述："她很温柔" ✗ → "遇到受伤的小动物会带回家照顾" ✓
- 用语料展现性格，禁止"温柔地说""带着不耐烦的口吻"
- 不堆砌无意义形容词

### 二、八股化禁令
禁止使用：
- 模糊词：似乎、几乎、仿佛、宛如、好像
- 八股微表情：嘴角微微上扬、眼里闪过一丝XX、指尖微微泛白
- 语气描写：带着xx的口吻、用xx的语气
- 极端情绪词：陷入极大的恐惧、极度羞耻、万念俱灰
- 否定转折句：不是...而是...
- 性格标签化："她很温柔""他很善良"
- 万能美人描写：精致的脸蛋、白皙的皮肤、桃花眼、柳叶眉

### 三、章节号锚定（必须）
**所有事实必须标注章节号**：
- 原文有"第X章"/"第X话"/"Chapter X" → 用对应章节号（统一格式 "第X章"）
- 无明确章节标题 → 写 "未明确章节"
- 禁止凭空虚构章节号

### 四、关系/行为禁标签
描述关系/行为时**禁止抽象标签**，必须用"该角色在哪一章做了什么"：
- ✗ "深爱、忠诚、百依百顺"
- ✓ "第10章主动借钱不要求归还、第52章趁对方睡着输送灵力"
- ✗ "性格温和"
- ✓ "面对挑衅以年龄差距化解而非正面冲突（第13章）"

### 五、事件线类型限定
事件线类型仅四值：**主线 / 支线 / 暗线 / 伏笔**。禁止自定义类型（如"人物关系变化线"）。
`;

// 主角处理规则（按用户选的 mode 注入 prompt）
export function buildProtagonistRule(userMode, protagonistName) {
  const name = protagonistName || '(主角名未指定)';
  if (userMode === 'replace') {
    return `## 主角处理（用户已选：{{user}} 替代主角）
- 小说原文里的"${name}" = {{user}}（玩家代入主角）
- 所有"角色对主角的关系" → 写成"对 {{user}} 的关系"
- 主角本身不需要单独成条目（玩家就是主角）
- 角色条目里写"与 {{user}} 的关系：[具体行为+章节号]"`;
  } else {
    return `## 主角处理（用户已选：主角作为 NPC）
- 小说原文里的"${name}" 作为 NPC 写完整条目（含 5 种轨迹）
- {{user}} 不出现在提取结果里（玩家在 SillyTavern 自己定身份）
- 所有角色关系按原文写（如"对${name}的态度"），不要主动改成"对 {{user}}"`;
  }
}

// ====================================================================
// 5 类提取 prompt
// ====================================================================

// 角色提取
export const EXTRACT_CHARACTER_PROMPT = `## 任务：提取小说中的角色

按"5 种轨迹"逐角色输出。区分：
- **重要角色**（major）：出场 ≥ 5 章 + 跟主角有具体互动 + 在事件线经过节点中出现
- **次要角色**（minor）：出场 ≥ 3 章 OR 在事件线经过节点出现 OR 跟主角有过具体互动 —— 上限 ${FILTER_LIMITS.minor_characters} 条（按重要性取 TOP）
- **路人角色**：不收录

## 输出格式（JSON 数组，每个元素是一个角色）

\`\`\`json
[
  {
    "name": "角色名",
    "role": "major" 或 "minor",
    "first_chapter": "第X章",
    "last_chapter": "第Y章",
    "basic": {
      "身份": "如：某宗派外门弟子",
      "年龄": "如：16岁",
      "性别": "男/女/其他"
    },
    "appearance": "外貌特征（只写偏离 AI 默认认知的，禁万能美人描写）",
    "tracks": {
      "境界": [
        { "chapter": "第X章", "state": "等级一阶（按原作的等级体系填）", "evidence": "原文摘录关键句" }
      ],
      "位置": [
        { "chapter": "第X章", "location": "宗门藏经阁" }
      ],
      "物品": [
        { "chapter": "第X章", "action": "获得", "item": "祖传宝剑（示例）", "source": "宗门赏赐" }
      ],
      "关系": [
        { "target": "对方角色名",
          "behaviors": [
            { "chapter": "第X章", "behavior": "具体行为（原文摘录）", "context": "[语境短句]" }
          ],
          "summary": "互动特征（基于行为总结，不用抽象标签）",
          "boundary": "原著中明确没发展到的程度"
        }
      ],
      "行为模式": [
        { "stage": "阶段名（如：入门初期）",
          "range": "第1-10章",
          "dialogues": ["原文台词1（含章节号）", "原文台词2"],
          "decisions": "面对选择时的具体行为模式（用具体事件，禁抽象概括）"
        }
      ]
    }
  }
]
\`\`\`

${JSON_QUOTE_RULE}

只输出 JSON 数组，不要其他文字。
`;

// 事件线提取
export const EXTRACT_EVENTLINE_PROMPT = `## 任务：提取小说中的事件线

按事件线整理剧情。**事件线类型仅四值**：主线 / 支线 / 暗线 / 伏笔。

筛选数字：
- **主线**：不限（全部保留）
- **支线 + 暗线 + 伏笔**：合计 ${FILTER_LIMITS.side_storylines_total} 条（按重要性取 TOP）
- 「重要」标准：经过节点 ≥ 2 个 + 涉及至少一个重要角色 + 有"后续影响"

## 输出格式

\`\`\`json
[
  {
    "name": "事件线名（如：主角初次见配角）",
    "type": "主线" 或 "支线" 或 "暗线" 或 "伏笔",
    "cause": {
      "chapter": "第X章",
      "summary": "起因一句话",
      "dialogue": "代表性台词（原文）——[语境短句]"
    },
    "passages": [
      {
        "chapter": "第X章",
        "node": "节点描述（如：配角主动伸援）",
        "location": "地点",
        "key_characters": ["角色1", "角色2"],
        "dialogue": "代表性台词（原文）——[语境短句]"
      }
    ],
    "result": {
      "chapter": "第X章",
      "summary": "结果一句话",
      "dialogue": "代表性台词（原文）——[语境短句]"
    },
    "follow_up": "对后续的伏笔/影响（无则空字符串）"
  }
]
\`\`\`

${JSON_QUOTE_RULE}

只输出 JSON 数组，不要其他文字。
`;

// 时间线提取
export const EXTRACT_TIMELINE_PROMPT = `## 任务：提取小说时间线主干

按"阶段"切分，每阶段包含时间标记 + 章节范围 + 主角境界状态。

## 输出格式

\`\`\`json
[
  {
    "stage_name": "阶段名（如：拜师初期）",
    "chapter_range": "第1-15章",
    "time_markers": [
      { "chapter": "第X章", "raw": "原文时间表述（如：闭关三个月后）", "annotation": "推算说明（如：约3个月后）" }
    ],
    "summary": "100 字以内本阶段概括",
    "protagonist_status": "本阶段结束时主角等级状态（按原作的等级体系填）"
  }
]
\`\`\`

时间标记规则：
- 含具体数字（X年/X月/X天/X岁）+ 描述"已发生事实距离"或"主角当前年龄"才收
- **不收**：未来预测、约定、纯世界观历史、人物履历回顾、他人年龄推测

${JSON_QUOTE_RULE}

只输出 JSON 数组，不要其他文字。
`;

// 设定提取
export const EXTRACT_SETTING_PROMPT = `## 任务：提取小说世界观设定

分子类输出。**严格筛选，不要全提取**：
- **功法/斗技**：上限 ${FILTER_LIMITS.techniques} 条（必须主角使用 ≥ 2 次 OR 主线/支线关键道具）
- **丹药**：上限 ${FILTER_LIMITS.pills} 条（同上标准）
- **地理/势力**：上限 ${FILTER_LIMITS.geo_factions} 条（合计，原文反复提及 ≥ 3 次的）
- **世界观常识**：每子系统 1 条说清楚（境界体系/货币体系/职业体系等）

## 输出格式

\`\`\`json
[
  {
    "subtype": "功法",
    "name": "破云剑（示例）",
    "level": "玄阶低品",
    "user": "主角",
    "first_chapter": "第X章",
    "effect": "效果描述（原文摘录关键句）"
  },
  {
    "subtype": "丹药",
    "name": "凝元丹（示例）",
    "grade": "三品",
    "refiner": "炼药师",
    "first_chapter": "第X章",
    "effect": "..."
  },
  {
    "subtype": "地理",
    "name": "青风城（示例）",
    "first_chapter": "第X章",
    "description": "城池描述"
  },
  {
    "subtype": "势力",
    "name": "玄阳宗（示例）",
    "first_chapter": "第X章",
    "description": "势力描述 + 跟主角的关系"
  },
  {
    "subtype": "世界观常识",
    "name": "等级体系",
    "description": "按原作的等级体系填写完整说明（修仙类如练气→筑基；都市类如 D级→C级；游戏类如 1阶→2阶 等）"
  }
]
\`\`\`

subtype 严格五值：功法 / 丹药 / 地理 / 势力 / 世界观常识

${JSON_QUOTE_RULE}

只输出 JSON 数组，不要其他文字。
`;

// 物品轨迹提取
export const EXTRACT_ITEM_TRAJECTORY_PROMPT = `## 任务：提取小说中的物品流转轨迹

只追踪**对主角或核心剧情有意义的物品**——主角持有的关键道具、传家宝、剧情触发器物品。
**不追踪**：消耗品（基础丹药）、低价值物品（金币）、纯设定物品（功法本身）。

## 关键规则
**只存"获得章节"和"消耗章节"，不存"当前持有"快照** ——
RP 时根据当前章节 N 动态判定：获得章节 ≤ N 且无消耗记录 → 持有。

## 输出格式

\`\`\`json
[
  {
    "item_name": "玄铁剑（示例）",
    "owner": "主角",
    "events": [
      { "chapter": "第X章", "action": "获得", "source": "拍卖会购得", "evidence": "原文摘录" },
      { "chapter": "第Y章", "action": "消耗", "destination": "炼制成丹", "evidence": "原文摘录" }
    ]
  }
]
\`\`\`

action 严格三值：**获得 / 消耗 / 转赠**

${JSON_QUOTE_RULE}

只输出 JSON 数组，不要其他文字。
`;

// ====================================================================
// 自检 + R2 + 衔接摘要 prompt
// ====================================================================

// AI 自检 prompt（生成完一类后调一次）
export const SELF_CHECK_PROMPT = `## 任务：自检上一步提取结果

逐条检查并修正：

1. **章节号锚定**：每个事实是否标了章节号？无章节标题原文应该写"未明确章节"，禁止编造章节号
2. **关系/行为标签化**：是否含"温顺乖巧""真诚信赖""嫉妒驱动"等抽象标签？有 → 改成具体行为+章节号
3. **八股化**：是否含"似乎/仿佛/嘴角微微上扬/她很温柔"？有 → 改成白描
4. **万能美人描写**：外貌是否含"精致脸蛋/白皙皮肤"？有 → 改成具体特征或删掉
5. **事件线类型**：是否含非四值的类型（如"人物关系变化线"）？有 → 强制归到四值之一
6. **代表性台词归属**：每条台词的说话人是否确实是该角色本人？

输出修正后的完整 JSON 数组（同样的字段结构），不输出修订过程。

${JSON_QUOTE_RULE}
`;

// R2 视角偏移指令（双跑模式启用时附加在主 prompt 后）
export const R2_OFFSET_PROMPT = `## R2 视角偏移指令（补充主任务）

本次提取为"R2 双跑"——补充 R1 可能遗漏的内容：
1. **行为模式台词偏向后 50% 章节**（前 50% 仅在缺乏代表性样本时选）
2. **额外关注次要角色与主角的渐进式互动模式**（如某角色对主角态度从冷淡到热情）
3. **补充商业竞争 / 势力博弈 / 跨章渐进互动 等容易遗漏的事件线**

主任务的字段格式不变，只是选取角度偏移。
`;

// 跨篇章衔接摘要生成 prompt
export const CONTINUATION_SUMMARY_PROMPT = `## 任务：生成跨篇章衔接摘要

从本篇章提取结果中提炼"传递给下一篇章"的关键状态。

## 输出格式（JSON 对象）

\`\`\`json
{
  "previous_chapter_name": "本篇章名",
  "protagonist_end_state": {
    "境界": "本篇章结束时主角境界",
    "持有物品": ["仍持有的物品列表"],
    "金钱余额": "余额",
    "位置": "本篇章结束时位置"
  },
  "time_position": "时间定位（如：主角17岁，距XX事件3个月后）",
  "unfinished_event_lines": [
    { "name": "事件线名", "type": "主线/支线", "follow_up": "未结的影响" }
  ],
  "important_characters": [
    { "name": "角色名", "end_state": "本篇章结束时状态（境界/位置/去向）", "items_held": ["仍持有的物品"] }
  ],
  "key_relationships": [
    { "from": "角色A", "to": "角色B", "current_state": "本篇章末尾互动特征" }
  ],
  "established_settings": {
    "境界体系": "简述",
    "货币体系": "简述",
    "其他常设设定": ["..."]
  }
}
\`\`\`

规则：
- 物品只列"仍持有"状态的，已消耗/转赠不列
- 不概括不改写，从提取结果中逐字段摘录
- 信息不全时写"本篇章未明确"
${JSON_QUOTE_RULE}

只输出 JSON 对象，不要其他文字。
`;

// ====================================================================
// 章节切片正则（多语种识别）
// ====================================================================

export const CHAPTER_REGEXES = [
  // 中文：第X章/话/节/卷
  /^[\s]*第[一二三四五六七八九十百千零\d]+[章话节卷][\s\S]*?$/m,
  // 日文：第X話/章/節
  /^[\s]*第[一二三四五六七八九十百千零\d]+[話章節][\s\S]*?$/m,
  // 英文：Chapter / Episode / Part / Scene
  /^[\s]*(Chapter|Episode|Part|Scene)\s+\d+/im,
  // 序章/特殊
  /^[\s]*(序章|プロローグ|Prologue|Epilogue|尾声)/im
];

/**
 * 检测原文里能否识别章节标题
 * @returns {Array<{regex, count}>} 命中的正则及匹配数
 */
export function detectChapterPattern(text) {
  if (!text) return [];
  const hits = [];
  for (const r of CHAPTER_REGEXES) {
    const matches = text.match(new RegExp(r.source, r.flags + 'g'));
    if (matches && matches.length > 0) {
      hits.push({ regex: r, count: matches.length });
    }
  }
  return hits;
}

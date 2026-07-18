import { useApiStore } from './api.js';
import { useCardStore } from './card.js';
import { useImageGenStore } from './image-gen.js';
import { useAppStore } from './app.js';
import { buildCardContext } from '../utils/card-context.js';

// 容错解析 JSON：从 AI 返回文本中提取 {...} 或 [...]
function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {}
  // 尝试提取 {...}
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch (e) {}
  }
  // 尝试提取 [...]
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch (e) {}
  }
  return null;
}

async function callAI(systemPrompt, userPrompt, opts = {}) {
  const apiStore = useApiStore();
  if (!apiStore.isConfigured) {
    throw new Error('请先在 API 设置配置文本模型');
  }
  return await apiStore.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { temperature: opts.temperature ?? 0.8, maxTokens: opts.maxTokens ?? 2000 });
}

// 1. 角色设定：personality + scenario
export async function genCharSetting() {
  const cardStore = useCardStore();
  const ctx = buildCardContext(cardStore, '');
  const system = `根据角色的名字和描述，生成角色设定。输出严格 JSON（不要 markdown 代码块）：
{"personality":"性格摘要，关键词或短句，100-200字","scenario":"场景设定，故事背景和当前处境，200-400字"}`;
  const result = await callAI(system, ctx + '\n\n请生成角色设定。', { temperature: 0.8, maxTokens: 1500 });
  const parsed = extractJSON(result);
  if (!parsed) throw new Error('角色设定生成失败：AI 返回格式异常');
  if (parsed.personality) cardStore.cardData.data.personality = parsed.personality;
  if (parsed.scenario) cardStore.cardData.data.scenario = parsed.scenario;
  cardStore.markDirty();
}

// 2. 开场白：first_mes
export async function genGreeting() {
  const cardStore = useCardStore();
  const ctx = buildCardContext(cardStore, '');
  const system = `根据角色信息生成开场白(first_mes)。要求：第一人称，符合角色性格和场景，200-500字，可包含动作描写（用*包围）和环境描写。直接输出开场白正文，不要任何解释或标记。`;
  const result = await callAI(system, ctx + '\n\n请生成开场白。', { temperature: 0.9, maxTokens: 1200 });
  cardStore.cardData.data.first_mes = result.trim();
  cardStore.markDirty();
}

// 3. 角色卡图片：复用 imageStore
export async function genCoverImage() {
  const cardStore = useCardStore();
  const imageStore = useImageGenStore();
  if (!imageStore.isConfigured) {
    throw new Error('请先配置图片生成模型');
  }
  const { chinese, english } = await imageStore.genPromptFromCard(cardStore);
  const dataUrl = await imageStore.generateImage(english);
  cardStore.coverImageBase64 = dataUrl;
  cardStore.markDirty();
}

// 4. 世界书：character_book.entries
export async function genWorldbook() {
  const cardStore = useCardStore();
  const ctx = buildCardContext(cardStore, '');
  const system = `根据角色设定生成 5-10 条世界书条目。输出严格 JSON 数组（不要 markdown 代码块），每条：
{"keys":["关键词1"],"comment":"条目名","content":"条目内容，100-300字","constant":false,"selective":true,"order":100,"position":0}
position: 0=before_char, 1=after_char。constant=true 表示常驻。`;
  const result = await callAI(system, ctx + '\n\n请生成世界书条目。', { temperature: 0.85, maxTokens: 3000 });
  const arr = extractJSON(result);
  if (!Array.isArray(arr)) throw new Error('世界书生成失败：AI 返回格式异常');
  for (const e of arr) {
    if (!e.content) continue;
    const entry = cardStore.createEmptyWorldEntry();
    entry.keys = Array.isArray(e.keys) ? e.keys : [e.comment || '关键词'];
    entry.comment = e.comment || '';
    entry.content = e.content;
    entry.constant = !!e.constant;
    entry.selective = e.selective !== false;
    entry.order = e.order ?? 100;
    entry.position = e.position ?? 1;
    entry.enabled = true;
    cardStore.addWorldEntry(entry);
  }
  cardStore.markDirty();
}

// 5. NPC：写入 character_book.entries
export async function genNpc() {
  const cardStore = useCardStore();
  const ctx = buildCardContext(cardStore, '');
  const system = `根据角色设定生成 3-5 个相关 NPC。输出严格 JSON 数组（不要 markdown 代码块），每个 NPC：
{"name":"NPC名字","keys":["触发关键词"],"appearance":"外貌","personality":"性格","background":"背景","relationship":"与主角关系"}
content 字段用 YAML 格式整合所有信息。`;
  const result = await callAI(system, ctx + '\n\n请生成 NPC。', { temperature: 0.85, maxTokens: 2500 });
  const arr = extractJSON(result);
  if (!Array.isArray(arr)) throw new Error('NPC 生成失败：AI 返回格式异常');
  for (const npc of arr) {
    if (!npc.name) continue;
    const entry = cardStore.createEmptyWorldEntry();
    entry.keys = Array.isArray(npc.keys) ? npc.keys : [npc.name];
    entry.comment = npc.name;
    entry.content = `姓名: ${npc.name}\n外貌: ${npc.appearance || ''}\n性格: ${npc.personality || ''}\n背景: ${npc.background || ''}\n与主角关系: ${npc.relationship || ''}`;
    entry.constant = false;
    entry.selective = true;
    entry.order = 100;
    entry.position = 1;
    entry.enabled = true;
    cardStore.addWorldEntry(entry);
  }
  cardStore.markDirty();
}

// 6. 对话样本：mes_example
export async function genDialogue() {
  const cardStore = useCardStore();
  const ctx = buildCardContext(cardStore, '');
  const system = `根据角色信息生成 3-5 段对话样本，展示角色的说话风格。使用 SillyTavern 格式：
<START>
{{user}}: 用户的话
{{char}}: 角色的回应
<START>
{{user}}: ...
{{char}}: ...

直接输出对话样本，不要解释。`;
  const result = await callAI(system, ctx + '\n\n请生成对话样本。', { temperature: 0.9, maxTokens: 2000 });
  cardStore.cardData.data.mes_example = result.trim();
  cardStore.markDirty();
}

// 一键生成：按顺序执行所有 AI 步骤
// stepIds: 要生成的步骤 id 数组
// onProgress(stepId, status, msg): 进度回调
export async function generateAll(stepIds, onProgress) {
  const appStore = useAppStore();
  const genMap = {
    char_setting: genCharSetting,
    greeting: genGreeting,
    cover_image: genCoverImage,
    worldbook: genWorldbook,
    npc: genNpc,
    dialogue: genDialogue,
  };

  const results = { ok: [], fail: [] };
  // 图片放最后（慢）
  const ordered = [...stepIds].sort((a, b) => {
    if (a === 'cover_image') return 1;
    if (b === 'cover_image') return -1;
    return 0;
  });

  for (const id of ordered) {
    const fn = genMap[id];
    if (!fn) continue;
    onProgress?.(id, 'running', '');
    try {
      await fn();
      results.ok.push(id);
      onProgress?.(id, 'ok', '');
    } catch (e) {
      results.fail.push({ id, error: e.message });
      onProgress?.(id, 'fail', e.message);
      appStore.toastError(`${id} 生成失败: ${e.message}`);
    }
  }
  return results;
}

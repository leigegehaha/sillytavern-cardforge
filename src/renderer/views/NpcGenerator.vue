<template>
  <div class="page">
    <div class="page__header">
      <h1>NPC 生成器</h1>
      <p>用 AI 全自动生成或根据关键信息扩写 NPC，一键注入世界书</p>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        NPC 是世界书里的配角，由 AI 扮演。每个 NPC 会生成一条世界书条目，当对话中提到 NPC 的名字时自动触发。<br>
        · <strong>全自动生成</strong> — 只需描述世界观，AI 自动创造角色<br>
        · <strong>关键信息扩写</strong> — 你给出名字、性别等基本信息，AI 补充完整设定<br>
        · 生成后点「注入世界书」就会自动创建世界书条目，关键词自动设好
      </div>
    </div>

    <!-- 模式选择 -->
    <div class="tabs">
      <div :class="['tabs__item', { active: mode === 'auto' }]" @click="mode = 'auto'">全自动生成</div>
      <div :class="['tabs__item', { active: mode === 'expand' }]" @click="mode = 'expand'">关键信息扩写</div>
    </div>

    <div class="grid-2">
      <!-- 左侧：输入区 -->
      <div>
        <!-- 全自动模式 -->
        <div v-if="mode === 'auto'" class="card">
          <div class="card__header"><h3>自动生成设置</h3></div>
          <div class="card__body">
            <div class="form-group">
              <label>生成数量</label>
              <select class="select" v-model.number="autoCount">
                <option :value="1">1 个</option>
                <option :value="3">3 个</option>
                <option :value="5">5 个</option>
              </select>
            </div>
            <div class="form-group">
              <label>世界观/背景</label>
              <textarea class="textarea" v-model="worldContext" rows="3"
                placeholder="描述NPC所在的世界背景，如：现代校园、修仙世界、赛博朋克城市..."></textarea>
            </div>
            <div class="form-group">
              <label>角色类型偏好</label>
              <input class="input" v-model="typePreference"
                placeholder="如：女性角色、反派、商人、师傅...（可留空）">
            </div>
            <div class="form-group">
              <label>描述风格</label>
              <select class="select" v-model="descStyle">
                <option value="narrative">叙述体（自然语言）</option>
                <option value="yaml">YAML 结构化</option>
                <option value="detailed">多维度分离</option>
                <option value="resume">人生履历法（童年-青少年-当前+核心特质+条件特质）</option>
              </select>
            </div>
            <button class="btn btn--primary btn--lg" style="width:100%" :disabled="generating"
              @click="handleAutoGenerate">
              {{ generating ? '生成中...' : '开始生成' }}
            </button>
          </div>
        </div>

        <!-- 扩写模式 -->
        <div v-if="mode === 'expand'" class="card">
          <div class="card__header"><h3>关键信息</h3></div>
          <div class="card__body">
            <div class="grid-2">
              <div class="form-group">
                <label>姓名 <span class="badge badge--danger">必填</span></label>
                <input class="input" v-model="npcInput.name" placeholder="角色姓名">
              </div>
              <div class="form-group">
                <label>性别</label>
                <select class="select" v-model="npcInput.gender">
                  <option value="">随机</option>
                  <option value="女">女</option>
                  <option value="男">男</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label>年龄</label>
                <input class="input" v-model="npcInput.age" placeholder="如：22岁">
              </div>
              <div class="form-group">
                <label>身份/职业</label>
                <input class="input" v-model="npcInput.role" placeholder="如：宗门圣女、咖啡店店员">
              </div>
            </div>
            <div class="form-group">
              <label>性格关键词</label>
              <input class="input" v-model="npcInput.personality" placeholder="如：傲娇、温柔、腹黑（可用逗号分隔多个）">
            </div>
            <div class="form-group">
              <label>外貌要点</label>
              <input class="input" v-model="npcInput.appearance" placeholder="如：银发、红瞳、高挑">
            </div>
            <div class="form-group">
              <label>与{{user}}的关系</label>
              <input class="input" v-model="npcInput.relationship" placeholder="如：青梅竹马、师傅、对手">
            </div>
            <div class="form-group">
              <label>额外说明</label>
              <textarea class="textarea" v-model="npcInput.extra" rows="3"
                placeholder="任何你想补充的信息..."></textarea>
            </div>
            <div class="form-group">
              <label>世界观/背景</label>
              <textarea class="textarea" v-model="worldContext" rows="2"
                placeholder="NPC所在的世界背景"></textarea>
            </div>
            <div class="form-group">
              <label>描述风格</label>
              <select class="select" v-model="descStyle">
                <option value="narrative">叙述体</option>
                <option value="yaml">YAML 结构化</option>
                <option value="detailed">多维度分离</option>
              </select>
            </div>
            <button class="btn btn--primary btn--lg" style="width:100%" :disabled="generating || !npcInput.name"
              @click="handleExpand">
              {{ generating ? '生成中...' : '生成完整角色' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：结果区 -->
      <div>
        <div class="card" style="height:100%;min-height:500px">
          <div class="card__header flex-between">
            <h3>生成结果</h3>
            <div class="flex-row" v-if="generatedNpcs.length">
              <button class="btn btn--primary btn--sm" @click="injectToWorldBook">注入世界书</button>
              <button class="btn btn--ghost btn--sm" @click="generatedNpcs = []">清空</button>
            </div>
          </div>
          <div class="card__body" style="overflow-y:auto;max-height:calc(100vh - 280px)">
            <div v-if="generatedNpcs.length === 0 && !generating" class="empty-state">
              <div class="empty-state__icon"></div>
              <div class="empty-state__title">等待生成</div>
              <div class="empty-state__desc">在左侧设置参数后点击生成按钮</div>
            </div>

            <div v-if="generating" class="empty-state">
              <div class="empty-state__icon" style="animation: pulse 1.5s infinite"></div>
              <div class="empty-state__title">AI 正在生成中...</div>
            </div>

            <div v-for="(npc, i) in generatedNpcs" :key="i" class="npc-result">
              <div class="flex-between mb-md">
                <h4>{{ npc.name || `NPC ${i + 1}` }}</h4>
                <div class="flex-row">
                  <label class="toggle-label">
                    <input type="checkbox" v-model="npc.selected"> 选中注入
                  </label>
                </div>
              </div>
              <div class="npc-result__keys">
                <span style="font-size:11px;color:var(--cf-text-muted)">关键词：</span>
                <span v-for="k in npc.keys" :key="k" class="badge badge--accent" style="margin-right:4px">{{ k }}</span>
              </div>
              <pre class="npc-result__content selectable">{{ npc.content }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const mode = ref('expand');
const generating = ref(false);
const generatedNpcs = ref([]);

// Auto mode
const autoCount = ref(1);
const worldContext = ref('');
const typePreference = ref('');
const descStyle = ref('narrative');

// 自动选择描述风格
onMounted(() => {
  const desc = (cardStore.cardData.description || '').toLowerCase();
  const scenario = (cardStore.cardData.scenario || '').toLowerCase();
  const allText = desc + ' ' + scenario;
  const entries = cardStore.worldEntries;
  const entryCount = entries.length;
  const hasEntryContent = entries.some(e => e.content && e.content.length > 200);

  // 检测世界观类型
  const xiuxianKeywords = ['修仙', '仙', '宗门', '境界', '灵力', '灵石', '丹', '法术', '武功', '江湖', '门派', '修炼', '元婴', '金丹', '炼气'];
  const isXiuxian = xiuxianKeywords.some(k => allText.includes(k));

  if (isXiuxian || entryCount > 30) {
    // 修仙/大型世界观 → 人生履历法
    descStyle.value = 'resume';
  } else if (entryCount > 10 || hasEntryContent) {
    // 有较多世界书 → 多维度分离
    descStyle.value = 'detailed';
  } else if (entries.some(e => e.content && /[\w]+:/.test(e.content))) {
    // 世界书用YAML格式 → YAML结构化
    descStyle.value = 'yaml';
  } else {
    descStyle.value = 'narrative';
  }
});

// Expand mode
const npcInput = reactive({
  name: '', gender: '', age: '', role: '',
  personality: '', appearance: '', relationship: '', extra: ''
});

function buildStyleInstruction() {
  if (descStyle.value === 'yaml') return '使用YAML结构化格式描述（姓名、年龄、身份、外貌、性格、背景、说话方式等字段）';
  if (descStyle.value === 'detailed') return '使用多维度分离描写格式（分【外表维度】【身份维度】【性格维度】【互动模式】等段落）';
  if (descStyle.value === 'resume') return '使用人生履历法：按人生阶段（童年0-7→青少年8-15→当前）描述经历，然后列出核心特质、条件特质（特定场景触发）、隐性特征。让AI更容易维持人设并推断行为逻辑';
  return '使用自然语言叙述体描述角色';
}

async function handleAutoGenerate() {
  if (!apiStore.isConfigured) {
    appStore.toastError('请先在 API 设置中配置 API Key');
    return;
  }

  generating.value = true;
  try {
    const cardContext = buildCardContext(cardStore);
    const prompt = `你是一个专业的SillyTavern角色卡NPC创作者。请生成${autoCount.value}个原创NPC角色。

【已有角色卡信息】
${cardContext}

${worldContext.value ? `额外世界观补充：${worldContext.value}` : ''}
${typePreference.value ? `角色类型偏好：${typePreference.value}` : ''}

${buildStyleInstruction()}

要求：
1. 每个角色需要包含：外貌特征、核心性格（含矛盾点）、背景故事、说话方式、与{{user}}的关系
2. 角色要有深度和矛盾性，不要写"完美"的角色
3. 给每个角色想2-3个可以作为世界书关键词的名字/称呼
4. 每个角色描述300-600字

请严格按以下JSON格式输出（确保是合法JSON数组）：
[
  {
    "name": "角色名",
    "keys": ["全名", "昵称", "称号"],
    "content": "角色完整描述内容"
  }
]

只输出JSON，不要其他文字。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是一个角色创作专家，擅长为SillyTavern创建有深度的NPC角色。始终输出合法的JSON格式。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.9 });

    // Parse JSON from response
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI 返回格式异常，请重试');
    const npcs = JSON.parse(jsonMatch[0]);
    generatedNpcs.value = npcs.map(n => ({ ...n, selected: true }));
    appStore.toastSuccess(`成功生成 ${npcs.length} 个NPC`);
  } catch (e) {
    appStore.toastError(`生成失败: ${e.message}`);
  } finally {
    generating.value = false;
  }
}

async function handleExpand() {
  if (!apiStore.isConfigured) {
    appStore.toastError('请先在 API 设置中配置 API Key');
    return;
  }

  generating.value = true;
  try {
    const info = Object.entries(npcInput).filter(([_, v]) => v).map(([k, v]) => {
      const labels = { name:'姓名', gender:'性别', age:'年龄', role:'身份/职业',
        personality:'性格关键词', appearance:'外貌要点', relationship:'与{{user}}的关系', extra:'额外信息' };
      return `${labels[k] || k}：${v}`;
    }).join('\n');

    const prompt = `你是一个专业的SillyTavern角色卡NPC创作者。请根据以下关键信息扩写一个完整的NPC角色描述。

关键信息：
${info}

【已有角色卡信息】
${buildCardContext(cardStore)}

${worldContext.value ? `额外世界观补充：${worldContext.value}` : ''}

${buildStyleInstruction()}

要求：
1. 基于给定的关键信息扩写，与已有世界观保持一致，保持一致性
2. 补充外貌细节、性格矛盾点、背景故事、说话方式和习惯动作
3. 角色要有深度，不要过于完美
4. 描述300-600字

请严格按以下JSON格式输出：
[
  {
    "name": "${npcInput.name}",
    "keys": ["全名", "可能的昵称或称号"],
    "content": "完整角色描述"
  }
]

只输出JSON，不要其他文字。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是一个角色创作专家。始终输出合法的JSON格式。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.8 });

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI 返回格式异常，请重试');
    const npcs = JSON.parse(jsonMatch[0]);
    generatedNpcs.value = npcs.map(n => ({ ...n, selected: true }));
    appStore.toastSuccess('角色生成完成');
  } catch (e) {
    appStore.toastError(`生成失败: ${e.message}`);
  } finally {
    generating.value = false;
  }
}

function injectToWorldBook() {
  const selected = generatedNpcs.value.filter(n => n.selected);
  if (selected.length === 0) {
    appStore.toastWarning('请至少选中一个NPC');
    return;
  }

  let totalEntries = 0;
  for (const npc of selected) {
    // 1. 角色详情条目（主条目）
    const entry = cardStore.addWorldEntry();
    entry.comment = npc.name;
    entry.keys = npc.keys || [npc.name];
    entry.content = npc.content;
    entry.constant = false;
    entry.enabled = true;
    entry.position = 'before_char';
    entry.insertion_order = 60;
    totalEntries++;

    // 2. 角色关键信息条目（D4深度，确保中途出场保持人设）
    const keyEntry = cardStore.addWorldEntry();
    keyEntry.comment = `${npc.name}-关键信息`;
    keyEntry.keys = npc.keys || [npc.name];
    keyEntry.content = `【${npc.name}关键信息】请保持${npc.name}的核心人设和说话方式一致。`;
    keyEntry.constant = false;
    keyEntry.enabled = true;
    keyEntry.position = 'before_char';
    keyEntry.insertion_order = 200;
    keyEntry.extensions.depth = 4;
    totalEntries++;
  }

  // 3. 角色列表条目（蓝灯常驻，D2深度）
  if (selected.length > 1) {
    const listEntry = cardStore.addWorldEntry();
    listEntry.comment = '角色列表';
    listEntry.content = '存在以下主要角色：\n' + selected.map(n => `  ${n.name}: ${(n.content || '').slice(0, 50)}...`).join('\n');
    listEntry.constant = true;
    listEntry.enabled = true;
    listEntry.position = 'before_char';
    listEntry.insertion_order = 300;
    listEntry.extensions.depth = 2;
    totalEntries++;
  }

  appStore.toastSuccess(`已注入 ${totalEntries} 条世界书条目（含详情+关键信息+角色列表）`);
}
</script>

<style scoped>
.npc-result {
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 16px;
  margin-bottom: 12px;
}
.npc-result h4 { font-size: 15px; color: var(--cf-accent); }
.npc-result__keys { margin-bottom: 12px; }
.npc-result__content {
  font-size: 13px;
  line-height: 1.7;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--cf-font);
  background: none;
  border: none;
  margin: 0;
}

.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

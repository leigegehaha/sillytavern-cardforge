<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>额外需求</h1>
        <p>快速补充通用规则 — 勾选你需要的规则，一键写入 system_prompt</p>
      </div>
      <button class="btn btn--primary" @click="applyRules">应用到角色卡</button>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        不用自己写 system_prompt，在这里勾选你需要的规则就行：<br>
        · <strong>回复格式</strong> — 控制 AI 回复的长度、视角、动作描写格式<br>
        · <strong>行为约束</strong> — 禁止 AI 替玩家做决定、要求 NPC 有自己的意志<br>
        · <strong>世界规则</strong> — 时间推进、天气变化、经济系统等<br>
        · 勾选后底部会实时预览生成的文本，点「应用到角色卡」写入 system_prompt
      </div>
    </div>

    <!-- 回复格式 -->
    <div class="card mb-md">
      <div class="card__header"><h3>回复格式</h3></div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>回复长度</label>
            <select class="select" v-model="rules.replyLength">
              <option value="">不限制</option>
              <option value="short">简短（200-500字）</option>
              <option value="medium">适中（500-1000字）</option>
              <option value="long">详细（800-1500字）</option>
              <option value="very_long">超长（1500-3000字）</option>
            </select>
          </div>
          <div class="form-group">
            <label>叙述视角</label>
            <select class="select" v-model="rules.perspective">
              <option value="">不限制</option>
              <option value="third">第三人称</option>
              <option value="first_char">第一人称（角色视角）</option>
              <option value="second">第二人称（你）</option>
            </select>
          </div>
        </div>
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in formatRules" :key="r.id">
            <input type="checkbox" v-model="rules.format" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- 行为约束 -->
    <div class="card mb-md">
      <div class="card__header"><h3>行为约束</h3></div>
      <div class="card__body">
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in behaviorRules" :key="r.id">
            <input type="checkbox" v-model="rules.behavior" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- 世界规则 -->
    <div class="card mb-md">
      <div class="card__header"><h3>世界规则</h3></div>
      <div class="card__body">
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in worldRules" :key="r.id">
            <input type="checkbox" v-model="rules.world" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- AI输出格式 -->
    <div class="card mb-md">
      <div class="card__header"><h3>AI 输出格式</h3></div>
      <div class="card__body">
        <div class="rule-checks">
          <label class="toggle-label" v-for="r in outputRules" :key="r.id">
            <input type="checkbox" v-model="rules.output" :value="r.id"> {{ r.label }}
          </label>
        </div>
      </div>
    </div>

    <!-- 语言风格 -->
    <div class="card mb-md">
      <div class="card__header"><h3>语言与风格</h3></div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>语言</label>
            <select class="select" v-model="rules.language">
              <option value="">不限制</option>
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="jp">日本語</option>
              <option value="mixed">中日混合</option>
            </select>
          </div>
          <div class="form-group">
            <label>写作风格</label>
            <select class="select" v-model="rules.writingStyle">
              <option value="">不限制</option>
              <option value="literary">文学/散文风</option>
              <option value="light_novel">轻小说风</option>
              <option value="web_novel">网文风</option>
              <option value="screenplay">剧本风</option>
              <option value="poetic">诗意/意识流</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义补充 -->
    <div class="card mb-md">
      <div class="card__header"><h3>自定义补充</h3></div>
      <div class="card__body">
        <div class="form-group">
          <label>其他规则（自由填写）</label>
          <textarea class="textarea" v-model="rules.custom" rows="4"
            placeholder="任何额外的规则或要求...&#10;如：战斗场景需要掷骰判定、NPC有自己的日程表、每次回复末尾附加状态栏"></textarea>
        </div>
      </div>
    </div>

    <!-- 预览 -->
    <div class="card">
      <div class="card__header flex-between">
        <h3>预览生成内容</h3>
        <span class="badge badge--info">{{ generatedText.length }} 字</span>
      </div>
      <div class="card__body">
        <pre class="preview selectable">{{ generatedText || '（勾选上方规则后这里会显示预览）' }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const appStore = useAppStore();

const rules = reactive({
  replyLength: '',
  perspective: '',
  format: [],
  behavior: [],
  world: [],
  output: [],
  language: '',
  writingStyle: '',
  custom: ''
});

const formatRules = [
  { id: 'action_asterisk', label: '动作描写用 *星号* 包裹' },
  { id: 'dialogue_quotes', label: '对话用「」或""包裹' },
  { id: 'inner_thought', label: '内心独白用（括号）包裹' },
  { id: 'scene_desc', label: '每次回复开头描写环境/氛围' },
  { id: 'no_summary', label: '不要在回复末尾总结' },
  { id: 'sensory', label: '注重五感描写（视觉、听觉、触觉、嗅觉、味觉）' }
];

const behaviorRules = [
  { id: 'no_control_user', label: '绝对不要扮演{{user}}或替{{user}}做决定' },
  { id: 'no_perfect', label: 'NPC不是完美的，要有缺点和矛盾' },
  { id: 'npc_autonomy', label: 'NPC有自己的意志和日程，不会无条件帮助玩家' },
  { id: 'consequence', label: '行动有后果，不要让玩家无代价地获得好处' },
  { id: 'realistic_reaction', label: 'NPC的反应要符合其性格，不要突然变性格' },
  { id: 'no_rush', label: '感情发展要循序渐进，不能一见钟情' },
  { id: 'fail_possible', label: '允许失败，困难的事情不一定能成功' },
  { id: 'mature_content', label: '允许成人内容，不要回避或淡化' }
];

const worldRules = [
  { id: 'time_flow', label: '时间正常推进（早中晚、日期变化）' },
  { id: 'weather', label: '天气随时间和季节变化' },
  { id: 'economy', label: '经济系统真实（物品有价格，金钱会消耗）' },
  { id: 'npc_schedule', label: 'NPC在不同时间段出现在不同地点' },
  { id: 'world_events', label: '世界会发生与玩家无关的事件' },
  { id: 'power_balance', label: '实力有等级差距，低级无法轻易击败高级' },
  { id: 'dice_roll', label: '关键行动需要掷骰判定（{{roll 1d100}}）' }
];

const outputRules = [
  { id: 'analysis', label: '要求AI输出思维链 <Analysis>（分析剧情逻辑后再回复）' },
  { id: 'variable_update', label: '要求AI输出变量更新 <UpdateVariable>（MVU系统必需）' },
  { id: 'status_placeholder', label: '要求AI输出状态栏占位符 <StatusPlaceHolderImpl/>（状态栏必需）' },
  { id: 'cot_english', label: '思维链使用英文输出（节省Token）' }
];

const lengthMap = { short: '200-500', medium: '500-1000', long: '800-1500', very_long: '1500-3000' };
const perspectiveMap = { third: '第三人称叙述', first_char: '第一人称（角色视角）', second: '第二人称' };
const langMap = { zh: '使用中文回复', en: 'Reply in English', jp: '日本語で返信してください', mixed: '中日混合（日语对话+中文叙述）' };
const styleMap = { literary: '文学散文风格，注重意境和修辞', light_novel: '轻小说风格，轻松活泼', web_novel: '网文风格，节奏明快，爽点密集', screenplay: '剧本风格，以对话为主', poetic: '诗意风格，意识流描写' };

const generatedText = computed(() => {
  const lines = [];

  if (rules.replyLength) lines.push(`每次回复控制在${lengthMap[rules.replyLength]}字。`);
  if (rules.perspective) lines.push(`使用${perspectiveMap[rules.perspective]}视角叙述。`);
  if (rules.language) lines.push(langMap[rules.language] + '。');
  if (rules.writingStyle) lines.push(styleMap[rules.writingStyle] + '。');

  const formatTexts = {
    action_asterisk: '动作描写用 *星号* 包裹。',
    dialogue_quotes: '角色对话用「」包裹。',
    inner_thought: '角色内心独白用（括号）包裹。',
    scene_desc: '每次回复开头用1-2句描写当前环境和氛围。',
    no_summary: '不要在回复末尾总结或复述刚才发生的事。',
    sensory: '描写要注重五感细节（视觉、听觉、触觉、嗅觉、味觉）。'
  };
  rules.format.forEach(id => { if (formatTexts[id]) lines.push(formatTexts[id]); });

  const behaviorTexts = {
    no_control_user: '绝对不要扮演{{user}}，不要替{{user}}说话、做决定或描写{{user}}的内心想法。',
    no_perfect: 'NPC不是完美的角色，每个NPC都应该有缺点、矛盾和不理性的一面。',
    npc_autonomy: 'NPC有自己的意志、日程和目标，不会无条件帮助或听从{{user}}。',
    consequence: '所有行动都有相应的后果和代价，不存在无风险的选择。',
    realistic_reaction: 'NPC的情绪反应必须符合其性格设定，不能突然变化。',
    no_rush: '感情和信任的建立需要时间和互动积累，不能一蹴而就。',
    fail_possible: '困难的行动有失败的可能性，失败时要描写失败的过程和后果。',
    mature_content: '不要回避或淡化成人内容，按照场景需要自然描写。'
  };
  rules.behavior.forEach(id => { if (behaviorTexts[id]) lines.push(behaviorTexts[id]); });

  const worldTexts = {
    time_flow: '时间按正常节奏推进，包括早中晚变化和日期更替。',
    weather: '天气随时间和季节自然变化，影响角色行为和环境描写。',
    economy: '经济系统真实运作，物品有合理价格，金钱会随消费减少。',
    npc_schedule: 'NPC在不同时间段会出现在不同地点，有自己的生活节奏。',
    world_events: '世界会发生与{{user}}无关的背景事件，增加世界的真实感。',
    power_balance: '实力存在等级差距，低等级角色无法轻易战胜高等级存在。',
    dice_roll: '关键行动（战斗、技能检定等）使用掷骰判定：{{roll 1d100}}，结果>50为成功。'
  };
  rules.world.forEach(id => { if (worldTexts[id]) lines.push(worldTexts[id]); });

  const outputTexts = {
    analysis: '每次回复前，先在 <Analysis> 标签中分析当前剧情逻辑、NPC反应、变量变化，然后再输出正文。',
    variable_update: '每次回复末尾，必须在 <UpdateVariable> 标签中输出变量更新命令。',
    status_placeholder: '每次回复末尾，必须输出 <StatusPlaceHolderImpl/> 占位符。',
    cot_english: 'Analysis部分请使用英文输出以节省Token。'
  };
  rules.output.forEach(id => { if (outputTexts[id]) lines.push(outputTexts[id]); });

  if (rules.custom) lines.push(rules.custom);

  return lines.join('\n');
});

function applyRules() {
  if (!generatedText.value) { appStore.toastWarning('请先勾选至少一条规则'); return; }

  // 写入 system_prompt
  const existing = cardStore.cardData.system_prompt || '';
  const marker = '【CardForge 额外需求】';
  const cleaned = existing.includes(marker) ? existing.split(marker)[0].trim() : existing;
  cardStore.cardData.system_prompt = cleaned + (cleaned ? '\n\n' : '') + marker + '\n' + generatedText.value;
  cardStore.markDirty();
  appStore.toastSuccess('已应用到 system_prompt（' + generatedText.value.split('\n').length + ' 条规则）');
}
</script>

<style scoped>
.rule-checks {
  display: flex; flex-direction: column; gap: 10px;
}
.toggle-label {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary); line-height: 1.5;
  input { accent-color: var(--cf-accent); margin-top: 3px; }
}
.preview {
  font-size: 13px; line-height: 1.7; color: var(--cf-text-primary);
  white-space: pre-wrap; font-family: var(--cf-font); background: none; border: none; margin: 0;
}
</style>

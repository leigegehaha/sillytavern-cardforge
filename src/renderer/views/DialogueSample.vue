<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>对话样本 &amp; 角色采访</h1>
        <p>AI 帮你生成对话示例和深度角色设定</p>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        · <strong>对话样本</strong> — AI 帮你写 mes_example（对话示例），教 AI 学会角色的说话风格和小动作<br>
        · <strong>角色采访</strong> — AI 以采访者身份向角色提问，挖掘角色深层性格，结果可补充到 description 或 mes_example<br>
        · 生成前请先在「基本信息」和「角色设定」里填好角色名和基本性格
      </div>
    </div>

    <div class="tabs">
      <div :class="['tabs__item', { active: tab === 'sample' }]" @click="tab = 'sample'">对话样本生成</div>
      <div :class="['tabs__item', { active: tab === 'interview' }]" @click="tab = 'interview'">角色采访</div>
    </div>

    <!-- 对话样本 -->
    <div v-if="tab === 'sample'">
      <div class="card mb-md">
        <div class="card__header"><h3>生成对话样本</h3></div>
        <div class="card__body">
          <p class="hint mb-md">AI 会根据角色的性格和说话方式，自动生成对话示例（mes_example），让 AI 学会角色的语感</p>
          <div class="grid-2">
            <div class="form-group">
              <label>生成场景数量</label>
              <select class="select" v-model="sampleCount">
                <option :value="3">3 组场景</option>
                <option :value="5">5 组场景</option>
                <option :value="8">8 组场景</option>
              </select>
            </div>
            <div class="form-group">
              <label>场景类型</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                <label class="toggle-label" v-for="s in sceneTypes" :key="s.value">
                  <input type="checkbox" v-model="selectedScenes" :value="s.value"> {{ s.label }}
                </label>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>额外要求</label>
            <input class="input" v-model="sampleExtra" placeholder="如：要体现角色的傲娇属性、要有打斗场景的对话">
          </div>
          <button class="btn btn--primary" style="width:100%" :disabled="generating || !cardStore.cardData.name"
            @click="generateSamples">
            {{ generating ? '生成中...' : '生成对话样本' }}
          </button>
        </div>
      </div>

      <div v-if="sampleResult" class="card">
        <div class="card__header flex-between">
          <h3>生成结果</h3>
          <button class="btn btn--primary btn--sm" @click="injectSamples">写入 mes_example</button>
        </div>
        <div class="card__body">
          <pre class="result-text selectable">{{ sampleResult }}</pre>
        </div>
      </div>
    </div>

    <!-- 角色采访 -->
    <div v-if="tab === 'interview'">
      <div class="card mb-md">
        <div class="card__header"><h3>角色深度采访</h3></div>
        <div class="card__body">
          <p class="hint mb-md">AI 会以采访者的身份向角色提问，角色以自己的性格回答。用于挖掘角色深层性格，生成的内容可以补充到 description 或 mes_example</p>
          <div class="grid-2">
            <div class="form-group">
              <label>采访深度</label>
              <select class="select" v-model="interviewDepth">
                <option value="light">轻度（5个问题）— 日常喜好、基本态度</option>
                <option value="medium">中度（10个问题）— 含内心世界、过去经历</option>
                <option value="deep">深度（15个问题）— 含哲学思考、秘密、矛盾</option>
              </select>
            </div>
            <div class="form-group">
              <label>采访主题</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                <label class="toggle-label" v-for="t in interviewTopics" :key="t.value">
                  <input type="checkbox" v-model="selectedTopics" :value="t.value"> {{ t.label }}
                </label>
              </div>
            </div>
          </div>
          <button class="btn btn--primary" style="width:100%" :disabled="generating || !cardStore.cardData.name"
            @click="generateInterview">
            {{ generating ? '采访中...' : '开始角色采访' }}
          </button>
        </div>
      </div>

      <div v-if="interviewResult" class="card">
        <div class="card__header flex-between">
          <h3>采访记录</h3>
          <div class="flex-row">
            <button class="btn btn--secondary btn--sm" @click="injectToDescription">补充到 description</button>
            <button class="btn btn--primary btn--sm" @click="injectToMesExample">补充到 mes_example</button>
          </div>
        </div>
        <div class="card__body">
          <pre class="result-text selectable">{{ interviewResult }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const tab = ref('sample');
const generating = ref(false);

// 对话样本
const sampleCount = ref(5);
const sampleExtra = ref('');
const sampleResult = ref('');
const selectedScenes = ref(['daily', 'emotion', 'conflict']);
const sceneTypes = [
  { value: 'daily', label: '日常闲聊' },
  { value: 'emotion', label: '情感互动' },
  { value: 'conflict', label: '矛盾冲突' },
  { value: 'humor', label: '幽默搞笑' },
  { value: 'serious', label: '严肃正经' },
  { value: 'secret', label: '秘密/隐私' },
  { value: 'action', label: '动作/战斗' },
  { value: 'romance', label: '浪漫暧昧' }
];

// 角色采访
const interviewDepth = ref('medium');
const interviewResult = ref('');
const selectedTopics = ref(['personality', 'daily', 'relationship']);
const interviewTopics = [
  { value: 'personality', label: '性格内心' },
  { value: 'daily', label: '日常习惯' },
  { value: 'relationship', label: '人际关系' },
  { value: 'past', label: '过去经历' },
  { value: 'dream', label: '梦想恐惧' },
  { value: 'philosophy', label: '价值观' },
  { value: 'secret', label: '秘密矛盾' },
  { value: 'combat', label: '战斗能力' }
];

async function generateSamples() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  const d = cardStore.cardData;
  if (!d.name) { appStore.toastError('请先填写角色名称'); return; }

  generating.value = true;
  try {
    const scenes = selectedScenes.value.map(v => sceneTypes.find(s => s.value === v)?.label).filter(Boolean);
    const prompt = `你是 SillyTavern 对话样本专家。请为以下角色生成 ${sampleCount.value} 组对话示例。

角色名：${d.name}
性格：${d.personality || '(未填)'}
描述：${(d.description || '').slice(0, 500) || '(未填)'}
场景设定：${d.scenario || '(未填)'}

要求：
1. 生成 ${sampleCount.value} 组不同场景的对话
2. 场景类型包含：${scenes.join('、')}
3. 每组用 <START> 分隔
4. 用 {{user}} 代表用户，{{char}} 代表角色
5. {{char}} 的回复要包含动作描写（用 *星号* 包裹）和对话
6. 每组 {{user}} 说 1 句，{{char}} 回复 3-5 句（含动作和对话交替）
7. 要充分体现角色的说话风格、性格特点和小动作
${sampleExtra.value ? '8. 额外要求：' + sampleExtra.value : ''}

直接输出对话内容，不要加任何说明文字。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是专业的角色卡对话样本撰写专家，擅长写出有角色特色的对话示例。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.85, maxTokens: 4096 });

    sampleResult.value = result;
    appStore.toastSuccess('对话样本生成完成');
  } catch (e) {
    appStore.toastError('生成失败: ' + e.message);
  } finally { generating.value = false; }
}

async function generateInterview() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  const d = cardStore.cardData;
  if (!d.name) { appStore.toastError('请先填写角色名称'); return; }

  generating.value = true;
  try {
    const topics = selectedTopics.value.map(v => interviewTopics.find(t => t.value === v)?.label).filter(Boolean);
    const qCount = interviewDepth.value === 'light' ? 5 : interviewDepth.value === 'medium' ? 10 : 15;

    const prompt = `你是一位角色采访记者。现在要采访一个虚构角色来深入了解 TA 的内心世界。

角色名：${d.name}
已知性格：${d.personality || '(未填)'}
已知描述：${(d.description || '').slice(0, 500) || '(未填)'}
场景设定：${d.scenario || '(未填)'}

请进行 ${qCount} 个问题的采访，主题涵盖：${topics.join('、')}

格式要求：
- 每个问答用"Q:"开头提问，"A:"开头回答
- 角色回答时要完全保持 TA 的性格和说话方式
- 回答要包含动作描写（用 *星号* 包裹）
- 回答要自然真实，像真正的采访，不要太正式
- 通过回答挖掘出角色description中没有的新信息（新的小习惯、隐藏的想法、不为人知的一面）
- Q 的问题要逐渐深入，从轻松到私密

直接输出采访内容。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是专业的角色采访记者，擅长通过对话挖掘虚构角色的深层性格。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.9, maxTokens: 4096 });

    interviewResult.value = result;
    appStore.toastSuccess('角色采访完成');
  } catch (e) {
    appStore.toastError('采访失败: ' + e.message);
  } finally { generating.value = false; }
}

function injectSamples() {
  if (!sampleResult.value) return;
  const existing = cardStore.cardData.mes_example || '';
  cardStore.cardData.mes_example = existing + (existing ? '\n\n' : '') + sampleResult.value;
  cardStore.markDirty();
  appStore.toastSuccess('已写入 mes_example');
}

function injectToDescription() {
  if (!interviewResult.value) return;
  const existing = cardStore.cardData.description || '';
  cardStore.cardData.description = existing + (existing ? '\n\n' : '') + '【角色采访补充】\n' + interviewResult.value;
  cardStore.markDirty();
  appStore.toastSuccess('已补充到 description');
}

function injectToMesExample() {
  if (!interviewResult.value) return;
  // 把 Q/A 转成 mes_example 格式
  const lines = interviewResult.value.split('\n');
  let converted = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:') || trimmed.startsWith('Q：')) {
      converted += '\n<START>\n{{user}}: ' + trimmed.replace(/^Q[：:]\s*/, '') + '\n';
    } else if (trimmed.startsWith('A:') || trimmed.startsWith('A：')) {
      converted += '{{char}}: ' + trimmed.replace(/^A[：:]\s*/, '') + '\n';
    } else if (trimmed && converted) {
      converted += trimmed + '\n';
    }
  }
  const existing = cardStore.cardData.mes_example || '';
  cardStore.cardData.mes_example = existing + (existing ? '\n' : '') + converted.trim();
  cardStore.markDirty();
  appStore.toastSuccess('已转换并写入 mes_example');
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.result-text {
  font-size: 13px; line-height: 1.8; color: var(--cf-text-primary);
  white-space: pre-wrap; word-wrap: break-word;
  font-family: var(--cf-font); background: none; border: none; margin: 0;
  max-height: 500px; overflow-y: auto;
}
</style>

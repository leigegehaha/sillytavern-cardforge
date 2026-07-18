<template>
  <div class="cf-confirm-overlay step-overlay" @click.self="$emit('close')">
    <div class="step-dialog">
      <div class="step-dialog__header">
        <div class="flex-row">
          <span class="step-dialog__num">{{ step.n }}</span>
          <h3>{{ step.title }}</h3>
          <span v-if="step.required" class="badge badge--danger">必填</span>
        </div>
        <button class="btn btn--ghost btn--sm" @click="$emit('close')">✕</button>
      </div>

      <div class="step-dialog__body">
        <!-- user 类型：表单 -->
        <template v-if="step.type === 'user'">
          <template v-if="step.id === 'basic_info'">
            <div class="form-group">
              <label>角色名字 *</label>
              <input class="input" v-model="local.name" placeholder="角色名">
            </div>
            <div class="form-group">
              <label>角色描述 *</label>
              <textarea class="textarea" v-model="local.description" rows="6" placeholder="角色的核心设定、身份、外貌、背景等"></textarea>
            </div>
            <div class="form-group">
              <label>标签（逗号分隔）</label>
              <input class="input" :value="tagsText" @input="onTagsInput" placeholder="奇幻, 冒险, 恋爱">
            </div>
            <div class="form-group">
              <label>创作者备注</label>
              <input class="input" v-model="local.creator_notes" placeholder="可选">
            </div>
          </template>

          <template v-else-if="step.id === 'player'">
            <div class="hint mb-md">填写玩家角色信息，将追加到场景设定中。留空字段将被忽略。</div>
            <div class="form-group">
              <label>玩家名字</label>
              <input class="input" v-model="player.name" placeholder="玩家角色名">
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label>性别</label>
                <input class="input" v-model="player.gender">
              </div>
              <div class="form-group">
                <label>年龄</label>
                <input class="input" v-model="player.age">
              </div>
            </div>
            <div class="form-group">
              <label>外貌</label>
              <textarea class="textarea" v-model="player.appearance" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>性格</label>
              <textarea class="textarea" v-model="player.personality" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>背景</label>
              <textarea class="textarea" v-model="player.background" rows="3"></textarea>
            </div>
          </template>

          <template v-else-if="step.id === 'extra'">
            <div class="hint mb-md">额外需求将写入系统提示词。可填写对 AI 回复的格式、语言、行为等要求。</div>
            <div class="form-group">
              <label>额外需求</label>
              <textarea class="textarea" v-model="local.system_prompt" rows="8" placeholder="对 AI 的额外指令，如回复风格、禁止行为等"></textarea>
            </div>
          </template>
        </template>

        <!-- ai 类型：显示内容 + 生成按钮 -->
        <template v-else-if="step.type === 'ai'">
          <div class="form-group" v-for="f in step.fields" :key="f">
            <label>{{ fieldLabel(f) }}</label>
            <textarea class="textarea" v-model="local[f]" :rows="f === 'first_mes' ? 8 : 5" :placeholder="loading ? '生成中…' : '点下方按钮让 AI 生成，或手动填写'"></textarea>
          </div>
          <div class="flex-row mt-md">
            <button class="btn btn--accent btn--sm" @click="generate" :disabled="loading">
              {{ loading ? '生成中…' : (hasContent ? '重新生成' : 'AI 生成') }}
            </button>
            <span class="hint" v-if="lastError" style="color:var(--cf-danger)">{{ lastError }}</span>
          </div>
        </template>

        <!-- structured 类型：提示跳转 -->
        <template v-else-if="step.type === 'structured'">
          <div class="empty-state">
            <div class="empty-state__icon">⚙</div>
            <div class="empty-state__title">需要在高级模式中编辑</div>
            <div class="empty-state__desc">此步骤涉及结构化配置，请切换到高级模式的「{{ step.title }}」编辑页。</div>
          </div>
          <div class="flex-row mt-md" style="justify-content:center">
            <button class="btn btn--primary" @click="goAdvanced">切换到高级模式编辑</button>
          </div>
        </template>
      </div>

      <div class="step-dialog__footer" v-if="step.type !== 'structured'">
        <button class="btn btn--ghost" @click="$emit('close')">取消</button>
        <button class="btn btn--accent" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCardStore } from '../stores/card.js';
import { useBasicModeStore } from '../stores/basic-mode.js';
import { useAppStore } from '../stores/app.js';
import * as basicGen from '../stores/basic-gen.js';

const props = defineProps({ step: { type: Object, required: true } });
const emit = defineEmits(['close', 'saved']);
const router = useRouter();
const cardStore = useCardStore();
const basicMode = useBasicModeStore();
const appStore = useAppStore();

const d = cardStore.cardData.data;
const local = reactive({
  name: d.name || '',
  description: d.description || '',
  creator_notes: d.creator_notes || '',
  tags: [...(d.tags || [])],
  personality: d.personality || '',
  scenario: d.scenario || '',
  first_mes: d.first_mes || '',
  mes_example: d.mes_example || '',
  system_prompt: d.system_prompt || '',
});

const player = reactive({
  name: '', gender: '', age: '', appearance: '', personality: '', background: ''
});

const tagsText = computed(() => (local.tags || []).join(', '));
function onTagsInput(e) {
  local.tags = e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
}

const loading = ref(false);
const lastError = ref('');

const hasContent = computed(() => {
  return props.step.fields.some(f => {
    if (f === 'coverImage') return !!cardStore.coverImageBase64;
    return !!local[f];
  });
});

function fieldLabel(f) {
  const map = {
    personality: '性格摘要',
    scenario: '场景设定',
    first_mes: '开场白',
    mes_example: '对话样本',
  };
  return map[f] || f;
}

async function generate() {
  loading.value = true;
  lastError.value = '';
  try {
    const genMap = {
      char_setting: basicGen.genCharSetting,
      greeting: basicGen.genGreeting,
      cover_image: basicGen.genCoverImage,
      worldbook: basicGen.genWorldbook,
      npc: basicGen.genNpc,
      dialogue: basicGen.genDialogue,
    };
    const fn = genMap[props.step.id];
    if (!fn) throw new Error('该步骤不支持 AI 生成');
    await fn();
    // 生成后同步到 local
    local.personality = d.personality || '';
    local.scenario = d.scenario || '';
    local.first_mes = d.first_mes || '';
    local.mes_example = d.mes_example || '';
    appStore.toastSuccess(`${props.step.title} 已生成`);
    emit('saved');
  } catch (e) {
    lastError.value = e.message;
    appStore.toastError(e.message);
  } finally {
    loading.value = false;
  }
}

function save() {
  if (props.step.id === 'basic_info') {
    d.name = local.name;
    d.description = local.description;
    d.creator_notes = local.creator_notes;
    d.tags = [...local.tags];
  } else if (props.step.id === 'player') {
    // 追加到 scenario
    const lines = ['【玩家角色设定】'];
    if (player.name) lines.push(`姓名: ${player.name}`);
    if (player.gender) lines.push(`性别: ${player.gender}`);
    if (player.age) lines.push(`年龄: ${player.age}`);
    if (player.appearance) lines.push(`外貌: ${player.appearance}`);
    if (player.personality) lines.push(`性格: ${player.personality}`);
    if (player.background) lines.push(`背景: ${player.background}`);
    const block = lines.join('\n');
    if (d.scenario && d.scenario.includes('【玩家角色设定】')) {
      d.scenario = d.scenario.replace(/【玩家角色设定】[\s\S]*$/, block);
    } else {
      d.scenario = (d.scenario ? d.scenario + '\n\n' : '') + block;
    }
  } else if (props.step.id === 'extra') {
    d.system_prompt = local.system_prompt;
  } else {
    // ai 类型：保存编辑后的内容
    props.step.fields.forEach(f => {
      if (f === 'coverImage') return;
      if (local[f] !== undefined) d[f] = local[f];
    });
  }
  cardStore.markDirty();
  appStore.toastSuccess('已保存');
  emit('saved');
}

function goAdvanced() {
  basicMode.setMode('advanced');
  emit('close');
  if (props.step.route) router.push(props.step.route);
}
</script>

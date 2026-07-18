import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useCardStore } from './card.js';

const MODE_KEY = 'cardforge_ui_mode';
const ADV_KEY = 'cardforge_advanced_enabled';

// 步骤定义
export const STEP_DEFS = [
  { id: 'basic_info', title: '角色基础信息', type: 'user', required: true, advanced: false,
    fields: ['name', 'description', 'tags', 'creator_notes'] },
  { id: 'char_setting', title: '角色设定', type: 'ai', advanced: false,
    fields: ['personality', 'scenario'] },
  { id: 'greeting', title: '开场白', type: 'ai', advanced: false,
    fields: ['first_mes'] },
  { id: 'cover_image', title: '角色卡图片', type: 'ai', advanced: false,
    fields: ['coverImage'] },
  { id: 'player', title: '玩家角色', type: 'user', advanced: true,
    fields: ['scenario'] },
  { id: 'worldbook', title: '世界书', type: 'ai', advanced: true,
    fields: ['character_book.entries'] },
  { id: 'npc', title: 'NPC', type: 'ai', advanced: true,
    fields: ['character_book.entries'] },
  { id: 'dialogue', title: '对话样本', type: 'ai', advanced: true,
    fields: ['mes_example'] },
  { id: 'extra', title: '额外需求', type: 'user', advanced: true,
    fields: ['system_prompt'] },
  { id: 'mvu', title: 'MVU 变量', type: 'structured', advanced: true, route: '/mvu' },
  { id: 'regex', title: '正则脚本', type: 'structured', advanced: true, route: '/regex' },
  { id: 'script', title: '酒馆助手脚本', type: 'structured', advanced: true, route: '/script' },
  { id: 'ejs', title: 'EJS 模板', type: 'structured', advanced: true, route: '/ejs' },
  { id: 'statusbar', title: '前端状态栏', type: 'structured', advanced: true, route: '/statusbar' },
];

export const useBasicModeStore = defineStore('basicMode', () => {
  const mode = ref(localStorage.getItem(MODE_KEY) || 'basic');
  // 高级特性勾选状态
  const advancedEnabled = ref({});
  try {
    const saved = localStorage.getItem(ADV_KEY);
    if (saved) advancedEnabled.value = JSON.parse(saved);
  } catch (e) {}

  function setMode(m) {
    mode.value = m;
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
  }

  function toggleAdvanced(id) {
    advancedEnabled.value[id] = !advancedEnabled.value[id];
    try { localStorage.setItem(ADV_KEY, JSON.stringify(advancedEnabled.value)); } catch (e) {}
  }

  function isAdvancedEnabled(id) {
    return !!advancedEnabled.value[id];
  }

  // 当前启用的步骤：基础4步 + 勾选的高级步骤
  const activeSteps = computed(() => {
    return STEP_DEFS.filter(s => !s.advanced || isAdvancedEnabled(s.id));
  });

  // 高级步骤定义（用于勾选区）
  const advancedSteps = computed(() => STEP_DEFS.filter(s => s.advanced));

  // 步骤状态：pending/filled/generated
  function stepStatus(stepId) {
    const cardStore = useCardStore();
    const d = cardStore.cardData.data;
    const has = (v) => {
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return String(v).trim().length > 0;
    };
    switch (stepId) {
      case 'basic_info':
        return has(d.name) && has(d.description) ? 'filled' : 'pending';
      case 'char_setting':
        return has(d.personality) || has(d.scenario) ? 'filled' : 'pending';
      case 'greeting':
        return has(d.first_mes) ? 'filled' : 'pending';
      case 'cover_image':
        return has(cardStore.coverImageBase64) ? 'filled' : 'pending';
      case 'player':
        return has(d.scenario) && d.scenario.includes('玩家角色') ? 'filled' : 'pending';
      case 'worldbook':
      case 'npc':
        return has(d.character_book?.entries) ? 'filled' : 'pending';
      case 'dialogue':
        return has(d.mes_example) ? 'filled' : 'pending';
      case 'extra':
        return has(d.system_prompt) ? 'filled' : 'pending';
      case 'mvu':
        return has(d.extensions?.cfMvuVarGroups) ? 'filled' : 'pending';
      case 'regex':
        return has(d.extensions?.regex_scripts) ? 'filled' : 'pending';
      case 'script':
        return has(d.extensions?.tavern_helper?.scripts) ? 'filled' : 'pending';
      case 'ejs':
        // EJS 写入 character_book entries，难独立判断，按 entries 里是否有 EJS 标记
        return d.character_book?.entries?.some(e => (e.content || '').includes('<%')) ? 'filled' : 'pending';
      case 'statusbar':
        return d.extensions?.regex_scripts?.some(r => (r.scriptName || '').includes('状态栏')) ? 'filled' : 'pending';
      default:
        return 'pending';
    }
  }

  // 完成度
  const completion = computed(() => {
    const steps = activeSteps.value;
    let done = 0;
    for (const s of steps) {
      if (stepStatus(s.id) !== 'pending') done++;
    }
    return { done, total: steps.length };
  });

  // 一键生成是否可用（步骤1必填已完成）
  const canGenerateAll = computed(() => {
    return stepStatus('basic_info') === 'filled';
  });

  return {
    mode, advancedEnabled, activeSteps, advancedSteps, completion, canGenerateAll,
    setMode, toggleAdvanced, isAdvancedEnabled, stepStatus,
  };
});

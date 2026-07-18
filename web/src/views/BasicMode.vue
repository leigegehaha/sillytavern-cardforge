<template>
  <div class="basic-mode">
    <div class="basic-mode__inner">
      <!-- 角色卡可视化预览 -->
      <div class="character-preview">
        <div class="character-preview__cover">
          <img v-if="cardStore.coverImageBase64" :src="cardStore.coverImageBase64" alt="封面">
          <div v-else class="character-preview__placeholder">
            <span>无封面</span>
          </div>
        </div>
        <div class="character-preview__info">
          <div class="flex-between mb-md">
            <h2 class="character-preview__name">{{ cardStore.cardData.data.name || '未命名角色' }}</h2>
            <span class="badge" :class="completionBadge">{{ completion.done }}/{{ completion.total }} 步</span>
          </div>
          <p class="character-preview__desc">{{ cardStore.cardData.data.description || '尚未填写描述' }}</p>
          <div class="character-preview__tags" v-if="cardStore.cardData.data.tags?.length">
            <span class="badge badge--info" v-for="t in cardStore.cardData.data.tags" :key="t">{{ t }}</span>
          </div>
        </div>
      </div>

      <!-- 步骤列表 -->
      <div class="step-list">
        <div v-for="(step, idx) in basicMode.activeSteps" :key="step.id"
          class="step-item" :class="'step-item--' + statusOf(step.id)" @click="openStep(step, idx)">
          <span class="step-item__num">{{ idx + 1 }}</span>
          <div class="step-item__main">
            <div class="flex-row">
              <span class="step-item__title">{{ step.title }}</span>
              <span v-if="step.required" class="step-item__required">*</span>
              <span v-if="step.advanced" class="badge badge--info">高级</span>
            </div>
            <span class="step-item__status">{{ statusText(step.id, step.type) }}</span>
          </div>
          <span class="step-item__arrow">›</span>
        </div>
      </div>

      <!-- 高级特性勾选 -->
      <div class="advanced-toggle">
        <div class="advanced-toggle__title">高级特性（勾选后追加步骤）</div>
        <div class="advanced-toggle__grid">
          <label v-for="s in basicMode.advancedSteps" :key="s.id" class="advanced-toggle__item">
            <input type="checkbox" :checked="basicMode.isAdvancedEnabled(s.id)" @change="basicMode.toggleAdvanced(s.id)">
            <span>{{ s.title }}</span>
          </label>
        </div>
      </div>

      <!-- 一键生成 -->
      <div class="gen-all-area">
        <button class="btn btn--accent gen-all-btn" @click="generateAll"
          :disabled="!basicMode.canGenerateAll || genAllLoading">
          {{ genAllLoading ? `生成中… (${genAllProgress}/${genAllTotal})` : '一键生成 AI 内容' }}
        </button>
        <p class="hint" v-if="!basicMode.canGenerateAll">请先完成「角色基础信息」步骤</p>
        <p class="hint" v-else>将依次生成：角色设定、开场白、图片{{ hasWorldbook ? '、世界书' : '' }}{{ hasNpc ? '、NPC' : '' }}{{ hasDialogue ? '、对话样本' : '' }}</p>
      </div>

      <!-- 导出 -->
      <div class="export-area">
        <button class="btn btn--primary" @click="cardStore.exportPngV3()" :disabled="!cardStore.coverImageBase64">导出 V3 角色卡</button>
        <button class="btn btn--secondary" @click="cardStore.exportPng()" :disabled="!cardStore.coverImageBase64">导出 V2</button>
        <button class="btn btn--ghost" @click="cardStore.exportJson()">导出 JSON</button>
      </div>
    </div>

    <!-- 步骤对话框 -->
    <StepDialog v-if="currentStep" :step="currentStep" @close="currentStep = null" @saved="onStepSaved" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useBasicModeStore } from '../stores/basic-mode.js';
import { useAppStore } from '../stores/app.js';
import * as basicGen from '../stores/basic-gen.js';
import StepDialog from '../components/StepDialog.vue';

const cardStore = useCardStore();
const basicMode = useBasicModeStore();
const appStore = useAppStore();

const currentStep = ref(null);
const genAllLoading = ref(false);
const genAllProgress = ref(0);
const genAllTotal = ref(0);

function statusOf(id) {
  return basicMode.stepStatus(id);
}

function statusText(id, type) {
  const s = basicMode.stepStatus(id);
  if (s === 'filled') return type === 'ai' ? '已生成' : '已填写';
  return type === 'ai' ? '未生成' : '未填写';
}

const completion = computed(() => basicMode.completion);
const completionBadge = computed(() => {
  const { done, total } = basicMode.completion;
  if (done === total) return 'badge--success';
  if (done > 0) return 'badge--warning';
  return 'badge--danger';
});

const hasWorldbook = computed(() => basicMode.isAdvancedEnabled('worldbook'));
const hasNpc = computed(() => basicMode.isAdvancedEnabled('npc'));
const hasDialogue = computed(() => basicMode.isAdvancedEnabled('dialogue'));

function openStep(step, idx) {
  currentStep.value = { ...step, n: idx + 1 };
}

function onStepSaved() {
  currentStep.value = null;
}

async function generateAll() {
  const aiSteps = basicMode.activeSteps.value
    .filter(s => s.type === 'ai')
    .map(s => s.id);
  genAllTotal.value = aiSteps.length;
  genAllProgress.value = 0;
  genAllLoading.value = true;
  try {
    await basicGen.generateAll(aiSteps, (id, status) => {
      if (status === 'ok' || status === 'fail') genAllProgress.value++;
    });
    appStore.toastSuccess('一键生成完成');
  } catch (e) {
    appStore.toastError('生成中断: ' + e.message);
  } finally {
    genAllLoading.value = false;
  }
}
</script>

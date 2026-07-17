<template>
  <div class="page">
    <div class="page__header">
      <h1>图片生成</h1>
      <p>根据角色卡信息 AI 生成封面图，选定后可导出 V3 角色卡</p>
    </div>

    <!-- 当前角色卡摘要 -->
    <div class="card">
      <div class="card__header"><h3>当前角色卡</h3></div>
      <div class="card__body">
        <div class="flex-row" style="gap:16px;align-items:flex-start">
          <div v-if="cardStore.coverImageBase64" class="imggen-current-cover">
            <img :src="cardStore.coverImageBase64" alt="当前封面" />
          </div>
          <div style="flex:1">
            <div class="mb-md"><strong>名字：</strong>{{ cardStore.cardData.data.name || '未命名' }}</div>
            <div class="hint" style="max-height:80px;overflow:auto">{{ cardStore.cardData.data.description || '无描述' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示词生成 -->
    <div class="card">
      <div class="card__header">
        <h3>图片提示词</h3>
        <button class="btn btn--sm btn--accent" @click="genPrompt" :disabled="genPromptLoading">
          {{ genPromptLoading ? '生成中…' : 'AI 生成提示词' }}
        </button>
      </div>
      <div class="card__body">
        <div class="form-group">
          <label>中文提示词（可编辑）</label>
          <textarea class="textarea" v-model="chinesePrompt" rows="4" placeholder="点上方按钮让 AI 根据角色卡生成，或手动填写"></textarea>
        </div>
        <div class="flex-row mb-md">
          <button class="btn btn--sm btn--ghost" @click="translate" :disabled="translateLoading || !chinesePrompt">
            {{ translateLoading ? '翻译中…' : '翻译成英文' }}
          </button>
        </div>
        <div class="form-group">
          <label>英文提示词（用于生成图片，可编辑）</label>
          <textarea class="textarea" v-model="englishPrompt" rows="4" placeholder="英文提示词"></textarea>
        </div>
      </div>
    </div>

    <!-- 图片生成 -->
    <div class="card">
      <div class="card__header">
        <h3>图片生成</h3>
        <div class="flex-row">
          <span class="hint" v-if="!imageStore.isConfigured">未配置图片模型</span>
          <button class="btn btn--sm btn--primary" @click="genImage" :disabled="genImageLoading || !englishPrompt || !imageStore.isConfigured">
            {{ genImageLoading ? '生成中…' : '生成图片' }}
          </button>
        </div>
      </div>
      <div class="card__body">
        <div v-if="images.length === 0" class="empty-state">
          <div class="empty-state__icon">□</div>
          <div class="empty-state__title">还没有生成图片</div>
          <div class="empty-state__desc">填写提示词后点"生成图片"</div>
        </div>
        <div v-else class="imggen-grid">
          <div v-for="img in images" :key="img.id"
            class="imggen-item" :class="{ selected: selectedImageId === img.id }">
            <img :src="img.dataUrl" :alt="'候选 ' + img.time" @click="selectAsCover(img)" />
            <div class="imggen-item__bar">
              <span class="imggen-item__time">{{ img.time }}</span>
              <div class="flex-row">
                <button class="btn btn--sm btn--ghost" @click="selectAsCover(img)" :title="selectedImageId === img.id ? '已选为封面' : '选为封面'">{{ selectedImageId === img.id ? '✓' : '选' }}</button>
                <button class="btn btn--sm btn--ghost" @click="downloadImage(img)" title="下载">↓</button>
                <button class="btn btn--sm btn--ghost" @click="removeImage(img.id)" title="删除">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出 -->
    <div class="card">
      <div class="card__header"><h3>导出角色卡</h3></div>
      <div class="card__body">
        <div class="flex-row">
          <button class="btn btn--accent" @click="exportV3" :disabled="!cardStore.coverImageBase64">导出 V3 角色卡</button>
          <button class="btn btn--secondary" @click="exportV2" :disabled="!cardStore.coverImageBase64">导出 V2 角色卡</button>
          <button class="btn btn--ghost" @click="importCover">导入旧封面</button>
        </div>
        <p class="hint mt-md">V3 角色卡使用 ccv3 chunk + chara_card_v3 规范，包含全部 AI 生成的内容。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';
import { useImageGenStore } from '../stores/image-gen.js';
import { readPngCardData } from '../utils/png-utils.js';

const cardStore = useCardStore();
const appStore = useAppStore();
const imageStore = useImageGenStore();

const chinesePrompt = ref('');
const englishPrompt = ref('');
const images = ref([]);
const selectedImageId = ref(null);
const genPromptLoading = ref(false);
const translateLoading = ref(false);
const genImageLoading = ref(false);

async function genPrompt() {
  genPromptLoading.value = true;
  try {
    const result = await imageStore.genPromptFromCard(cardStore);
    chinesePrompt.value = result.chinese;
    englishPrompt.value = result.english;
    appStore.toastSuccess('提示词已生成');
  } catch (e) {
    appStore.toastError(e.message);
  } finally {
    genPromptLoading.value = false;
  }
}

async function translate() {
  if (!chinesePrompt.value) return;
  translateLoading.value = true;
  try {
    englishPrompt.value = await imageStore.translatePrompt(chinesePrompt.value);
    appStore.toastSuccess('已翻译');
  } catch (e) {
    appStore.toastError(e.message);
  } finally {
    translateLoading.value = false;
  }
}

async function genImage() {
  if (!englishPrompt.value) {
    appStore.toastError('请先填写英文提示词');
    return;
  }
  if (!imageStore.isConfigured) {
    appStore.toastError('请先在 API 设置配置图片生成模型');
    return;
  }
  genImageLoading.value = true;
  try {
    const dataUrl = await imageStore.generateImage(englishPrompt.value);
    const id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour12: false });
    images.value.unshift({ id, dataUrl, time });
    if (images.value.length > imageStore.MAX_IMAGES) {
      images.value = images.value.slice(0, imageStore.MAX_IMAGES);
    }
    appStore.toastSuccess('图片已生成');
  } catch (e) {
    appStore.toastError(e.message);
  } finally {
    genImageLoading.value = false;
  }
}

function selectAsCover(img) {
  selectedImageId.value = img.id;
  cardStore.coverImageBase64 = img.dataUrl;
  cardStore.markDirty();
  appStore.toastSuccess('已选为封面');
}

function downloadImage(img) {
  const a = document.createElement('a');
  a.href = img.dataUrl;
  a.download = (cardStore.cardData.data.name || 'character') + '_' + img.id + '.png';
  a.click();
}

function removeImage(id) {
  images.value = images.value.filter(i => i.id !== id);
  if (selectedImageId.value === id) selectedImageId.value = null;
}

async function importCover() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        cardStore.coverImageBase64 = reader.result;
        cardStore.markDirty();
        appStore.toastSuccess('封面已导入');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      appStore.toastError('导入失败: ' + err.message);
    }
  };
  input.click();
}

function exportV3() {
  cardStore.exportPngV3();
}

function exportV2() {
  cardStore.exportPng();
}
</script>

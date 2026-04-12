<template>
  <div class="page">
    <div class="page__header">
      <h1>基本信息</h1>
      <p>编辑角色卡的基础信息</p>
    </div>

    <div class="card mb-md">
      <div class="card__body">
        <div class="form-group">
          <label>作品名称 <span class="badge badge--danger">必填</span></label>
          <input class="input input--lg" v-model="d.name" placeholder="给你的作品起个名字" @input="markDirty">
          <div class="hint">这就是角色卡的名字，也是 {{char}} 的名字。在对话中 {{char}} 会被替换成这个名字。</div>
        </div>

        <div class="form-group">
          <label>作品类型</label>
          <input class="input" v-model="cardType" placeholder="例如：奇幻冒险 / 现代都市 / 赛博朋克 / 历史架空 / 校园日常" @input="markDirty">
          <div class="hint">帮助 AI 生成功能理解你的卡是什么类型，从而给出更精准的建议。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';

const store = useCardStore();
const d = computed(() => store.cardData);
const cardType = computed({
  get: () => (store.cardData.tags || []).find(t => t.startsWith('类型:'))?.replace('类型:', '') || '',
  set: (val) => {
    const tags = (store.cardData.tags || []).filter(t => !t.startsWith('类型:'));
    if (val) tags.unshift('类型:' + val);
    store.cardData.tags = tags;
    store.markDirty();
  }
});

function markDirty() { store.markDirty(); }
</script>

<style scoped>
.input--lg {
  font-size: 16px;
  padding: 14px 18px;
}
</style>

<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>玩家角色</h1>
        <p>设定 {{user}}（玩家自己）的基本信息 — 可选功能，不填则由玩家自由发挥</p>
      </div>
      <label class="toggle-label">
        <input type="checkbox" v-model="enabled"> 启用玩家角色设定
      </label>
    </div>

    <div v-if="enabled">
      <div class="card mb-md">
        <div class="card__header"><h3>基本信息</h3></div>
        <div class="card__body">
          <div class="form-row">
            <div class="form-group">
              <label>玩家名称</label>
              <input class="input" v-model="player.name" placeholder="留空让用户自己取名" @input="syncToCard">
            </div>
            <div class="form-group">
              <label>性别</label>
              <select class="select" v-model="player.gender" @change="syncToCard">
                <option value="">不限定</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="自定义">自定义</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>年龄</label>
              <input class="input" v-model="player.age" placeholder="如：18岁 / 青年" @input="syncToCard">
            </div>
            <div class="form-group">
              <label>种族</label>
              <input class="input" v-model="player.race" placeholder="如：人类、精灵、兽人" @input="syncToCard">
            </div>
            <div class="form-group">
              <label>身份/职业</label>
              <input class="input" v-model="player.role" placeholder="如：学生、冒险者、上班族" @input="syncToCard">
            </div>
          </div>
          <div class="form-group">
            <label>外貌描述</label>
            <input class="input" v-model="player.appearance" placeholder="简短描述，留空则不限定" @input="syncToCard">
          </div>
          <div class="form-group">
            <label>性格特点</label>
            <input class="input" v-model="player.personality" placeholder="如：开朗、沉默寡言、温柔" @input="syncToCard">
          </div>
          <div class="form-group">
            <label>背景故事</label>
            <textarea class="textarea" v-model="player.background" rows="4"
              placeholder="玩家角色的背景设定（可选）" @input="syncToCard"></textarea>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header flex-between">
          <h3>预览（将写入 scenario）</h3>
          <button class="btn btn--primary btn--sm" @click="syncToCard">同步到角色卡</button>
        </div>
        <div class="card__body">
          <pre class="preview selectable">{{ previewText }}</pre>
        </div>
      </div>
    </div>

    <div v-else class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">玩家角色设定已关闭</div>
        <div class="empty-state__desc">
          {{user}} 就是使用角色卡的人（玩家自己）。<br>
          打开后可以预设玩家的名字、身份等信息，AI 就知道玩家是什么人。<br>
          很多卡不设定 {{user}}，让玩家自由发挥——这个功能完全可选。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const appStore = useAppStore();

const enabled = ref(false);
const player = reactive({
  name: '', gender: '', age: '', race: '', role: '',
  appearance: '', personality: '', background: ''
});

const previewText = computed(() => {
  const lines = [];
  lines.push('【玩家角色设定】');
  if (player.name) lines.push(`名称：${player.name}`);
  if (player.gender) lines.push(`性别：${player.gender}`);
  if (player.race) lines.push(`种族：${player.race}`);
  if (player.age) lines.push(`年龄：${player.age}`);
  if (player.role) lines.push(`身份：${player.role}`);
  if (player.appearance) lines.push(`外貌：${player.appearance}`);
  if (player.personality) lines.push(`性格：${player.personality}`);
  if (player.background) lines.push(`背景：${player.background}`);
  return lines.length > 1 ? lines.join('\n') : '（请填写至少一项信息）';
});

function syncToCard() {
  if (!enabled.value) return;
  const existing = cardStore.cardData.scenario || '';
  const marker = '【玩家角色设定】';
  const cleaned = existing.includes(marker) ? existing.split(marker)[0].trim() : existing;
  cardStore.cardData.scenario = cleaned + (cleaned ? '\n\n' : '') + previewText.value;
  cardStore.markDirty();
  appStore.toastSuccess('已同步到 scenario');
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.preview {
  font-size: 13px; line-height: 1.7; color: var(--cf-text-primary);
  white-space: pre-wrap; font-family: var(--cf-font); background: none; border: none; margin: 0;
}
</style>

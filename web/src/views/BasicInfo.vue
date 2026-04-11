<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>基本信息</h1>
        <p>编辑角色卡的基础字段</p>
      </div>
      <span v-if="cardStore.cardName" class="badge badge--accent">{{ cardStore.cardName }}</span>
    </div>

    <!-- 名称与类型 -->
    <div class="card mb-md">
      <div class="card__header"><h3>角色信息</h3></div>
      <div class="card__body">
        <div class="form-group">
          <label>角色名称</label>
          <input class="input" v-model="d.name" placeholder="角色的名字，即 {{char}}" @input="markDirty">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>创作者</label>
            <input class="input" v-model="d.creator" placeholder="你的名字" @input="markDirty">
          </div>
          <div class="form-group">
            <label>版本号</label>
            <input class="input" v-model="d.character_version" placeholder="如 1.0" @input="markDirty">
          </div>
        </div>
        <div class="form-group">
          <label>标签</label>
          <input class="input" v-model="tagsStr" placeholder="用逗号分隔，如：奇幻,冒险,女性" @change="updateTags">
        </div>
        <div class="form-group">
          <label>创作者备注</label>
          <textarea class="textarea" v-model="d.creator_notes" rows="3" placeholder="写给使用者看的说明" @input="markDirty"></textarea>
        </div>
      </div>
    </div>

    <!-- 角色描述 -->
    <div class="card mb-md">
      <div class="card__header flex-between">
        <h3>角色描述</h3>
        <span class="badge badge--info">{{ (d.description || '').length }} 字</span>
      </div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.description" rows="10"
          placeholder="详细描述角色的外貌、性格、背景故事等" @input="markDirty"></textarea>
        <div class="hint">这是角色卡最核心的字段，AI 会根据这里的内容来扮演角色。</div>
      </div>
    </div>

    <!-- 性格摘要 -->
    <div class="card mb-md">
      <div class="card__header"><h3>性格摘要</h3></div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.personality" rows="3"
          placeholder="简短的性格关键词，如：温柔,内向,善良" @input="markDirty"></textarea>
        <div class="hint">简短的性格描述，作为 description 的补充。</div>
      </div>
    </div>

    <!-- 场景设定 -->
    <div class="card mb-md">
      <div class="card__header"><h3>场景设定</h3></div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.scenario" rows="4"
          placeholder="故事发生的背景和场景" @input="markDirty"></textarea>
      </div>
    </div>

    <!-- 对话示例 -->
    <div class="card mb-md">
      <div class="card__header flex-between">
        <h3>对话示例</h3>
        <span class="badge badge--info">{{ (d.mes_example || '').length }} 字</span>
      </div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.mes_example" rows="8"
          placeholder="<START>&#10;{{user}}: 你好&#10;{{char}}: *微微一笑* 你好呀，有什么事吗？" @input="markDirty"></textarea>
        <div class="hint">用 &lt;START&gt; 分隔不同的对话示例，用 {{user}} 和 {{char}} 表示玩家和角色。</div>
      </div>
    </div>

    <!-- 系统提示词 -->
    <div class="card mb-md">
      <div class="card__header"><h3>系统提示词</h3></div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.system_prompt" rows="4"
          placeholder="角色卡级别的系统提示词（会覆盖预设的系统提示词）" @input="markDirty"></textarea>
        <div class="hint">大部分角色卡不需要填这个，除非你想覆盖预设的系统提示词。</div>
      </div>
    </div>

    <!-- 深度提示词 -->
    <div class="card mb-md">
      <div class="card__header"><h3>深度提示词</h3></div>
      <div class="card__body">
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>深度 (Depth)</label>
            <input class="input" type="number" v-model.number="depthPrompt.depth" @input="markDirty">
          </div>
          <div class="form-group" style="flex:1">
            <label>角色 (Role)</label>
            <select class="select" v-model="depthPrompt.role" @change="markDirty">
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>内容</label>
          <textarea class="textarea" v-model="depthPrompt.prompt" rows="4"
            placeholder="在聊天历史中特定深度插入的提示词" @input="markDirty"></textarea>
        </div>
      </div>
    </div>

    <!-- 历史后指令 -->
    <div class="card mb-md">
      <div class="card__header"><h3>历史后指令 (Post History Instructions)</h3></div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.post_history_instructions" rows="3"
          placeholder="插入在聊天历史末尾的指令" @input="markDirty"></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';

const cardStore = useCardStore();
const d = computed(() => cardStore.cardData);

const depthPrompt = computed(() => {
  if (!d.value.extensions) d.value.extensions = {};
  if (!d.value.extensions.depth_prompt) {
    d.value.extensions.depth_prompt = { prompt: '', depth: 4, role: 'system' };
  }
  return d.value.extensions.depth_prompt;
});

const tagsStr = ref('');
// 同步 tags
tagsStr.value = (d.value.tags || []).join(', ');

function updateTags() {
  d.value.tags = tagsStr.value.split(',').map(t => t.trim()).filter(Boolean);
  cardStore.markDirty();
}

function markDirty() { cardStore.markDirty(); }
</script>

<style scoped>
.form-row {
  display: flex;
  gap: 12px;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>

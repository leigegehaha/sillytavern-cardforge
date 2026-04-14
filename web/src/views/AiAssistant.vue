<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>AI 助手</h1>
        <p>和 AI 对话，或让 AI 诊断你的角色卡</p>
      </div>
      <div class="flex-row" style="flex-wrap:wrap">
        <button class="btn btn--accent btn--sm" @click="analyzeCard" :disabled="chatLoading">诊断角色卡</button>
        <button class="btn btn--primary btn--sm" @click="startNewChat">开始新对话</button>
        <button class="btn btn--sm" @click="showHistory = !showHistory">
          对话记录 ({{ chatHistory.length }})
        </button>
      </div>
    </div>

    <!-- 对话记录面板 -->
    <div v-if="showHistory" class="card mb-md">
      <div class="card__header flex-between">
        <h3>对话记录</h3>
        <span class="hint">最多保留 100 条</span>
      </div>
      <div class="card__body" style="max-height:400px;overflow-y:auto">
        <div v-if="chatHistory.length === 0" class="hint" style="text-align:center;padding:20px">
          暂无历史对话
        </div>
        <div v-for="(h, i) in chatHistory" :key="i" class="history-item" @click="loadHistory(i)">
          <div class="flex-between">
            <span class="history-item__title">{{ h.title || '无标题对话' }}</span>
            <div class="flex-row">
              <span class="history-item__time">{{ h.time }}</span>
              <button class="btn btn--danger btn--sm" @click.stop="appStore.confirmAction('删除这条对话记录？', () => deleteHistory(i))">x</button>
            </div>
          </div>
          <div class="history-item__preview">{{ h.preview }}</div>
        </div>
      </div>
    </div>

    <!-- 对话区域 -->
    <div class="chat-container card">
      <div class="chat-messages" ref="chatBox">
        <div v-if="messages.length === 0" class="chat-empty">
          <div style="font-size:24px;margin-bottom:12px">AI 助手</div>
          <div class="hint">输入消息开始对话，或点击「诊断角色卡」让 AI 分析你的角色卡</div>
        </div>
        <div v-for="(msg, i) in messages" :key="i"
          :class="['chat-msg', 'chat-msg--' + msg.role]">
          <div class="chat-msg__role">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
          <div class="chat-msg__content">{{ msg.content }}</div>
        </div>
        <div v-if="chatLoading" class="chat-msg chat-msg--assistant">
          <div class="chat-msg__role">AI</div>
          <div class="chat-msg__content chat-typing">思考中...</div>
        </div>
      </div>

      <div class="chat-input">
        <textarea class="textarea chat-input__box" v-model="userInput" rows="2"
          placeholder="输入消息... (Ctrl+Enter 发送)"
          @keydown.ctrl.enter="sendMessage"
          :disabled="chatLoading"></textarea>
        <button class="btn btn--primary" @click="sendMessage" :disabled="chatLoading || !userInput.trim()">
          {{ chatLoading ? '...' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const messages = ref([]);
const userInput = ref('');
const chatLoading = ref(false);
const chatBox = ref(null);
const showHistory = ref(false);

// 对话历史
const STORAGE_KEY = 'cardforge_chat_history';
const HISTORY_MAX = 100;
const chatHistory = ref([]);

function loadChatHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) chatHistory.value = JSON.parse(saved);
  } catch (e) {}
}

function saveChatHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.value));
  } catch (e) {}
}

function saveCurrentToHistory() {
  if (messages.value.length === 0) return;
  const firstUserMsg = messages.value.find(m => m.role === 'user');
  const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) : '无标题对话';
  const lastMsg = messages.value[messages.value.length - 1];
  const preview = (lastMsg.content || '').slice(0, 50);
  const now = new Date();
  const time = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

  chatHistory.value.unshift({
    title, preview, time,
    messages: JSON.parse(JSON.stringify(messages.value))
  });

  if (chatHistory.value.length > HISTORY_MAX) {
    chatHistory.value = chatHistory.value.slice(0, HISTORY_MAX);
  }
  saveChatHistory();
}

function startNewChat() {
  saveCurrentToHistory();
  messages.value = [];
  appStore.toastSuccess('已开始新对话');
}

function loadHistory(index) {
  const h = chatHistory.value[index];
  if (!h) return;
  saveCurrentToHistory();
  messages.value = h.messages.map(m => ({ ...m }));
  showHistory.value = false;
  appStore.toastSuccess('已加载历史对话');
  scrollToBottom();
}

function deleteHistory(index) {
  chatHistory.value.splice(index, 1);
  saveChatHistory();
}

async function sendMessage() {
  if (!userInput.value.trim() || chatLoading.value) return;
  if (!apiStore.isConfigured) {
    appStore.toastError('请先在 API 设置中配置 API Key');
    return;
  }

  const text = userInput.value.trim();
  messages.value.push({ role: 'user', content: text });
  userInput.value = '';
  chatLoading.value = true;
  scrollToBottom();

  try {
    const systemPrompt = buildSystemPrompt();
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.value.slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
    ];

    const result = await apiStore.chat(chatMessages, { temperature: 0.8, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    messages.value.push({ role: 'assistant', content: result });
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '出错了: ' + e.message });
  } finally {
    chatLoading.value = false;
    scrollToBottom();
  }
}

async function analyzeCard() {
  if (!apiStore.isConfigured) {
    appStore.toastError('请先在 API 设置中配置 API Key');
    return;
  }

  const context = buildCardContext(cardStore);
  if (!context || context.length < 10) {
    appStore.toastWarning('请先导入一张角色卡');
    return;
  }

  messages.value.push({ role: 'user', content: '请诊断我的角色卡' });
  chatLoading.value = true;
  scrollToBottom();

  try {
    const prompt = `请全面诊断以下角色卡，从以下角度分析：
1. 基本信息完整性
2. 角色描述质量
3. 世界书结构是否合理
4. 正则脚本是否有冗余或冲突
5. 给出改进建议

【角色卡信息】
${context}`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是 SillyTavern 角色卡制作专家，擅长诊断和优化角色卡。请用中文回答，给出具体可操作的建议。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    messages.value.push({ role: 'assistant', content: result });
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '诊断失败: ' + e.message });
  } finally {
    chatLoading.value = false;
    scrollToBottom();
  }
}

function buildSystemPrompt() {
  const context = buildCardContext(cardStore);
  let prompt = '你是一个 SillyTavern 角色卡制作助手。你擅长角色卡的各种技术：世界书设计、MVU 变量系统、正则脚本、EJS 模板等。用中文回答，简洁实用。';
  if (context && context.length > 10) {
    prompt += '\n\n当前正在编辑的角色卡信息：\n' + context;
  }
  return prompt;
}

function scrollToBottom() {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  });
}

// 关闭页面时保存
function onBeforeUnload() { saveCurrentToHistory(); }

onMounted(() => {
  loadChatHistory();
  window.addEventListener('beforeunload', onBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload);
});
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 160px);
  min-height: 400px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.chat-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--cf-text-muted);
}

.chat-msg { margin-bottom: 16px; max-width: 85%; }
.chat-msg--user { margin-left: auto; }
.chat-msg--assistant { margin-right: auto; }

.chat-msg__role {
  font-size: 11px;
  color: var(--cf-text-muted);
  margin-bottom: 4px;
}

.chat-msg--user .chat-msg__role { text-align: right; }

.chat-msg__content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-msg--user .chat-msg__content {
  background: rgba(88, 166, 255, 0.15);
  border: 1px solid rgba(88, 166, 255, 0.2);
  border-bottom-right-radius: 4px;
}

.chat-msg--assistant .chat-msg__content {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--cf-border);
  border-bottom-left-radius: 4px;
}

.chat-typing { color: var(--cf-text-muted); font-style: italic; }

.chat-input {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--cf-border);
}

.chat-input__box { flex: 1; min-height: 40px; resize: none; }

.history-item {
  padding: 10px 12px;
  border: 1px solid var(--cf-border);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 215, 0, 0.3);
}

.history-item__title { font-size: 13px; font-weight: 600; }
.history-item__time { font-size: 11px; color: var(--cf-text-muted); }
.history-item__preview {
  font-size: 12px;
  color: var(--cf-text-muted);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .chat-container { height: calc(100vh - 120px); }
  .chat-msg { max-width: 95%; }
}
</style>

<template>
  <div class="page">
    <div class="page__header">
      <h1>开场白</h1>
      <p>设计角色的第一条消息 — 故事从这里开始</p>
    </div>

    <!-- AI 生成开场白 -->
    <div class="card mb-md">
      <div class="card__header"><h3>AI 生成开场白</h3></div>
      <div class="card__body">
        <button class="btn btn--accent" style="width:100%;margin-bottom:12px;padding:10px" :disabled="aiGenerating || !store.cardData.name"
          @click="autoGenerateGreeting">
          {{ aiGenerating ? '全自动生成中...' : 'AI 全自动生成' }}
        </button>
        <div class="form-row">
          <div class="form-group">
            <label>开场风格</label>
            <select class="select" v-model="greetingStyle">
              <option value="narrative">叙事文学型（日常/校园）</option>
              <option value="atmosphere">氛围叙事型（有世界观）</option>
              <option value="event">情境投入型（强开局事件）</option>
              <option value="menu">系统/菜单型（多选项）</option>
            </select>
          </div>
          <div class="form-group">
            <label>篇幅</label>
            <select class="select" v-model="greetingLength">
              <option value="short">简短（300-500字）</option>
              <option value="medium">标准（500-800字）</option>
              <option value="long">详细（800-1500字）</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>额外要求</label>
          <input class="input" v-model="greetingExtra" placeholder="如：要有下雨的氛围、角色正在做饭、以打斗开场...">
        </div>

        <!-- 美化选项 -->
        <div class="form-group" style="border-top:1px solid var(--cf-border);padding-top:12px;margin-top:8px">
          <label class="toggle-label mb-md">
            <input type="checkbox" v-model="autoBeautify"> 生成后自动美化为 HTML
          </label>
          <div v-if="autoBeautify">
            <div class="flex-row mb-md" style="flex-wrap:wrap;gap:4px">
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = '暗色半透明卡片风，圆角，渐变背景'">暗色卡片</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = '赛博朋克风，霓虹色，发光边框，monospace字体'">赛博朋克</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = '古风水墨风，宣纸色背景，毛笔字体，印章装饰'">古风水墨</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = '校园清新风，浅色背景，圆角卡片，柔和配色'">校园清新</button>
              <button class="btn btn--ghost btn--sm" @click="beautifyReq = '奇幻冒险风，羊皮纸背景，金色边框，中世纪字体'">奇幻冒险</button>
            </div>
            <input class="input" v-model="beautifyReq" placeholder="或自定义美化风格要求...">
          </div>
        </div>

        <button class="btn btn--accent" style="width:100%;padding:10px" :disabled="aiGenerating || !store.cardData.name"
          @click="generateGreeting">
          {{ aiGenerating ? '生成中...' : 'AI 生成开场白' }}
        </button>

        <!-- 生成预览 -->
        <div v-if="greetingPreview" class="greeting-preview mt-md">
          <div class="flex-between mb-md">
            <span style="font-size:13px;color:var(--cf-text-muted)">生成预览 · {{ greetingPreview.length }} 字</span>
            <div class="flex-row">
              <button class="btn btn--accent" @click="applyGreetingPreview">选定</button>
              <button class="btn btn--accent" @click="lastGenMode === 'auto' ? autoGenerateGreeting() : generateGreeting()" :disabled="aiGenerating">
                {{ aiGenerating ? '生成中...' : '重新生成' }}
              </button>
            </div>
          </div>
          <pre class="greeting-preview__text selectable">{{ greetingPreview }}</pre>
        </div>

        <!-- 美化预览 -->
        <div v-if="showHtmlPreview && htmlPreview" class="html-preview mt-md">
          <div class="card__header flex-between">
            <span style="font-size:12px;color:var(--cf-text-muted)">HTML 美化预览</span>
            <div class="flex-row">
              <button class="btn btn--accent" @click="applyHtml">选定</button>
              <button class="btn btn--accent" @click="beautifyGreeting" :disabled="beautifying">
                {{ beautifying ? '生成中...' : '重新生成' }}
              </button>
            </div>
          </div>
          <iframe class="html-render-iframe" :srcdoc="htmlPreview" sandbox="allow-same-origin"></iframe>
          <details class="mt-md">
            <summary style="font-size:12px;color:var(--cf-text-muted);cursor:pointer">查看 HTML 源码</summary>
            <pre class="html-source selectable">{{ htmlPreview }}</pre>
          </details>
        </div>
      </div>
    </div>

    <!-- 主开场白 -->
    <div class="card mb-md">
      <div class="card__header flex-between">
        <div class="flex-row">
          <h3>主开场白 (first_mes)</h3>
          <span class="badge badge--danger">必填</span>
        </div>
      </div>
      <div class="card__body">
        <textarea class="textarea" v-model="d.first_mes" rows="14"
          placeholder="角色的第一条消息。描述场景、角色状态，给用户一个接话的点。" @input="store.markDirty()"></textarea>
        <div class="hint">
          字数：{{ (d.first_mes || '').length }} | 预估 Token：~{{ Math.round((d.first_mes || '').length * 1.3) }}<br>
          提示：如果使用 MVU 变量系统，在开场白末尾加 &lt;StatusPlaceHolderImpl/&gt; 让状态栏显示。<br>
          提示：可以在开场白里用 &lt;initvar&gt; 标签设置特定开局的变量初始值，覆盖世界书里的默认值。
        </div>
      </div>
    </div>

    <!-- 备选开场白 -->
    <div class="card mb-md">
      <div class="card__header flex-between">
        <h3>备选开场白 (alternate_greetings)</h3>
        <button class="btn btn--primary btn--sm" @click="store.addGreeting()">+ 添加开场白</button>
      </div>
      <div class="card__body">
        <p class="hint mb-md">多个开场白让用户可以选择不同的故事入口（左右滑动切换）</p>

        <div v-if="(d.alternate_greetings || []).length === 0" class="empty-state" style="padding:30px">
          <div class="empty-state__icon"></div>
          <div class="empty-state__title">暂无备选开场白</div>
          <div class="empty-state__desc">可以设置不同场景、不同关系阶段的开场白</div>
        </div>

        <div v-for="(g, i) in d.alternate_greetings" :key="i" class="greeting-item mb-md">
          <div class="flex-between mb-md">
            <span class="badge badge--info">开场白 {{ i + 2 }}</span>
            <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('删除这个开场白？', () => store.removeGreeting(i))">删除</button>
          </div>
          <textarea class="textarea" v-model="d.alternate_greetings[i]" rows="10"
            placeholder="备选开场白内容" @input="store.markDirty()"></textarea>
          <div class="hint">字数：{{ (g || '').length }}</div>
        </div>
      </div>
    </div>

    <!-- 首页替换模式 -->
    <div class="card">
      <div class="card__header flex-between">
        <h3>首页替换模式</h3>
        <span class="badge badge--info">高级</span>
      </div>
      <div class="card__body">
        <p class="hint mb-md">
          高级用法：first_mes 只写一个标签（如"【首页】"），正则脚本把它替换成完整的 HTML 首页。<br>
          点击下方按钮一键设置。
        </p>
        <div class="form-group">
          <label>首页 HTML 内容</label>
          <textarea class="textarea" v-model="homepageHtml" rows="6"
            placeholder="粘贴或编写你的 HTML 首页代码...也可以点下面的 AI 生成"></textarea>
        </div>
        <div class="flex-row">
          <button class="btn btn--secondary btn--sm" @click="aiGenerateHomepage" :disabled="aiGenerating">
            {{ aiGenerating ? '生成中...' : 'AI 生成首页 HTML' }}
          </button>
          <button class="btn btn--primary btn--sm" @click="applyHomepageMode" :disabled="!homepageHtml">
            应用首页替换模式
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';

const store = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const d = computed(() => store.cardData);

const homepageHtml = ref('');
const beautifying = ref(false);
const htmlPreview = ref('');
const showHtmlPreview = ref(false);
const aiGenerating = ref(false);
const greetingStyle = ref('narrative');
const greetingLength = ref('medium');
const greetingExtra = ref('');
const beautifyReq = ref('');
const greetingPreview = ref('');
const lastGenMode = ref('auto');
const autoBeautify = ref(false);

async function autoGenerateGreeting() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  if (!store.cardData.name) { appStore.toastError('请先在基本信息填写角色名'); return; }

  aiGenerating.value = true;
  try {
    const context = buildCardContext(store);
    const prompt = `你是专业的 SillyTavern 开场白撰写专家。请根据以下角色卡信息，自动判断最合适的风格和篇幅，生成一段高质量的开场白。

【角色卡信息】
${context}

要求：
- 根据角色卡类型自动选择最合适的风格（叙事/氛围/情境/系统菜单）
- 篇幅500-800字
- 包含三要素：场景（在哪、什么时间）、角色（在做什么）、钩子（给用户接话的点）
- 用 {{user}} 代表用户，{{char}} 代表角色
- 动作描写用 *星号* 包裹

直接输出开场白内容，不要加任何说明。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是专业的角色卡开场白撰写专家。直接输出开场白，不要说明。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.85, maxTokens: 4096 });

    greetingPreview.value = result;
    lastGenMode.value = 'auto';
    appStore.toastSuccess('开场白已生成，请预览后点击「选定」应用');
  } catch (e) {
    appStore.toastError('生成失败: ' + e.message);
  } finally { aiGenerating.value = false; }
}

async function generateGreeting() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  if (!store.cardData.name) { appStore.toastError('请先在基本信息填写角色名'); return; }

  aiGenerating.value = true;
  try {
    const context = buildCardContext(store);
    const styleDesc = {
      narrative: '叙事文学型——用散文般的语言描写场景和角色，直接将用户带入故事',
      atmosphere: '氛围叙事型——大量环境描写营造氛围，用细节建立世界感',
      event: '情境投入型——用一个强烈的反差或事件开局，制造悬念',
      menu: '系统/菜单型——展示选项或系统界面，适合多线剧情'
    };
    const lenDesc = { short: '300-500字', medium: '500-800字', long: '800-1500字' };

    const prompt = `你是专业的 SillyTavern 开场白撰写专家。请根据以下角色卡信息生成开场白。

【已有角色卡信息】
${context}

【开场白要求】
- 风格：${styleDesc[greetingStyle.value]}
- 篇幅：${lenDesc[greetingLength.value]}
- 好的开场白包含三要素：场景（在哪、什么时间）、角色（在做什么）、钩子（给用户接话的点）
- 用 {{user}} 代表用户，{{char}} 代表角色
- 动作描写用 *星号* 包裹
${greetingExtra.value ? '- 额外要求：' + greetingExtra.value : ''}

直接输出开场白内容，不要加任何说明。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是专业的角色卡开场白撰写专家。直接输出开场白，不要说明。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.85, maxTokens: 4096 });

    greetingPreview.value = result;
    lastGenMode.value = 'custom';
    appStore.toastSuccess('开场白已生成，请预览后点击「选定」应用');
  } catch (e) {
    appStore.toastError('生成失败: ' + e.message);
  } finally { aiGenerating.value = false; }
}

function applyGreetingPreview() {
  if (!greetingPreview.value) return;
  d.value.first_mes = greetingPreview.value;
  store.markDirty();
  greetingPreview.value = '';

  // 如果勾选了自动美化，立即开始美化
  if (autoBeautify.value) {
    appStore.toastSuccess('已填入主开场白，开始自动美化...');
    beautifyGreeting();
  } else {
    appStore.toastSuccess('已填入主开场白');
  }
}

async function beautifyGreeting() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  if (!d.value.first_mes) { appStore.toastError('请先写开场白'); return; }

  beautifying.value = true;
  try {
    const prompt = `你是 HTML/CSS 前端设计师。请把以下纯文本开场白转换为精美的 HTML 界面。

原始开场白：
${d.value.first_mes}

要求：
1. 用 HTML + 内联 CSS 美化，生成一个独立的 HTML 片段
2. 设计风格：${beautifyReq.value || '暗色系、半透明、圆角卡片、渐变背景'}
3. 对话文字用引号样式，动作描写用斜体
4. 场景描写用小字灰色
5. 可以加上分隔线、图标等装饰
6. 所有 CSS 用内联 style 或 <style> 标签，不要引用外部资源
7. 保留所有原始文本内容，只是美化排版
8. 整体宽度自适应，背景半透明

只输出 HTML 代码，不要任何说明文字。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是专业的前端设计师，擅长将纯文本转化为精美的 HTML 界面。只输出 HTML 代码。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 4096 });

    let html = result;
    const codeMatch = result.match(/```html?\s*([\s\S]*?)```/);
    if (codeMatch) html = codeMatch[1];

    htmlPreview.value = html.trim();
    showHtmlPreview.value = true;
    appStore.toastSuccess('HTML 美化完成，请预览确认');
  } catch (e) {
    appStore.toastError('美化失败: ' + e.message);
  } finally { beautifying.value = false; }
}

function applyHtml() {
  if (!htmlPreview.value) return;
  d.value.first_mes = htmlPreview.value;
  store.markDirty();
  showHtmlPreview.value = false;
  htmlPreview.value = '';
  appStore.toastSuccess('已替换为 HTML 版本');
}

async function aiGenerateHomepage() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  aiGenerating.value = true;
  try {
    const context = buildCardContext(store);
    const result = await apiStore.chat([
      { role: 'system', content: '你是前端设计师。生成一个暗色系、半透明毛玻璃风格的角色卡首页HTML。只输出HTML代码。' },
      { role: 'user', content: `根据以下角色卡信息，生成一个精美的HTML首页界面。\n\n${context}\n\n要求：\n1. 暗色半透明背景、圆角卡片、渐变色\n2. 显示角色卡名称、简介、功能按钮区\n3. 所有CSS内联，不引用外部资源\n4. 宽度自适应\n5. 只输出HTML代码` }
    ], { temperature: 0.7, maxTokens: 4096 });
    let html = result;
    const m = result.match(/```html?\s*([\s\S]*?)```/);
    if (m) html = m[1];
    homepageHtml.value = html.trim();
    appStore.toastSuccess('首页 HTML 已生成');
  } catch (e) {
    appStore.toastError('生成失败: ' + e.message);
  } finally { aiGenerating.value = false; }
}

function applyHomepageMode() {
  if (!homepageHtml.value) return;
  d.value.first_mes = '【首页】';
  store.addRegexScript({
    ...store.createEmptyRegexScript(),
    scriptName: '首页替换',
    findRegex: '/【首页】/g',
    replaceString: homepageHtml.value,
    markdownOnly: true,
    promptOnly: false,
    maxDepth: 1
  });
  store.addRegexScript({
    ...store.createEmptyRegexScript(),
    scriptName: '[清理]首页标签',
    findRegex: '/【首页】/g',
    replaceString: '',
    markdownOnly: false,
    promptOnly: true
  });
  store.markDirty();
  appStore.toastSuccess('首页替换模式已应用：first_mes="【首页】" + 2个正则脚本');
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.html-preview {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: var(--cf-gap-md);
}
.html-render-iframe {
  width: 100%;
  height: 500px;
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  background: rgba(0, 0, 0, 0.2);
  display: block;
}
.html-source {
  font-size: 11px;
  font-family: var(--cf-font-mono);
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--cf-text-secondary);
  max-height: 300px;
  overflow-y: auto;
  margin-top: 8px;
}
.greeting-item {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: var(--cf-gap-md);
}
.greeting-preview {
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 215, 0, 0.25);
  border-radius: var(--cf-radius-sm);
  padding: var(--cf-gap-md);
}
.greeting-preview__text {
  font-family: var(--cf-font);
  font-size: 13px;
  line-height: 1.8;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  background: none;
  border: none;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}
</style>

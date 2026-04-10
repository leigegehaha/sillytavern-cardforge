<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>前端状态栏</h1>
        <p>AI 生成 HTML 状态栏 — 根据你的 MVU 变量动态渲染</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--accent" @click="autoGenStatusBar" :disabled="generating">
          {{ generating ? '全自动生成中...' : 'AI 全自动生成' }}
        </button>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        前端状态栏是一段 HTML+JS 代码，它读取 MVU 变量并以漂亮的面板形式显示在 AI 回复下方。<br>
        · <strong>原理</strong>：用正则把开场白末尾的 <code>&lt;StatusPlaceHolderImpl/&gt;</code> 占位符替换成 HTML 代码块，酒馆助手自动渲染<br>
        · <strong>动态读取</strong>：生成的代码用 <code>getAllVariables().stat_data</code> 实时读取你的实际变量<br>
        · <strong>前置要求</strong>：先在 MVU 页面定义好变量结构，再来这里生成状态栏<br>
        · <strong>生成后</strong>：会自动添加配套的正则脚本（渲染+AI层隐藏+旧楼层清理），开场白末尾会加上占位符
      </div>
    </div>

    <!-- 当前 MVU 变量预览 -->
    <div class="card mb-md">
      <div class="card__header"><h3>检测到的 MVU 变量</h3></div>
      <div class="card__body">
        <div v-if="!hasMvu" class="hint" style="text-align:center;padding:16px;color:var(--cf-warning)">
          未检测到 MVU 变量系统。请先到「MVU 变量系统」页面定义变量并注入脚本。
        </div>
        <div v-else>
          <pre class="code-preview selectable">{{ mvuPreview }}</pre>
        </div>
      </div>
    </div>

    <!-- 风格选择 -->
    <div class="card mb-md">
      <div class="card__header"><h3>状态栏配置</h3></div>
      <div class="card__body">
        <div class="form-group">
          <label>视觉风格</label>
          <div class="grid-3">
            <label class="style-card" :class="{ active: style === 'modern' }" @click="style = 'modern'">
              <input type="radio" v-model="style" value="modern" hidden>
              <strong>现代极简</strong>
              <span>蓝色调，圆角卡片，半透明</span>
            </label>
            <label class="style-card" :class="{ active: style === 'xiuxian' }" @click="style = 'xiuxian'">
              <input type="radio" v-model="style" value="xiuxian" hidden>
              <strong>仙侠古风</strong>
              <span>金色调，毛笔风格，玉简感</span>
            </label>
            <label class="style-card" :class="{ active: style === 'cyber' }" @click="style = 'cyber'">
              <input type="radio" v-model="style" value="cyber" hidden>
              <strong>赛博朋克</strong>
              <span>霓虹青绿，monospace，HUD感</span>
            </label>
            <label class="style-card" :class="{ active: style === 'dark' }" @click="style = 'dark'">
              <input type="radio" v-model="style" value="dark" hidden>
              <strong>暗黑奇幻</strong>
              <span>红黑配色，羊皮纸，哥特风</span>
            </label>
            <label class="style-card" :class="{ active: style === 'school' }" @click="style = 'school'">
              <input type="radio" v-model="style" value="school" hidden>
              <strong>校园清新</strong>
              <span>粉蓝柔和，圆润字体</span>
            </label>
            <label class="style-card" :class="{ active: style === 'custom' }" @click="style = 'custom'">
              <input type="radio" v-model="style" value="custom" hidden>
              <strong>自定义</strong>
              <span>用下方额外要求详细描述</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>布局方式</label>
          <select class="select" v-model="layout">
            <option value="vertical">竖向列表（每个变量一行）</option>
            <option value="grid">网格布局（2-3列卡片）</option>
            <option value="grouped">分组面板（按变量组分块）</option>
            <option value="dashboard">仪表盘（重要数值大显示）</option>
          </select>
        </div>

        <div class="form-group">
          <label>额外要求（可选）</label>
          <textarea class="textarea" v-model="extraReq" rows="3"
            placeholder="如：HP用进度条显示、好感度用爱心图标、加上角色头像位、字体用思源宋体..."></textarea>
        </div>

        <button class="btn btn--primary" style="width:100%" :disabled="generating || !hasMvu"
          @click="generateStatusBar">
          {{ generating ? '生成中...' : 'AI 生成状态栏' }}
        </button>
      </div>
    </div>

    <!-- 预览 -->
    <div v-if="generatedHtml" class="card mb-md">
      <div class="card__header flex-between">
        <h3>生成预览</h3>
        <div class="flex-row">
          <button class="btn-gold" @click="applyStatusBar">应用到正则脚本</button>
          <button class="btn-gold btn-gold--regen" @click="regenerate" :disabled="generating">
            {{ generating ? '生成中...' : '重新生成' }}
          </button>
        </div>
      </div>
      <div class="card__body">
        <div class="hint mb-md">
          预览中显示的是 AI 预填的示例数据。实际在 SillyTavern 中运行时，JS 会自动用你的真实变量数据覆盖这些示例。
        </div>
        <iframe class="status-bar-iframe"
          :srcdoc="iframeSrcdoc"
          ref="previewIframe"
          @load="onIframeLoad"
          sandbox="allow-scripts allow-same-origin"></iframe>
        <details class="mt-md">
          <summary style="font-size:12px;color:var(--cf-text-muted);cursor:pointer">查看完整源码</summary>
          <pre class="code-preview selectable">{{ generatedHtml }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const style = ref('modern');
const layout = ref('vertical');
const extraReq = ref('');
const generating = ref(false);
const generatedHtml = ref('');

// 检测 MVU 变量系统
const hasMvu = computed(() => {
  return cardStore.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate')) ||
         cardStore.worldEntries.some(e => (e.comment || '').includes('initvar') || (e.comment || '').includes('变量初始化'));
});

const mvuPreview = computed(() => {
  // 从世界书的 initvar 条目里提取变量结构
  const initEntry = cardStore.worldEntries.find(e =>
    (e.comment || '').toLowerCase().includes('initvar') ||
    (e.comment || '').includes('变量初始化')
  );
  if (initEntry) return initEntry.content || '(initvar 条目为空)';
  // 找 Zod Schema 脚本
  const zodScript = cardStore.tavernScripts.find(s => s.content && s.content.includes('z.object'));
  if (zodScript) return '(从 Zod Schema 推断结构)\n' + zodScript.content.slice(0, 800);
  return '(未找到变量定义)';
});

const styleDescriptions = {
  modern: '现代极简风：蓝色调（#60a5fa主色），圆角卡片（border-radius:10px），半透明背景（rgba(10,10,25,0.65)），blur(10px)毛玻璃，无衬线字体',
  xiuxian: '仙侠古风：金色主调（#ffd700），衬线字体（serif），暗紫黑背景，标题加 letter-spacing:4px 和金色发光阴影，图标可用 ✦ ◆ 等几何符号',
  cyber: '赛博朋克：青绿霓虹（#00e5ff），monospace 字体，HUD 风格，方形边框，加扫描线效果，标签全大写如 [HP] [LOC]',
  dark: '暗黑奇幻：红黑配色（#e94560 + #1a0a0a），哥特衬线字体，羊皮纸纹理感（深红边框），标题加血滴效果',
  school: '校园清新：粉蓝柔和（#a5b4fc + #fbcfe8），圆润字体，圆形图标，柔和阴影，emoji 装饰允许',
  custom: extraReq.value || '简洁现代风格'
};

const layoutDescriptions = {
  vertical: '竖向列表布局：每个变量独占一行，左侧标签右侧数值，padding:6px 0',
  grid: '网格布局：2列或3列卡片，每个卡片显示一个变量，display:grid grid-template-columns:1fr 1fr',
  grouped: '分组面板：按变量组（世界/主角/NPC等）分块显示，每组有标题和子项',
  dashboard: '仪表盘布局：重要数值（HP/灵力等）大字体居中显示，次要数值小字列表'
};

async function generateStatusBar() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  if (!hasMvu.value) { appStore.toastError('请先在 MVU 页面定义变量'); return; }

  generating.value = true;
  try {
    const SCRIPT_OPEN = '<' + 'script type="module">';
    const SCRIPT_CLOSE = '<' + '/script>';
    const prompt = [
      '你是 SillyTavern 前端状态栏开发专家。生成一段 HTML+JavaScript 代码，作为角色卡的状态栏。',
      '',
      '【MVU 变量结构】',
      mvuPreview.value,
      '',
      '【设计要求】',
      '- 视觉风格：' + styleDescriptions[style.value],
      '- 布局：' + layoutDescriptions[layout.value],
      extraReq.value ? '- 额外要求：' + extraReq.value : '',
      '',
      '【关键技术要求】',
      '1. 必须用 ```html 代码块包裹整段代码',
      '2. 包含 <body> 标签',
      '3. <body> 内必须有一个 <div id="st-panel"> 容器，里面**预先填好示例数据**（基于上面的变量结构编造合理示例值），不要写"加载中..."',
      '   原因：用户在编辑器里需要预览样式效果，预填示例数据后纯HTML+CSS就能展示完整外观',
      '4. JS 部分用 module 类型 script 引入 MVU API：',
      '   import{waitGlobalInitialized,getAllVariables,eventOn,Mvu}from"https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_api.js";',
      '5. const $=window.jQuery;',
      '6. 等 MVU 加载后用 $("#st-panel").html(h) **完全覆盖**预填的示例数据 — 这点非常重要！',
      '7. refresh 函数遍历 getAllVariables().stat_data 动态生成 HTML（不要硬编码变量名，因为用户卡片结构可能不同）',
      '8. 用 eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, refresh) 监听变量更新',
      '9. 所有CSS用内联style或<style>标签，可以引用Google Fonts等外部字体',
      '10. CSS要精简高效，动画数量不限但总CSS控制在200行以内',
      '11. refresh 函数生成的 HTML 结构必须和示例数据的 HTML 结构一致（同样的CSS类、同样的布局），这样替换后样式不变',
      '',
      '【完整参考结构】',
      '```html',
      '<body>',
      '<style>',
      '.panel { /* 你的样式 */ }',
      '.row { /* 单行样式 */ }',
      '.label { color: #aaa; }',
      '.value { font-weight: bold; }',
      '</style>',
      '<div id="st-panel" class="panel">',
      '  <!-- 这里是预填的示例数据，仅供编辑器预览 -->',
      '  <div class="row"><span class="label">位置</span><span class="value">青云宗</span></div>',
      '  <div class="row"><span class="label">HP</span><span class="value">85/100</span></div>',
      '  <div class="row"><span class="label">灵石</span><span class="value">3500</span></div>',
      '</div>',
      SCRIPT_OPEN,
      'import{waitGlobalInitialized,getAllVariables,eventOn,Mvu}from"https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_api.js";',
      'const $=window.jQuery;',
      '$(async()=>{',
      '  await waitGlobalInitialized("Mvu");',
      '  function refresh(){',
      '    const d=getAllVariables()?.stat_data||{};',
      '    let h="";',
      '    // 注意：这里生成的HTML结构必须和上面预填的一样！',
      '    for(const[k,v]of Object.entries(d)){',
      '      if(typeof v==="object"&&v!==null){',
      '        for(const[k2,v2]of Object.entries(v)){',
      '          h+=\'<div class="row"><span class="label">\'+k2+\'</span><span class="value">\'+v2+\'</span></div>\';',
      '        }',
      '      }else{',
      '        h+=\'<div class="row"><span class="label">\'+k+\'</span><span class="value">\'+v+\'</span></div>\';',
      '      }',
      '    }',
      '    $("#st-panel").html(h);  // 覆盖示例数据',
      '  }',
      '  refresh();',
      '  eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,refresh);',
      '});',
      SCRIPT_CLOSE,
      '</body>',
      '```',
      '',
      '直接输出完整代码，不要任何说明文字。'
    ].join('\n');

    const result = await apiStore.chat([
      { role: 'system', content: '你是前端开发专家，擅长生成精美的HTML状态栏。直接输出代码，不说明。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.8, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let html = result.trim();
    // 去掉所有 markdown 代码块标记（可能有多层）
    html = html.replace(/```html?\s*/gi, '').replace(/```/g, '').trim();
    // 确保包含 <body>
    if (!html.includes('<body>')) {
      html = '<body>\n' + html + '\n</body>';
    }
    // 检查 HTML 是否被截断（缺少闭合标签）
    if (!html.includes('</body>')) {
      html += '\n</body>';
    }
    // 重新加上 ```html 包裹
    generatedHtml.value = '```html\n' + html + '\n```';
    appStore.toastSuccess('状态栏已生成，请预览');
  } catch (e) {
    appStore.toastError('生成失败: ' + e.message);
  } finally { generating.value = false; }
}

async function autoGenStatusBar() {
  // 全自动模式：直接用现代极简+竖向布局
  style.value = 'modern';
  layout.value = 'vertical';
  await generateStatusBar();
}

async function regenerate() {
  await generateStatusBar();
}

// 用于 iframe 预览：剥掉 ```html 包裹，直接拿 HTML 字符串
const previewIframe = ref(null);
const iframeSrcdoc = computed(() => {
  if (!generatedHtml.value) return '';
  let html = generatedHtml.value.trim();
  if (html.startsWith('```')) {
    const firstNL = html.indexOf('\n');
    if (firstNL !== -1) html = html.substring(firstNL + 1);
    else html = html.substring(3);
  }
  if (html.endsWith('```')) {
    html = html.substring(0, html.length - 3).trim();
  }
  return html;
});

function onIframeLoad() {
  // 等内容渲染完后调高度
  setTimeout(() => {
    try {
      const iframe = previewIframe.value;
      if (!iframe || !iframe.contentDocument) return;
      const body = iframe.contentDocument.body;
      if (body) {
        const h = body.scrollHeight;
        iframe.style.height = Math.max(150, Math.min(h + 24, 800)) + 'px';
      }
    } catch (e) { /* 跨域忽略 */ }
  }, 100);
}

const statusBarScriptNames = ['前端状态栏渲染', '[隐藏]状态栏占位符', '[清理]旧楼层状态栏'];

function hasExistingStatusBar() {
  return cardStore.regexScripts.some(s => statusBarScriptNames.includes(s.scriptName));
}

function applyStatusBar() {
  if (!generatedHtml.value) return;

  if (hasExistingStatusBar()) {
    appStore.confirmAction('已存在状态栏正则脚本，是否替换？', () => doApplyStatusBar());
  } else {
    doApplyStatusBar();
  }
}

function doApplyStatusBar() {
  // 先删除已有的状态栏正则
  const scripts = cardStore.regexScripts;
  for (let i = scripts.length - 1; i >= 0; i--) {
    if (statusBarScriptNames.includes(scripts[i].scriptName)) {
      cardStore.removeRegexScript(scripts[i].id);
    }
  }

  // 1. 渲染正则
  cardStore.addRegexScript({
    ...cardStore.createEmptyRegexScript(),
    scriptName: '前端状态栏渲染',
    findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: generatedHtml.value,
    markdownOnly: true,
    promptOnly: false,
    maxDepth: 2
  });

  // 2. AI 层隐藏占位符
  cardStore.addRegexScript({
    ...cardStore.createEmptyRegexScript(),
    scriptName: '[隐藏]状态栏占位符',
    findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '',
    markdownOnly: false,
    promptOnly: true
  });

  // 3. 旧楼层清理
  cardStore.addRegexScript({
    ...cardStore.createEmptyRegexScript(),
    scriptName: '[清理]旧楼层状态栏',
    findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '',
    markdownOnly: true,
    promptOnly: false,
    minDepth: 3
  });

  // 4. 给开场白追加占位符
  const firstMes = cardStore.cardData.first_mes || '';
  if (!firstMes.includes('StatusPlaceHolderImpl')) {
    cardStore.cardData.first_mes = firstMes + '\n<StatusPlaceHolderImpl/>';
  }
  for (let i = 0; i < (cardStore.cardData.alternate_greetings || []).length; i++) {
    if (!cardStore.cardData.alternate_greetings[i].includes('StatusPlaceHolderImpl')) {
      cardStore.cardData.alternate_greetings[i] += '\n<StatusPlaceHolderImpl/>';
    }
  }

  cardStore.markDirty();
  generatedHtml.value = '';
  appStore.toastSuccess('状态栏已应用：3个正则 + 开场白占位符');
}
</script>

<style scoped>
.code-preview {
  font-family: var(--cf-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--cf-radius-sm);
  padding: 12px;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}
.style-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  cursor: pointer;
  background: rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;

  strong { font-size: 13px; color: var(--cf-text-primary); }
  span { font-size: 11px; color: var(--cf-text-muted); }

  &:hover {
    border-color: rgba(255, 215, 0, 0.4);
    background: rgba(255, 215, 0, 0.04);
  }
  &.active {
    border-color: rgba(255, 215, 0, 0.6);
    background: rgba(255, 215, 0, 0.08);
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.15);
    strong { color: #ffd700; }
  }
}
.status-bar-iframe {
  width: 100%;
  min-height: 150px;
  height: 300px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: var(--cf-radius-sm);
  display: block;
}
</style>

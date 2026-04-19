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
          <label>状态栏模式</label>
          <select class="select" v-model="statusMode">
            <option value="mvu">MVU 变量模式 — 读取 MVU 变量系统的实时数据（需先配置 MVU）</option>
            <option value="text">纯文本模式 — AI 每次回复末尾输出状态文本，状态栏从文本中解析渲染（无需 MVU）</option>
          </select>
          <div class="hint">{{ statusMode === 'mvu' ? '状态栏从 getAllVariables().stat_data 读取变量值，需要先在 MVU 页面定义变量。' : '状态栏从 AI 输出的 <StatusData> 标签内容解析，AI 每次回复末尾按指定格式输出状态值，不需要 MVU 变量系统。' }}</div>
        </div>

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
import { buildCardContext } from '../utils/card-context.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

const statusMode = ref('mvu');
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
  if (statusMode.value === 'mvu' && !hasMvu.value) { appStore.toastError('请先在 MVU 页面定义变量，或切换为纯文本模式'); return; }

  generating.value = true;
  try {
    const SCRIPT_OPEN = '<' + 'script type="module">';
    const SCRIPT_CLOSE = '<' + '/script>';
    const isTextMode = statusMode.value === 'text';
    const cardContext = buildCardContext(cardStore);
    const prompt = isTextMode ? [
      '你是 SillyTavern 前端状态栏开发专家。生成一段纯 HTML+CSS+JS 代码，作为角色卡的状态栏。',
      '',
      '【角色卡信息】',
      cardContext,
      '',
      '【工作原理】',
      '这个状态栏不使用 MVU 变量系统。它的数据来源是正则捕获组 $1。',
      'AI 每次回复末尾会输出 <StatusData>字段名:值\\n字段名:值</StatusData>',
      '正则脚本会匹配 <StatusData>(内容)</StatusData>，将 $1（捕获的文本）传入你的 HTML 替换模板。',
      '',
      '【设计要求】',
      '- 视觉风格：' + styleDescriptions[style.value],
      '- 布局：' + layoutDescriptions[layout.value],
      extraReq.value ? '- 额外要求：' + extraReq.value : '',
      '',
      '【关键技术要求】',
      '1. 用 ```html 代码块包裹',
      '2. 包含 <body> 标签和 <div id="st-panel">',
      '3. 预填占位数据：所有数值和文本都显示为"\u2014"，真实数据由JS解析后覆盖',
      '4. 用一段普通 <script>（不是module）解析 $1 传入的文本',
      '5. 解析逻辑：文本按换行分割，每行按第一个冒号分割为 key:value',
      '6. 用解析出的数据覆盖 #st-panel 的内容',
      '7. 不需要引入任何外部 JS 库（不用 MVU API、不用 jQuery）',
      '8. 数据通过 window.__statusRawText 全局变量传入（正则替换时会设置这个值）',
      '9. 所有CSS用内联style或<style>标签',
      '',
      '【参考结构】',
      '```html',
      '<body>',
      '<style>.panel{} .row{} .label{color:#aaa} .value{font-weight:bold}</style>',
      '<div id="st-panel" class="panel">',
      '  <div class="row"><span class="label">位置</span><span class="value">某处</span></div>',
      '</div>',
      '<' + 'script>',
      'try{',
      '  const raw=window.__statusRawText||"";',
      '  const lines=raw.trim().split("\\n").filter(Boolean);',
      '  const data={};',
      '  lines.forEach(l=>{const i=l.indexOf(":");if(i>0)data[l.slice(0,i).trim()]=l.slice(i+1).trim();});',
      '  if(Object.keys(data).length>0){',
      '    let h="";',
      '    for(const[k,v]of Object.entries(data)){',
      '      h+=\'<div class="row"><span class="label">\'+k+\'</span><span class="value">\'+v+\'</span></div>\';',
      '    }',
      '    document.getElementById("st-panel").innerHTML=h;',
      '  }',
      '}catch(e){}',
      '<' + '/script>',
      '</body>',
      '```',
      '',
      '直接输出完整代码，不要任何说明文字。'
    ].join('\n') : [
      '你是 SillyTavern 前端状态栏开发专家。生成一段 HTML+JavaScript 代码，作为角色卡的状态栏。',
      '',
      '【MVU 变量结构 — 以下是 initvar 的完整内容，_.get() 路径必须严格按此结构书写，禁止自行编造路径】',
      mvuPreview.value,
      '',
      '【路径规则】',
      '- 上面的 YAML 结构就是 stat_data 的精确结构',
      '- 例如上面写 "基础信息:\\n  当前位置: xxx"，则读取路径必须是 _.get(data, "基础信息.当前位置", "—")',
      '- 禁止把"基础信息"改成"基础状态"、"世界与位置"等其他名字',
      '- 禁止自行拆分或合并字段',
      '',
      '【设计要求】',
      '- 视觉风格：' + styleDescriptions[style.value],
      '- 布局：' + layoutDescriptions[layout.value],
      extraReq.value ? '- 额外要求：' + extraReq.value : '',
      '',
      '【额外要求处理规则】',
      '- 用户的额外要求可能提到变量结构中不存在的字段',
      '- 对于变量中已有的字段：直接用 _.get(data, "已有路径") 读取',
      '- 对于变量中没有的字段：仍然用 _.get(data, "合理路径", "暂无") 读取，路径按变量结构的命名风格推断',
      '- 如果变量值是包含多个子值的字符串，用正则解析后分别显示',
      '- 只添加用户在额外要求里明确提到的内容，不要自行添加用户没要求的字段',
      '',
      '【关键技术要求 — 严格遵守】',
      '1. 用 ```html 代码块包裹（不要```json或其他）',
      '2. 只有 <style> + <div容器> + <script>，不要 <!doctype>、<html>、<head>、<body> 标签',
      '3. HTML 容器里每个数据字段都有唯一 id（如 id="sb-hp"），预填值为 0 或"—"',
      '4. JS 用普通 <script> 标签（不要 type="module"），用 IIFE 包裹 (function(){...})()',
      '5. 不要 import 任何外部库，getAllVariables/$/_/waitGlobalInitialized/Mvu/errorCatched/eventOn 都是全局可用的',
      '6. init 函数中：await waitGlobalInitialized("Mvu") → 读取变量 → 用 $("#id").text(value) 逐个更新元素的文字',
      '7. 不要用 .html() 重建整个容器内容！用 .text() 逐个更新已有元素，HTML 结构保持不变',
      '8. 用 _.get(data, "路径", 默认值) 安全读取嵌套属性',
      '9. 用 $(errorCatched(init)) 启动（不要用 $(async()=>{})）',
      '10. 不要用 eventOn 监听更新（每条消息渲染时读一次就够了）',
      '11. Tab 切换用 jQuery 事件绑定',
      '',
      '【完整参考结构 — 严格按此模式】',
      '```',
      '<style>',
      '  .sb-container { background:rgba(10,18,35,0.55); border-radius:16px; padding:16px; color:#e0f2fe; font-family:sans-serif; }',
      '  .sb-tabs { display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid rgba(79,172,254,0.3); padding-bottom:8px; }',
      '  .sb-tab { padding:6px 16px; cursor:pointer; border-radius:20px; font-size:0.9em; color:#93c5fd; background:transparent; border:1px solid transparent; }',
      '  .sb-tab.active { color:#fff; background:rgba(0,242,254,0.15); border-color:#00f2fe; }',
      '  .sb-page { display:none; } .sb-page.active { display:block; }',
      '  .sb-row { display:flex; justify-content:space-between; padding:8px 10px; background:rgba(15,25,50,0.4); border-radius:8px; margin-bottom:6px; }',
      '  .sb-lbl { color:#93c5fd; font-size:0.85em; } .sb-val { font-weight:bold; color:#e0f2fe; }',
      '</style>',
      '',
      '<div class="sb-container">',
      '  <div class="sb-tabs">',
      '    <div class="sb-tab active" data-target="sb-page-main">主角</div>',
      '    <div class="sb-tab" data-target="sb-page-npc">NPC</div>',
      '  </div>',
      '  <div class="sb-page active" id="sb-page-main">',
      '    <div class="sb-row"><span class="sb-lbl">位置</span><span class="sb-val" id="sb-loc">\u2014</span></div>',
      '    <div class="sb-row"><span class="sb-lbl">HP</span><span class="sb-val" id="sb-hp">0</span></div>',
      '  </div>',
      '  <div class="sb-page" id="sb-page-npc">',
      '    <div id="sb-npc-list"><div style="text-align:center;color:#93c5fd;padding:20px">暂无NPC</div></div>',
      '  </div>',
      '</div>',
      '',
      '<' + 'script>',
      '(function(){',
      '  async function init(){',
      '    await waitGlobalInitialized("Mvu");',
      '    const data = _.get(getAllVariables(), "stat_data", {});',
      '    // 逐个更新元素，不重建HTML',
      '    $("#sb-loc").text(_.get(data, "世界.位置", "\u2014"));',
      '    $("#sb-hp").text(_.get(data, "主角.HP", 0));',
      '    // Tab切换',
      '    $(".sb-tab").off("click").on("click", function(){',
      '      $(".sb-tab").removeClass("active");',
      '      $(this).addClass("active");',
      '      $(".sb-page").removeClass("active");',
      '      $("#"+$(this).data("target")).addClass("active");',
      '    });',
      '  }',
      '  $(errorCatched(init));',
      '})();',
      '<' + '/script>',
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
  const allStatusNames = [...statusBarScriptNames, '对AI隐藏状态数据', '状态栏'];
  for (let i = scripts.length - 1; i >= 0; i--) {
    if (allStatusNames.includes(scripts[i].scriptName)) {
      cardStore.removeRegexScript(scripts[i].id);
    }
  }

  if (statusMode.value === 'text') {
    // 纯文本模式：用 <StatusData> 标签
    // 1. 渲染正则：匹配 <StatusData>内容</StatusData>，$1传入HTML
    // 在HTML里注入一段script设置 window.__statusRawText = $1 的内容
    let textHtml = generatedHtml.value;
    // 在 </body> 前插入数据注入脚本
    textHtml = textHtml.replace('</body>', '<' + 'script>window.__statusRawText=`$1`;<' + '/script>\n</body>');
    cardStore.addRegexScript({
      ...cardStore.createEmptyRegexScript(),
      scriptName: '状态栏',
      findRegex: '/<StatusData>([\\s\\S]*?)<\\/StatusData>/gm',
      replaceString: textHtml,
      markdownOnly: true,
      promptOnly: false,
      runOnEdit: false,
      maxDepth: 2
    });

    // 2. 对AI隐藏旧的状态数据
    cardStore.addRegexScript({
      ...cardStore.createEmptyRegexScript(),
      scriptName: '对AI隐藏状态数据',
      findRegex: '/<StatusData>[\\s\\S]*?<\\/StatusData>/gm',
      replaceString: '',
      markdownOnly: false,
      promptOnly: true,
      minDepth: 6
    });

    // 3. 旧楼层清理
    cardStore.addRegexScript({
      ...cardStore.createEmptyRegexScript(),
      scriptName: '[清理]旧楼层状态栏',
      findRegex: '/<StatusData>[\\s\\S]*?<\\/StatusData>/gm',
      replaceString: '',
      markdownOnly: true,
      promptOnly: false,
      minDepth: 3
    });

    // 4. 添加世界书条目告诉AI输出<StatusData>
    const existingStatusEntry = cardStore.worldEntries.find(e => (e.comment || '').includes('状态数据输出指令'));
    if (!existingStatusEntry) {
      const entry = cardStore.addWorldEntry();
      entry.comment = '状态数据输出指令';
      entry.content = `状态数据输出规则:\n  - 每次回复结束后，必须在末尾追加 <StatusData> 块\n  - 格式为每行一个 "字段名:值"，冒号后紧跟值\n  - 不要在 <StatusData> 块内添加额外格式\n  - <StatusData> 块的内容不要出现在正文中\n\n输出格式示例:\n  <StatusData>\n  位置:某个地方\n  状态:正常\n  </StatusData>`;
      entry.constant = true;
      entry.enabled = true;
      entry.position = 'after_char';
      entry.insertion_order = 200;
      entry.extensions.depth = 0;
    }

    cardStore.markDirty();
    generatedHtml.value = '';
    appStore.toastSuccess('纯文本状态栏已应用：2个正则 + 状态数据输出指令');
  } else {
    // MVU 模式：用 <StatusPlaceHolderImpl/>
    cardStore.addRegexScript({
      ...cardStore.createEmptyRegexScript(),
      scriptName: '前端状态栏渲染',
      findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
      replaceString: generatedHtml.value,
      markdownOnly: true,
      promptOnly: false,
      runOnEdit: false,
      maxDepth: 2
    });

    cardStore.addRegexScript({
      ...cardStore.createEmptyRegexScript(),
      scriptName: '[隐藏]状态栏占位符',
      findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
      replaceString: '',
      markdownOnly: false,
      promptOnly: true
    });

    cardStore.addRegexScript({
      ...cardStore.createEmptyRegexScript(),
      scriptName: '[清理]旧楼层状态栏',
      findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
      replaceString: '',
      markdownOnly: true,
      promptOnly: false,
      minDepth: 3
    });

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

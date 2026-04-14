<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>EJS 模板编辑器</h1>
        <p>编写 EJS 模板代码，让世界书条目根据变量动态变化</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--accent btn--sm" @click="autoGenEjs" :disabled="aiGenerating">
          {{ aiGenerating ? '全自动生成中...' : 'AI 全自动生成' }}
        </button>
        <button class="btn btn--secondary btn--sm" @click="insertSnippet('if')">插入 if/else</button>
        <button class="btn btn--secondary btn--sm" @click="insertSnippet('getvar')">插入 getvar</button>
        <button class="btn btn--secondary btn--sm" @click="insertSnippet('preprocessing')">插入 @@preprocessing</button>
        <button class="btn btn--primary" @click="renderPreview">▶ 渲染预览</button>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        <strong style="color:var(--cf-text-primary)">EJS 是干什么的？</strong><br>
        EJS 让你在世界书条目的内容里写代码逻辑，<strong>主要用途是根据变量动态生成不同的文本</strong>。<br>
        · <strong>典型场景 1</strong>：好感度&lt;30 显示"NPC冷淡地转过头"，&gt;=80 显示"NPC亲密地靠过来"<br>
        · <strong>典型场景 2</strong>：根据"当前位置"变量输出不同的环境描写<br>
        · <strong>典型场景 3</strong>：用 <code>activateWorldEntry()</code> / <code>deactivateWorldEntry()</code> 动态控制其他条目的开关（这只是其中一种用法，不是全部）<br>
        <br>
        <strong style="color:var(--cf-text-primary)">「渲染预览」是干什么的？</strong><br>
        你写的 EJS 代码 = 一段会输出文本的小程序。预览就是用你设置的"模拟变量值"跑一遍这段代码，让你看到<strong>会输出什么文本</strong>，确认逻辑写对了再注入世界书。<br>
        <br>
        · <strong>左侧</strong>：写 EJS 代码 + 设置模拟变量<br>
        · <strong>右侧</strong>：点「渲染预览」看输出文本，确认后点「注入世界书」<br>
        · <strong>不会写？</strong> 点「AI 全自动生成」让 AI 根据角色卡自动生成 EJS 模板<br>
        · <strong>不需要 EJS？</strong> 简单角色卡不需要，只有想让世界书内容随变量动态变化时才用
      </div>
    </div>

    <div class="ejs-layout">
      <!-- 左侧：代码 + 变量 -->
      <div class="ejs-left">
        <!-- EJS 代码编辑 -->
        <div class="card mb-md">
          <div class="card__header">
            <h3>EJS 代码</h3>
            <span class="badge badge--info">{{ (ejsCode || '').length }} 字符</span>
          </div>
          <div class="card__body">
            <textarea class="textarea selectable ejs-code" v-model="ejsCode" rows="16"
              placeholder="在这里编写 EJS 模板代码...&#10;&#10;示例：&#10;&lt;%_ const favor = Number(getvar('stat_data.NPC.好感度')) || 0; _%&gt;&#10;&#10;&lt;%_ if (favor >= 80) { _%&gt;&#10;NPC非常信任{{user}}，会主动分享秘密。&#10;&lt;%_ } else if (favor >= 40) { _%&gt;&#10;NPC对{{user}}有好感，愿意一起行动。&#10;&lt;%_ } else { _%&gt;&#10;NPC对{{user}}态度冷淡，保持距离。&#10;&lt;%_ } _%&gt;"></textarea>
          </div>
        </div>

        <!-- 模拟变量 -->
        <div class="card">
          <div class="card__header flex-between">
            <h3>模拟变量</h3>
            <button class="btn btn--secondary btn--sm" @click="addVariable">+ 添加变量</button>
          </div>
          <div class="card__body">
            <p class="hint mb-md">设置模拟变量值，用于预览 EJS 中 getvar() 的返回结果</p>
            <div v-for="(v, i) in mockVars" :key="i" class="ejs-var-row">
              <input class="input" v-model="v.path" placeholder="变量路径，如 stat_data.NPC.好感度" style="flex:2">
              <input class="input" v-model="v.value" placeholder="值，如 85" style="flex:1">
              <select class="select" v-model="v.type" style="width:90px">
                <option value="string">文本</option>
                <option value="number">数字</option>
                <option value="boolean">布尔</option>
                <option value="json">JSON</option>
              </select>
              <button class="btn btn--danger btn--sm" @click="mockVars.splice(i, 1)">×</button>
            </div>
            <div v-if="mockVars.length === 0" class="hint" style="text-align:center;padding:12px">
              暂无模拟变量，点击上方「添加变量」
            </div>

            <!-- 预设模板 -->
            <div class="divider"></div>
            <div class="flex-row" style="flex-wrap:wrap">
              <span style="font-size:12px;color:var(--cf-text-muted)">快捷预设：</span>
              <button class="btn btn--ghost btn--sm" @click="loadPreset('xiuxian')">修仙世界</button>
              <button class="btn btn--ghost btn--sm" @click="loadPreset('school')">校园日常</button>
              <button class="btn btn--ghost btn--sm" @click="loadPreset('game')">游戏数值</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：预览 -->
      <div class="ejs-right">
        <div class="card" style="height:100%">
          <div class="card__header flex-between">
            <h3>渲染结果</h3>
            <div class="flex-row">
              <button class="btn btn--ghost btn--sm" @click="copyResult" v-if="renderResult">复制</button>
              <button class="btn btn--ghost btn--sm" @click="injectToWorldBook" v-if="renderResult">
                注入世界书
              </button>
            </div>
          </div>
          <div class="card__body">
            <div v-if="renderError" class="ejs-error">
              <strong>渲染错误：</strong>
              <pre>{{ renderError }}</pre>
            </div>
            <div v-else-if="renderResult" class="ejs-result selectable">
              <pre>{{ renderResult }}</pre>
            </div>
            <div v-else class="empty-state" style="padding:40px 20px">
              <div class="empty-state__icon"></div>
              <div class="empty-state__title">点击「渲染预览」查看结果</div>
              <div class="empty-state__desc">
                左侧编写 EJS 代码并设置模拟变量后，<br>点击渲染按钮查看输出
              </div>
            </div>
          </div>
        </div>

        <!-- EJS 语法速查 -->
        <div class="card mt-md">
          <div class="card__header">
            <h3>EJS 语法速查</h3>
          </div>
          <div class="card__body ejs-cheatsheet">
            <div class="ejs-cheat-item">
              <code>&lt;%_ code _%&gt;</code>
              <span>执行 JS 代码（不输出）</span>
            </div>
            <div class="ejs-cheat-item">
              <code>&lt;%= value %&gt;</code>
              <span>输出值（转义 HTML）</span>
            </div>
            <div class="ejs-cheat-item">
              <code>&lt;%- value -%&gt;</code>
              <span>输出值（不转义）</span>
            </div>
            <div class="ejs-cheat-item">
              <code>getvar('路径')</code>
              <span>EJS 内读取 MVU 变量（用在 &lt;%_ %&gt; 里）</span>
            </div>
            <div class="ejs-cheat-item">
              <code>getvar('路径', {defaults: '默认值'})</code>
              <span>带默认值读取</span>
            </div>
            <div class="ejs-cheat-item">
              <code v-pre>{{get_message_variable::路径}}</code>
              <span>普通 content 里读变量（非 EJS，直接写）</span>
            </div>
            <div class="ejs-cheat-item">
              <code v-pre>{{format_message_variable::stat_data}}</code>
              <span>注入完整变量值给 AI 看（常驻条目用）</span>
            </div>
            <div class="ejs-cheat-item">
              <code>getChatMessages('-3')</code>
              <span>获取最近3条消息</span>
            </div>
            <div class="ejs-cheat-item">
              <code>activateWorldEntry('名称')</code>
              <span>动态激活世界书条目</span>
            </div>
            <div class="ejs-cheat-item">
              <code>deactivateWorldEntry('名称')</code>
              <span>动态禁用世界书条目</span>
            </div>
            <div class="ejs-cheat-item">
              <code>matchChatMessages(['词1','词2'])</code>
              <span>检测最近消息是否包含关键词</span>
            </div>
            <div class="ejs-cheat-item">
              <code>print('文本')</code>
              <span>在代码块中输出文本（替代复杂的 if/else 嵌套）</span>
            </div>
            <div class="ejs-cheat-item">
              <code>await getwi('条目名')</code>
              <span>获取其他世界书条目的内容</span>
            </div>
            <div class="ejs-cheat-item">
              <code>@@preprocessing</code>
              <span>条目开头写，在所有条目前执行（用于动态控制器）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const aiGenerating = ref(false);

async function autoGenEjs() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  aiGenerating.value = true;
  try {
    const context = buildCardContext(cardStore);
    const hasWorldBook = cardStore.worldEntries.length > 0;
    const hasMvu = cardStore.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));

    const prompt = `你是 SillyTavern EJS 模板专家。根据以下角色卡信息，自动判断需要什么 EJS 模板并生成。

【角色卡信息】
${context}

【当前状态】
- 已有世界书条目：${hasWorldBook ? '是（' + cardStore.worldEntries.length + '条）' : '否'}
- 已有MVU变量系统：${hasMvu ? '是' : '否'}

请自动判断这张卡最适合的 EJS 逻辑。常见用法：
- 有NPC好感度 → 根据好感度显示不同态度/行为
- 有位置系统 → 根据位置激活不同世界书条目
- 有分阶段剧情 → 根据变量值显示不同阶段内容
- 有动态控制器 → @@preprocessing 动态管理条目

生成一个完整可用的 EJS 模板代码。使用 getvar('stat_data.路径') 读取变量。
直接输出 EJS 代码，不要任何说明。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是EJS模板专家。直接输出可用的EJS代码。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let code = result;
    const m = result.match(/```(?:ejs|html)?\s*([\s\S]*?)```/);
    if (m) code = m[1];
    ejsCode.value = code.trim();

    // 自动注入世界书
    const entry = cardStore.addWorldEntry();
    entry.comment = 'EJS 动态模板（AI自动生成）';
    entry.content = ejsCode.value;
    entry.constant = false;
    entry.enabled = true;
    entry.position = 'before_char';
    appStore.toastSuccess('AI 全自动生成 EJS 模板并已注入世界书');
  } catch (e) {
    appStore.toastError('全自动生成失败: ' + e.message);
  } finally { aiGenerating.value = false; }
}

const ejsCode = ref('');
const renderResult = ref('');
const renderError = ref('');

const mockVars = ref([
  { path: 'stat_data.NPC.好感度', value: '50', type: 'number' },
]);

function addVariable() {
  mockVars.value.push({ path: '', value: '', type: 'string' });
}

// 构建模拟的 getvar 函数
function buildMockGetvar() {
  const vars = {};
  for (const v of mockVars.value) {
    if (!v.path) continue;
    let val = v.value;
    if (v.type === 'number') val = Number(val) || 0;
    else if (v.type === 'boolean') val = val === 'true';
    else if (v.type === 'json') {
      try { val = JSON.parse(val); } catch (e) { val = {}; }
    }
    // 按路径设置值
    const parts = v.path.split('.');
    let obj = vars;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = val;
  }
  return vars;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

function renderPreview() {
  renderError.value = '';
  renderResult.value = '';

  if (!ejsCode.value.trim()) {
    renderError.value = '请先编写 EJS 代码';
    return;
  }

  try {
    const allVars = buildMockGetvar();
    let code = ejsCode.value;

    // 模拟 getvar 函数
    const getvar = (path, opts) => {
      const val = getNestedValue(allVars, path);
      if (val !== undefined) return val;
      if (opts && opts.defaults !== undefined) return opts.defaults;
      return '';
    };

    // 模拟其他常用函数
    const getMessageVar = getvar;
    const getChatMessages = () => [{ message: '(模拟消息内容)' }];
    const getLastMessageId = () => 10;
    const activateWorldEntry = () => {};
    const deactivateWorldEntry = () => {};

    // 简易 EJS 渲染
    // 1. 处理 @@preprocessing（跳过标记）
    code = code.replace(/^@@preprocessing\s*/m, '');

    // 2. 替换 {{user}} {{char}} 宏
    code = code.replace(/\{\{user\}\}/g, '(用户名)');
    code = code.replace(/\{\{char\}\}/g, '(角色名)');

    // 3. 解析 EJS 标签
    let output = '';
    const segments = code.split(/(<%-[\s\S]*?-%>|<%=[\s\S]*?%>|<%_[\s\S]*?_%>|<%-[\s\S]*?%>|<%[\s\S]*?%>)/);

    let jsCode = 'let __output = "";\n';
    for (const seg of segments) {
      if (seg.startsWith('<%_') && seg.endsWith('_%>')) {
        // 执行代码（无输出）
        jsCode += seg.slice(3, -3) + '\n';
      } else if (seg.startsWith('<%-') && (seg.endsWith('-%>') || seg.endsWith('%>'))) {
        // 输出（不转义）
        const expr = seg.startsWith('<%-') ? seg.slice(3) : seg.slice(3);
        const clean = expr.replace(/-%>$|%>$/, '');
        jsCode += `__output += String(${clean});\n`;
      } else if (seg.startsWith('<%=') && seg.endsWith('%>')) {
        // 输出（转义）
        jsCode += `__output += String(${seg.slice(3, -2)});\n`;
      } else if (seg.startsWith('<%') && seg.endsWith('%>')) {
        // 执行代码
        jsCode += seg.slice(2, -2) + '\n';
      } else {
        // 纯文本
        jsCode += `__output += ${JSON.stringify(seg)};\n`;
      }
    }
    jsCode += 'return __output;';

    const fn = new Function(
      'getvar', 'getMessageVar', 'getChatMessages', 'getLastMessageId',
      'activateWorldEntry', 'deactivateWorldEntry', 'Number', 'Math', 'JSON',
      'String', 'Array', 'Object', 'parseInt', 'parseFloat', 'console',
      jsCode
    );

    // 沙箱：用一个空 console 替代真实 console，避免日志泄漏
    const safeConsole = { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };
    renderResult.value = fn(
      getvar, getMessageVar, getChatMessages, getLastMessageId,
      activateWorldEntry, deactivateWorldEntry, Number, Math, JSON,
      String, Array, Object, parseInt, parseFloat, safeConsole
    );

  } catch (e) {
    renderError.value = e.message;
  }
}

function insertSnippet(type) {
  const snippets = {
    'if': `<%_ const value = Number(getvar('stat_data.变量路径')) || 0; _%>

<%_ if (value >= 80) { _%>
高数值时显示的内容
<%_ } else if (value >= 40) { _%>
中数值时显示的内容
<%_ } else { _%>
低数值时显示的内容
<%_ } _%>`,
    'getvar': `<%_ const myVar = getvar('stat_data.路径', { defaults: '默认值' }); _%>
当前值：<%= myVar %>`,
    'preprocessing': `@@preprocessing
<%_
// 预处理代码 - 在所有条目处理之前执行
const currentLocation = getvar('stat_data.世界.位置', { defaults: '未知' });
const playerLevel = Number(getvar('stat_data.主角.等级')) || 1;

// 根据条件激活/禁用世界书条目
if (playerLevel >= 10) {
  activateWorldEntry('高级区域条目');
}
_%>`
  };
  ejsCode.value = (ejsCode.value ? ejsCode.value + '\n\n' : '') + snippets[type];
}

function loadPreset(type) {
  const presets = {
    xiuxian: [
      { path: 'stat_data.世界定位.当前大域', value: '中央神州', type: 'string' },
      { path: 'stat_data.用户信息.境界', value: '金丹期', type: 'string' },
      { path: 'stat_data.用户信息.修为进度', value: '65', type: 'number' },
      { path: 'stat_data.用户信息.灵石', value: '3500', type: 'number' },
      { path: 'stat_data.在场人物.殷冬雪', value: '{"好感度": 72, "位置": "青云宗"}', type: 'json' },
    ],
    school: [
      { path: 'stat_data.系统.日期', value: '4月15日', type: 'string' },
      { path: 'stat_data.系统.时间', value: '12:30', type: 'string' },
      { path: 'stat_data.系统.位置', value: '教室', type: 'string' },
      { path: 'stat_data.角色.好感度', value: '45', type: 'number' },
      { path: 'stat_data.系统.主角可疑度', value: '25', type: 'number' },
    ],
    game: [
      { path: 'stat_data.主角.HP', value: '80', type: 'number' },
      { path: 'stat_data.主角.MP', value: '50', type: 'number' },
      { path: 'stat_data.主角.等级', value: '15', type: 'number' },
      { path: 'stat_data.主角.金币', value: '12000', type: 'number' },
      { path: 'stat_data.世界.天气', value: '晴', type: 'string' },
    ]
  };
  mockVars.value = presets[type] || [];
}

function copyResult() {
  navigator.clipboard.writeText(renderResult.value);
  appStore.toastSuccess('已复制到剪贴板');
}

function injectToWorldBook() {
  const entry = cardStore.addWorldEntry();
  entry.comment = 'EJS 模板条目';
  entry.content = ejsCode.value;
  entry.constant = false;
  entry.enabled = true;
  entry.position = 'before_char';
  appStore.toastSuccess('已注入世界书（原始 EJS 代码）');
}
</script>

<style scoped>
.ejs-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--cf-gap-md);
  align-items: start;
}

.ejs-code {
  font-family: var(--cf-font-mono);
  font-size: 12px;
  line-height: 1.7;
  tab-size: 2;
}

.ejs-var-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.ejs-result {
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--cf-radius-sm);
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}
.ejs-result pre {
  font-family: var(--cf-font);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--cf-text-primary);
  margin: 0;
}

.ejs-error {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--cf-radius-sm);
  padding: 16px;
  color: var(--cf-danger);
}
.ejs-error pre {
  font-family: var(--cf-font-mono);
  font-size: 12px;
  margin-top: 8px;
  white-space: pre-wrap;
}

.ejs-cheatsheet {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ejs-cheat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.ejs-cheat-item code {
  background: rgba(0, 229, 255, 0.08);
  color: #00e5ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--cf-font-mono);
  font-size: 11px;
  white-space: nowrap;
}
.ejs-cheat-item span {
  color: var(--cf-text-secondary);
}
</style>

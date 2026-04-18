<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>EJS 模板编辑器</h1>
        <p>编写 EJS 模板代码，让世界书条目根据变量动态变化</p>
      </div>
      <div class="flex-row">
        <div class="ejs-dropdown">
          <button class="btn btn--accent btn--sm">AI 功能 ▾</button>
          <div class="ejs-dropdown__menu">
            <button @click="autoGenEjs" :disabled="aiGenerating">{{ aiGenerating ? '生成中...' : 'AI 生成 EJS' }}</button>
            <button @click="showGroupPanel = !showGroupPanel; showEmbedPanel = false">{{ showGroupPanel ? '关闭分组' : '分组开关' }}</button>
            <button @click="showEmbedPanel = !showEmbedPanel; showGroupPanel = false">{{ showEmbedPanel ? '关闭嵌入' : 'AI 嵌入条件' }}</button>
          </div>
        </div>
        <div class="ejs-dropdown">
          <button class="btn btn--secondary btn--sm">插入代码 ▾</button>
          <div class="ejs-dropdown__menu">
            <button @click="insertSnippet('if')">if / else 条件</button>
            <button @click="insertSnippet('getvar')">getvar 读变量</button>
            <button @click="insertSnippet('preprocessing')">@@preprocessing</button>
          </div>
        </div>
        <button class="btn btn--primary btn--sm" @click="renderPreview">▶ 预览</button>
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

    <!-- 分组开关面板 -->
    <div v-if="showGroupPanel" class="card mb-md">
      <div class="card__header flex-between">
        <h3>分组开关管理</h3>
        <div class="flex-row">
          <button class="btn btn--accent btn--sm" @click="aiAutoGroup" :disabled="aiGrouping">
            {{ aiGrouping ? 'AI 分析中...' : 'AI 自动分组' }}
          </button>
          <button class="btn btn--primary btn--sm" @click="addSwitchGroup">+ 手动新建分组</button>
        </div>
      </div>
      <div class="card__body">
        <p class="hint mb-md">
          将世界书条目分组，自动生成 <code>getwi()</code> 开关条目。启用某个开关时，该组的条目内容会被加载；禁用则不加载。适合多场景/多区域切换的卡。
        </p>

        <div v-if="switchGroups.length === 0" class="empty-state" style="padding:24px">
          <div class="empty-state__title">暂无分组</div>
          <div class="empty-state__desc">点击「新建分组」开始创建内容开关</div>
        </div>

        <div v-for="(group, gi) in switchGroups" :key="gi" class="switch-group mb-md">
          <div class="switch-group__header">
            <div class="flex-row" style="flex:1">
              <input class="input" v-model="group.name" placeholder="分组名称（如：地下城区域、仙界场景）" style="width:260px;font-weight:600">
              <label class="toggle-label">
                <input type="checkbox" v-model="group.enabled"> 默认启用
              </label>
            </div>
            <div class="flex-row">
              <button class="btn btn--primary btn--sm" @click="generateSwitchEntry(gi)">生成开关条目</button>
              <button class="btn btn--danger btn--sm" @click="switchGroups.splice(gi, 1)">删除分组</button>
            </div>
          </div>

          <!-- 条目选择 -->
          <div class="switch-group__body">
            <div class="switch-group__search">
              <input class="input" v-model="group.search" placeholder="搜索条目..." style="width:100%">
            </div>
            <div class="switch-group__entries">
              <label v-for="entry in filteredEntriesForGroup(group)" :key="entry.id" class="switch-entry-item">
                <input type="checkbox" :checked="group.entryIds.includes(entry.id)"
                  @change="toggleGroupEntry(group, entry.id)">
                <span class="switch-entry-item__name">{{ entry.comment || '(无名称)' }}</span>
                <span class="switch-entry-item__hint">{{ (entry.content || '').length }}字</span>
              </label>
              <div v-if="filteredEntriesForGroup(group).length === 0" class="hint" style="text-align:center;padding:16px">
                {{ cardStore.worldEntries.length === 0 ? '世界书中没有条目' : '没有匹配的条目' }}
              </div>
            </div>
            <div class="hint" style="margin-top:6px">已选 {{ group.entryIds.length }} 条</div>
          </div>

          <!-- 预览 -->
          <div v-if="group.preview" class="switch-group__preview">
            <div class="flex-between" style="margin-bottom:6px">
              <span class="badge badge--accent">预览生成的开关条目</span>
              <button class="btn btn--ghost btn--sm" @click="group.preview = ''">关闭预览</button>
            </div>
            <pre class="code-preview selectable" style="font-size:11px;max-height:200px;overflow-y:auto">{{ group.preview }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 嵌入 EJS 条件面板 -->
    <div v-if="showEmbedPanel" class="card mb-md">
      <div class="card__header flex-between">
        <h3>AI 自动嵌入 EJS 条件</h3>
        <button class="btn btn--accent btn--sm" @click="aiEmbedEjs" :disabled="aiEmbedding">
          {{ aiEmbedding ? 'AI 分析中...' : '开始分析' }}
        </button>
      </div>
      <div class="card__body">
        <p class="hint mb-md">
          AI 分析现有世界书条目和 MVU 变量，自动在合适的条目内容里插入 EJS 条件分支。不创建新条目，直接修改现有条目的 content。
        </p>

        <div v-if="embedResults.length === 0 && !aiEmbedding" class="empty-state" style="padding:24px">
          <div class="empty-state__title">点击「开始分析」</div>
          <div class="empty-state__desc">AI 会分析哪些条目适合加入条件分支，并生成修改方案供你确认</div>
        </div>

        <!-- 进度条 -->
        <div v-if="aiEmbedding" class="embed-progress">
          <div class="embed-progress__bar">
            <div class="embed-progress__fill" :style="{ width: embedProgress + '%' }"></div>
          </div>
          <div class="embed-progress__text">正在分析条目...</div>
        </div>

        <!-- 修改方案预览 -->
        <div v-if="embedResults.length > 0" class="mt-md">
          <div class="flex-between mb-md">
            <span class="badge badge--accent">找到 {{ embedResults.length }} 个可嵌入条目</span>
            <div class="flex-row">
              <button class="btn btn--primary btn--sm" @click="applyEmbedResults">应用选中的修改</button>
              <button class="btn btn--ghost btn--sm" @click="embedResults.forEach(r => r.selected = !r.selected)">切换全选</button>
            </div>
          </div>

          <div v-for="(result, i) in embedResults" :key="i" class="embed-result mb-md">
            <div class="embed-result__header">
              <input type="checkbox" v-model="result.selected">
              <span class="embed-result__name">{{ result.comment }}</span>
            </div>
            <div class="embed-result__diff">
              <div class="embed-result__before">
                <div class="embed-result__label">修改前</div>
                <pre>{{ result.originalContent.slice(0, 300) }}{{ result.originalContent.length > 300 ? '...' : '' }}</pre>
              </div>
              <div class="embed-result__after">
                <div class="embed-result__label">修改后</div>
                <pre>{{ result.newContent.slice(0, 400) }}{{ result.newContent.length > 400 ? '...' : '' }}</pre>
              </div>
            </div>
          </div>
        </div>
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
const aiGrouping = ref(false);
const aiEmbedding = ref(false);
const embedProgress = ref(0);
const showGroupPanel = ref(false);
const showEmbedPanel = ref(false);
const embedResults = ref([]);
const switchGroups = ref([]);

function addSwitchGroup() {
  switchGroups.value.push({
    name: '',
    enabled: true,
    entryIds: [],
    search: '',
    preview: ''
  });
}

function filteredEntriesForGroup(group) {
  const entries = cardStore.worldEntries;
  if (!group.search) return entries;
  const q = group.search.toLowerCase();
  return entries.filter(e => {
    const comment = (e.comment || '').toLowerCase();
    const content = (e.content || '').toLowerCase();
    return comment.includes(q) || content.includes(q);
  });
}

function toggleGroupEntry(group, entryId) {
  const idx = group.entryIds.indexOf(entryId);
  if (idx === -1) {
    group.entryIds.push(entryId);
  } else {
    group.entryIds.splice(idx, 1);
  }
}

function generateSwitchEntry(gi) {
  const group = switchGroups.value[gi];
  if (!group.name.trim()) {
    appStore.toastError('请填写分组名称');
    return;
  }
  if (group.entryIds.length === 0) {
    appStore.toastError('请至少选择一个条目');
    return;
  }

  // Build getwi code
  const entries = cardStore.worldEntries;
  const lines = [];
  for (const id of group.entryIds) {
    const entry = entries.find(e => e.id === id);
    if (entry && entry.comment) {
      lines.push(`<%- await getwi(null, '${entry.comment}') -%>`);
    }
  }
  const content = lines.join('\n');

  // Preview first
  group.preview = content;

  // Confirm and create
  appStore.confirmAction(
    `将为分组「${group.name}」生成开关条目，包含 ${group.entryIds.length} 个条目引用。被引用的条目将自动设为 disabled。确认？`,
    () => {
      // Create switch entry
      const switchEntry = cardStore.addWorldEntry();
      switchEntry.comment = `内容控制开关-${group.name}`;
      switchEntry.content = content;
      switchEntry.constant = true;
      switchEntry.enabled = group.enabled;
      switchEntry.position = 'before_char';

      // Disable referenced entries
      for (const id of group.entryIds) {
        const entry = entries.find(e => e.id === id);
        if (entry) {
          entry.enabled = false;
          entry.constant = false;
        }
      }

      cardStore.markDirty();
      appStore.toastSuccess(`已生成开关条目「内容控制开关-${group.name}」，${group.entryIds.length} 个条目已设为 disabled`);
      group.preview = '';
    }
  );
}

async function aiEmbedEjs() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  const entries = cardStore.worldEntries;
  if (entries.length === 0) { appStore.toastError('世界书中没有条目'); return; }

  // Collect MVU variable info
  const hasMvu = cardStore.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));
  if (!hasMvu) { appStore.toastError('请先配置 MVU 变量系统（EJS 条件需要变量来判断）'); return; }

  // Find variable init entry to get variable list
  const initEntry = entries.find(e => (e.comment || '').includes('变量初始化') || (e.comment || '').includes('initvar'));
  const varInfo = initEntry ? initEntry.content.slice(0, 800) : '(未找到变量初始化条目)';

  aiEmbedding.value = true;
  embedProgress.value = 10;
  embedResults.value = [];

  try {
    // Filter entries that are candidates for EJS embedding
    const candidates = entries.filter(e => {
      const comment = (e.comment || '').toLowerCase();
      const content = e.content || '';
      // Skip: already has EJS, is a rule/system entry, is too short, is disabled
      if (content.includes('<%')) return false;
      if (comment.includes('mvu_update') || comment.includes('变量更新') || comment.includes('变量输出')) return false;
      if (comment.includes('initvar') || comment.includes('变量初始化')) return false;
      if (comment.includes('控制开关')) return false;
      if (content.length < 30) return false;
      return true;
    });

    if (candidates.length === 0) {
      appStore.toastError('没有找到适合嵌入 EJS 的条目');
      return;
    }

    embedProgress.value = 30;

    const candidateList = candidates.map(e => ({
      id: e.id,
      comment: e.comment || '(无名称)',
      content: e.content.slice(0, 300)
    }));

    const prompt = `你是 SillyTavern EJS 模板专家。分析以下世界书条目和变量列表，判断哪些条目适合加入 EJS 条件分支，并生成修改后的内容。

【可用变量】
${varInfo}

【候选条目】
${JSON.stringify(candidateList, null, 2)}

【要求】
- 只选择真正适合加条件分支的条目（如角色描写可根据好感度变化、地点描写可根据时间变化等）
- 不要修改规则类/系统类条目
- 使用 getvar('stat_data.路径') 读取变量
- 保留原有内容，在合适位置插入 <%_ if ... _%> 条件分支
- 返回 JSON 数组，每个元素格式：{"id": 条目id, "comment": "条目名", "newContent": "修改后的完整content"}
- 修改要自然，不要强行给每个条目都加条件
- 所有内容用中文

只返回 JSON 数组，不要任何解释。`;

    embedProgress.value = 50;

    const result = await apiStore.chat([
      { role: 'system', content: '你是EJS条件嵌入专家。只返回JSON数组。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.4, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    embedProgress.value = 80;

    let modifications;
    try {
      let jsonStr = result.trim();
      const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) jsonStr = m[1].trim();
      if (!jsonStr.startsWith('[')) {
        const start = jsonStr.indexOf('[');
        const end = jsonStr.lastIndexOf(']');
        if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);
      }
      modifications = JSON.parse(jsonStr);
    } catch (e) {
      appStore.toastError('AI 返回格式异常，请重试');
      return;
    }

    if (!Array.isArray(modifications) || modifications.length === 0) {
      appStore.toastError('AI 未找到适合嵌入 EJS 的条目');
      return;
    }

    embedResults.value = modifications.map(mod => {
      const entry = entries.find(e => e.id === mod.id);
      return {
        id: mod.id,
        comment: mod.comment || (entry ? entry.comment : ''),
        originalContent: entry ? entry.content : '',
        newContent: mod.newContent || '',
        selected: true
      };
    }).filter(r => r.originalContent && r.newContent && r.newContent !== r.originalContent);

    embedProgress.value = 100;
    appStore.toastSuccess(`AI 分析完成，找到 ${embedResults.value.length} 个可嵌入条目。请检查修改方案后点「应用」。`);
  } catch (e) {
    appStore.toastError('AI 嵌入分析失败: ' + e.message);
  } finally {
    aiEmbedding.value = false;
  }
}

function applyEmbedResults() {
  const entries = cardStore.worldEntries;
  let applied = 0;
  for (const result of embedResults.value) {
    if (!result.selected) continue;
    const entry = entries.find(e => e.id === result.id);
    if (entry) {
      entry.content = result.newContent;
      applied++;
    }
  }
  cardStore.markDirty();
  appStore.toastSuccess(`已应用 ${applied} 个条目的 EJS 修改`);
  embedResults.value = [];
}

async function aiAutoGroup() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  const entries = cardStore.worldEntries;
  if (entries.length < 3) { appStore.toastError('世界书条目太少（至少3条），无法自动分组'); return; }

  aiGrouping.value = true;
  try {
    const entryList = entries.map(e => ({
      id: e.id,
      comment: e.comment || '(无名称)',
      contentPreview: (e.content || '').slice(0, 150)
    }));

    const prompt = `你是 SillyTavern 世界书专家。分析以下世界书条目列表，将它们按主题/场景/区域自动分组。

【条目列表】
${JSON.stringify(entryList, null, 2)}

【要求】
- 将相关联的条目分到同一组（如同一个地点的条目、同一个角色相关的条目、同一个系统的条目）
- 不需要把所有条目都分组，只分那些适合做开关控制的
- 规则类/系统类/AI指令类条目不要分组（它们应该常驻）
- 每组至少2个条目
- 返回 JSON 数组，每个元素格式：{"name": "分组名", "entryIds": [条目id数组], "enabled": true/false}
- 分组名要简洁明了
- 所有内容用中文

只返回 JSON 数组，不要任何解释。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是世界书分组专家。只返回JSON数组。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    let groups;
    try {
      let jsonStr = result.trim();
      const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) jsonStr = m[1].trim();
      if (!jsonStr.startsWith('[')) {
        const start = jsonStr.indexOf('[');
        const end = jsonStr.lastIndexOf(']');
        if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);
      }
      groups = JSON.parse(jsonStr);
    } catch (e) {
      appStore.toastError('AI 返回格式异常，请重试');
      return;
    }

    if (!Array.isArray(groups) || groups.length === 0) {
      appStore.toastError('AI 未找到适合分组的条目');
      return;
    }

    // Convert to switchGroups format
    switchGroups.value = groups.map(g => ({
      name: g.name || '',
      enabled: g.enabled !== false,
      entryIds: (g.entryIds || []).filter(id => entries.some(e => e.id === id)),
      search: '',
      preview: ''
    })).filter(g => g.entryIds.length >= 2);

    appStore.toastSuccess(`AI 分析完成，建议 ${switchGroups.value.length} 个分组。请检查后点「生成开关条目」确认。`);
  } catch (e) {
    appStore.toastError('AI 自动分组失败: ' + e.message);
  } finally { aiGrouping.value = false; }
}

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

/* Dropdown */
.ejs-dropdown {
  position: relative;
}
.ejs-dropdown__menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--cf-bg-card, #1a1a2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--cf-radius-sm, 6px);
  padding: 4px;
  min-width: 160px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.ejs-dropdown:hover .ejs-dropdown__menu,
.ejs-dropdown:focus-within .ejs-dropdown__menu {
  display: block;
}
.ejs-dropdown__menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--cf-text-primary, #e2e8f0);
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.ejs-dropdown__menu button:hover {
  background: rgba(255, 255, 255, 0.06);
}
.ejs-dropdown__menu button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Switch Group Styles */
.switch-group {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--cf-radius-md);
  overflow: hidden;
}
.switch-group__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  gap: 8px;
}
.switch-group__body {
  padding: 10px 14px;
}
.switch-group__search {
  margin-bottom: 8px;
}
.switch-group__entries {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--cf-radius-sm);
  background: rgba(0, 0, 0, 0.1);
  padding: 4px;
}
.switch-entry-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.switch-entry-item:hover {
  background: rgba(255, 255, 255, 0.04);
}
.switch-entry-item__name {
  flex: 1;
  color: var(--cf-text-primary);
}
.switch-entry-item__hint {
  font-size: 11px;
  color: var(--cf-text-muted);
}
.switch-group__preview {
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.1);
}

/* Embed EJS Styles */
.embed-progress {
  margin: 16px 0;
}
.embed-progress__bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.embed-progress__fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--cf-accent), #06b6d4);
  transition: width 0.5s ease;
  position: relative;
}
.embed-progress__fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: progressShine 1.5s infinite;
}
@keyframes progressShine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.embed-progress__text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cf-text-muted);
  text-align: center;
}

.embed-result {
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--cf-radius-md);
  overflow: hidden;
}
.embed-result__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.embed-result__name {
  font-weight: 600;
  color: var(--cf-text-primary);
  font-size: 13px;
}
.embed-result__diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: rgba(255, 255, 255, 0.04);
}
.embed-result__before,
.embed-result__after {
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.08);
}
.embed-result__before { background: rgba(248, 113, 113, 0.03); }
.embed-result__after { background: rgba(52, 211, 153, 0.03); }
.embed-result__label {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--cf-text-muted);
}
.embed-result__before .embed-result__label { color: #f87171; }
.embed-result__after .embed-result__label { color: #34d399; }
.embed-result__diff pre {
  font-family: var(--cf-font-mono);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--cf-text-secondary);
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}
</style>

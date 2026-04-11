<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>正则脚本编辑器</h1>
        <p>配置正则表达式脚本 — markdownOnly/promptOnly、楼层深度控制</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--accent" @click="autoGenRegex" :disabled="aiGenerating">
          {{ aiGenerating ? '全自动生成中...' : 'AI 全自动生成' }}
        </button>
        <button class="btn btn--ghost" @click="toggleBatchMode" v-if="scripts.length > 0">
          {{ batchMode ? '退出批量' : '批量操作' }}
        </button>
        <button class="btn btn--primary" @click="store.addRegexScript()">+ 新建正则脚本</button>
      </div>
    </div>

    <!-- 模板库 -->
    <div class="card mb-md">
      <div class="card__header"><h3>一键添加常用正则模板</h3></div>
      <div class="card__body hint" style="border-bottom:1px solid var(--cf-border);padding-bottom:12px;margin-bottom:8px">
        正则脚本用来美化 AI 输出或清理发给 AI 的内容。<br>
        · <strong>入门三件套</strong> = 变量折叠（显示层）+ 变量清理（AI层）+ 思维链隐藏 — <em>大多数情况选这个就够了</em><br>
        · <strong>完整套装</strong> = 标准 MVU 6 件套，互不冲突 — <em>用了 MVU 变量系统的卡选这个</em><br>
        · <strong>状态栏</strong> 已搬到「前端状态栏」页面，那里可以 AI 自定义生成<br>
        · <strong>markdownOnly</strong> = 只改用户看到的 | <strong>promptOnly</strong> = 只改发给 AI 的
      </div>
      <div class="card__body flex-row" style="flex-wrap:wrap;gap:8px">
        <button class="btn btn--secondary" @click="addAllEssentials">一键添加入门三件套</button>
        <button class="btn btn--secondary" @click="addFullSet">一键添加完整套装</button>
        <button class="btn btn--ghost btn--sm" @click="showTemplateLib = !showTemplateLib">
          {{ showTemplateLib ? '收起模板库' : '展开更多模板' }}
        </button>
      </div>
      <div v-if="showTemplateLib" class="card__body" style="border-top:1px solid var(--cf-border);padding-top:12px">
        <div class="hint mb-md">单独添加某个模板（高级用户）：</div>
        <div class="flex-row" style="flex-wrap:wrap;gap:6px">
          <button class="btn btn--ghost btn--sm" v-for="t in regexTemplates" :key="t.name"
            @click="addTemplate(t)">{{ t.name }}</button>
        </div>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="batchMode && scripts.length > 0" class="card mb-md batch-bar">
      <div class="card__body flex-between">
        <div class="flex-row">
          <label class="toggle-label">
            <input type="checkbox" :checked="selectedAll" @change="toggleSelectAll"> 全选
          </label>
          <span style="font-size:12px;color:var(--cf-text-muted)">已选 {{ selectedIds.size }} / {{ scripts.length }}</span>
        </div>
        <div class="flex-row">
          <button class="btn btn--secondary btn--sm" @click="batchEnable(true)" :disabled="selectedIds.size === 0">批量启用</button>
          <button class="btn btn--secondary btn--sm" @click="batchEnable(false)" :disabled="selectedIds.size === 0">批量禁用</button>
          <button class="btn btn--danger btn--sm" @click="batchDelete" :disabled="selectedIds.size === 0">批量删除</button>
        </div>
      </div>
    </div>

    <div v-if="scripts.length === 0" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">暂无正则脚本</div>
        <div class="empty-state__desc">正则脚本可以美化AI输出、隐藏标签、渲染HTML状态栏</div>
      </div>
    </div>

    <div v-for="(script, i) in scripts" :key="script.id" class="card mb-md">
      <div class="card__header">
        <div class="flex-row">
          <label v-if="batchMode" class="toggle-label" style="margin-right:4px">
            <input type="checkbox" :checked="selectedIds.has(script.id)"
              @change="toggleSelect(script.id)">
          </label>
          <span class="badge badge--info">#{{ i + 1 }}</span>
          <input class="input" style="width:300px;font-weight:600" v-model="script.scriptName" @input="store.markDirty()">
          <label class="toggle-label">
            <input type="checkbox" :checked="!script.disabled"
              @change="script.disabled = !$event.target.checked; store.markDirty()"> 启用
          </label>
        </div>
        <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('删除这个正则脚本？', () => store.removeRegexScript(script.id))">删除</button>
      </div>
      <div class="card__body">
        <div class="form-row">
          <div class="form-group">
            <label>查找正则 (findRegex)</label>
            <textarea class="textarea" style="font-family:var(--cf-font-mono);font-size:12px"
              v-model="script.findRegex" rows="3" placeholder="正则表达式" @input="store.markDirty()"></textarea>
          </div>
          <div class="form-group">
            <label>替换内容 (replaceString)</label>
            <textarea class="textarea" style="font-family:var(--cf-font-mono);font-size:12px"
              v-model="script.replaceString" rows="3" placeholder="替换为..." @input="store.markDirty()"></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>应用范围 (placement)</label>
            <div class="flex-row" style="flex-wrap:wrap">
              <label class="toggle-label" v-for="opt in placementOpts" :key="opt.val">
                <input type="checkbox" :checked="script.placement.includes(opt.val)"
                  @change="togglePlacement(script, opt.val)"> {{ opt.label }}
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>模式</label>
            <div>
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="script.markdownOnly"
                  @change="if(script.markdownOnly) script.promptOnly=false; store.markDirty()">
                markdownOnly (仅显示层)
              </label>
              <label class="toggle-label">
                <input type="checkbox" v-model="script.promptOnly"
                  @change="if(script.promptOnly) script.markdownOnly=false; store.markDirty()">
                promptOnly (仅AI层)
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>楼层深度控制</label>
            <div class="form-row">
              <div>
                <label style="font-size:11px">minDepth</label>
                <input class="input" type="number" v-model.number="script.minDepth"
                  placeholder="null" @input="store.markDirty()">
              </div>
              <div>
                <label style="font-size:11px">maxDepth</label>
                <input class="input" type="number" v-model.number="script.maxDepth"
                  placeholder="null" @input="store.markDirty()">
              </div>
            </div>
          </div>
        </div>

        <label class="toggle-label">
          <input type="checkbox" v-model="script.runOnEdit" @change="store.markDirty()"> 编辑消息时也运行
        </label>
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
import { chatForJsonArray } from '../utils/json-repair.js';

const store = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const scripts = computed(() => store.regexScripts);
const aiGenerating = ref(false);
const showTemplateLib = ref(false);
const batchMode = ref(false);
const selectedIds = ref(new Set());

const selectedAll = computed(() =>
  scripts.value.length > 0 && selectedIds.value.size === scripts.value.length
);

function toggleBatchMode() {
  batchMode.value = !batchMode.value;
  selectedIds.value = new Set();
}

function toggleSelect(id) {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedIds.value = s;
}

function toggleSelectAll() {
  if (selectedAll.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(scripts.value.map(s => s.id));
  }
}

function batchEnable(enabled) {
  for (const script of scripts.value) {
    if (selectedIds.value.has(script.id)) {
      script.disabled = !enabled;
    }
  }
  store.markDirty();
  appStore.toastSuccess(`已${enabled ? '启用' : '禁用'} ${selectedIds.value.size} 个正则脚本`);
}

function batchDelete() {
  const count = selectedIds.value.size;
  appStore.confirmAction(`确定删除选中的 ${count} 个正则脚本？`, () => {
    for (const id of selectedIds.value) {
      store.removeRegexScript(id);
    }
    selectedIds.value = new Set();
    appStore.toastSuccess(`已删除 ${count} 个正则脚本`);
  });
}

async function autoGenRegex() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  aiGenerating.value = true;
  try {
    const context = buildCardContext(store);
    const hasWorldBook = store.worldEntries.length > 0;
    const hasMvu = store.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));

    const prompt = `你是 SillyTavern 正则脚本专家。根据以下角色卡信息，自动判断需要哪些正则脚本并生成。

【角色卡信息】
${context}

【当前状态】
- 已有世界书条目：${hasWorldBook ? '是' : '否'}
- 已有MVU变量系统：${hasMvu ? '是' : '否'}
- 已有正则脚本数：${store.regexScripts.length}

请根据角色卡类型自动判断需要的正则脚本组合。常见需求：
- 有MVU → 需要变量折叠+变量清理+思维链隐藏
- 有复杂世界书 → 需要标签清理
- 有状态栏占位符 → 需要状态栏渲染+旧楼层清理

输出 JSON 数组：[{ "scriptName": "名称", "findRegex": "正则", "replaceString": "替换", "markdownOnly": bool, "promptOnly": bool, "minDepth": null或数字, "maxDepth": null或数字 }]

只输出真正需要的脚本，不要重复已有的。只输出JSON。`;

    const generated = await chatForJsonArray(apiStore, [
      { role: 'system', content: '你是正则脚本专家。只输出合法JSON数组。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 4096 });
    for (const s of generated) {
      store.addRegexScript({
        ...store.createEmptyRegexScript(),
        scriptName: s.scriptName || '新脚本',
        findRegex: s.findRegex || '',
        replaceString: s.replaceString || '',
        markdownOnly: s.markdownOnly || false,
        promptOnly: s.promptOnly || false,
        minDepth: s.minDepth ?? null,
        maxDepth: s.maxDepth ?? null
      });
    }
    appStore.toastSuccess(`AI 全自动生成了 ${generated.length} 个正则脚本`);
  } catch (e) {
    appStore.toastError('全自动生成失败: ' + e.message);
  } finally { aiGenerating.value = false; }
}

// 正则模板库
// 所有可选模板（用户单独添加）
const regexTemplates = [
  // --- 入门三件套 ---
  {
    name: '变量更新折叠（显示层）', essential: true,
    scriptName: '[折叠]变量更新', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gs',
    replaceString: '<details><summary>变量更新</summary>$&</details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: '变量更新清理（AI层）', essential: true,
    scriptName: '[清理]去除变量更新', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null
  },
  {
    name: '思维链隐藏（显示层）', essential: true,
    scriptName: '[隐藏]思维链', findRegex: '/<Analysis>[\\s\\S]*?<\\/Analysis>/gs',
    replaceString: '<details><summary>思维链</summary>$&</details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  // --- 单独可选（替代方案）---
  {
    name: '思维链清理（AI层）',
    scriptName: '[清理]去除思维链', findRegex: '/<Analysis>[\\s\\S]*?<\\/Analysis>/gm',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null
  },
  {
    name: '状态栏占位符隐藏（AI层）',
    scriptName: '[隐藏]状态栏占位符', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null
  },
  {
    name: '旧楼层HTML清理',
    scriptName: '[清理]旧楼层', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '',
    markdownOnly: true, promptOnly: false, minDepth: 3, maxDepth: null
  },
  {
    name: '变量美化（显示层）',
    scriptName: '[美化]完整变量完成', findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gs',
    replaceString: '<details style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#888">变量更新</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: '变量更新中美化（流式）',
    scriptName: '[美化]变量更新中', findRegex: '/<UpdateVariable>([\\s\\S]*?)$/gs',
    replaceString: '<details open style="background:rgba(0,0,0,0.15);border:1px solid rgba(100,200,255,0.15);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#60a5fa">变量更新中...</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: '变量更新隐藏（不显示）',
    scriptName: '[隐藏]变量更新', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gs',
    replaceString: '',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null
  },
  {
    name: '旧楼层变量清理（AI层minDepth6）',
    scriptName: '[不发送]去除旧变量', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '',
    markdownOnly: false, promptOnly: true, minDepth: 6, maxDepth: null
  }
];

// 完整套装 = 标准6件（不冲突的一套）
const fullSetTemplates = [
  { scriptName: '[不发送]去除旧变量', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '', markdownOnly: false, promptOnly: true, minDepth: 6, maxDepth: null },
  { scriptName: '[不发送]去除思维链', findRegex: '/<Analysis>[\\s\\S]*?<\\/Analysis>/gm',
    replaceString: '', markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null },
  { scriptName: '[不发送]界面占位符', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '', markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null },
  { scriptName: '[美化]完整变量完成', findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gs',
    replaceString: '<details style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#888">变量更新</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null },
  { scriptName: '[美化]变量更新中', findRegex: '/<UpdateVariable>([\\s\\S]*?)$/gs',
    replaceString: '<details open style="background:rgba(0,0,0,0.15);border:1px solid rgba(100,200,255,0.15);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#60a5fa">变量更新中...</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null },
  { scriptName: '[清理]旧楼层', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '', markdownOnly: true, promptOnly: false, minDepth: 3, maxDepth: null }
];

function addTemplate(t) {
  store.addRegexScript({
    ...store.createEmptyRegexScript(),
    scriptName: t.scriptName,
    findRegex: t.findRegex,
    replaceString: t.replaceString,
    markdownOnly: t.markdownOnly,
    promptOnly: t.promptOnly,
    minDepth: t.minDepth,
    maxDepth: t.maxDepth
  });
  appStore.toastSuccess('已添加: ' + t.scriptName);
}

function addAllEssentials() {
  // 入门三件套：变量折叠 + 变量清理 + 思维链隐藏
  const essentials = regexTemplates.filter(t => t.essential);
  essentials.forEach(t => addTemplate(t));
  appStore.toastSuccess('已添加入门三件套（' + essentials.length + '个）');
}

function addFullSet() {
  for (const t of fullSetTemplates) {
    store.addRegexScript({
      ...store.createEmptyRegexScript(),
      scriptName: t.scriptName,
      findRegex: t.findRegex,
      replaceString: t.replaceString,
      markdownOnly: t.markdownOnly,
      promptOnly: t.promptOnly,
      minDepth: t.minDepth,
      maxDepth: t.maxDepth
    });
  }
  appStore.toastSuccess('已添加完整套装（' + fullSetTemplates.length + '个）');
}

const placementOpts = [
  { val: 1, label: '用户消息' },
  { val: 2, label: 'AI消息' },
  { val: 3, label: '斜杠命令输出' },
  { val: 4, label: '世界书内容' }
];

function togglePlacement(script, val) {
  const idx = script.placement.indexOf(val);
  if (idx === -1) script.placement.push(val);
  else script.placement.splice(idx, 1);
  store.markDirty();
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.batch-bar {
  border: 1px solid rgba(96, 165, 250, 0.2);
  background: rgba(96, 165, 250, 0.04);
}
</style>

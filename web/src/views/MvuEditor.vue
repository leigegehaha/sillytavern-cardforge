<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>MVU 变量系统</h1>
        <p>引导式变量设计 — 从盘点到注入</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--danger btn--sm" @click="clearAllMvu" v-if="hasExistingMvu()">
          清空所有 MVU 条目
        </button>
        <div class="step-nav">
          <button v-for="(s, i) in steps" :key="i"
            class="step-btn" :class="{ active: step === i, done: i < step }"
            @click="goStep(i)">
            <span class="step-num">{{ i + 1 }}</span>
            <span class="step-label">{{ s }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 第一步：变量设计 ==================== -->
    <template v-if="step === 0">
      <div class="card mb-md">
        <div class="card__body hint" style="line-height:1.8">
          设计你的角色卡需要追踪哪些动态数据。可以用快捷预设或手动添加。<br>
          · <strong>AI 生成变量</strong>：前往「前端状态栏」页面，AI 会根据你的需求自动生成变量路径并创建完整 MVU 系统<br>
          · <strong>快捷预设</strong>：一键加载常见类型的变量模板<br>
          · <strong>变量前缀</strong>：_ 开头 = 只读（AI 看得见不能改），$ 开头 = 隐藏（AI 看不见）
        </div>
      </div>

      <div v-for="(group, gi) in varGroups" :key="gi" class="card mb-md"
        :class="{ 'mvu-group--dragging': groupDragSrcIdx === gi, 'mvu-group--dragover': groupDragOverIdx === gi }"
        :draggable="groupDragEnabledIdx === gi"
        @dragstart="onGroupDragStart($event, gi)"
        @dragover.prevent="onGroupDragOver($event, gi)"
        @dragleave="onGroupDragLeave(gi)"
        @drop.prevent="onGroupDrop($event, gi)"
        @dragend="onGroupDragEnd">
        <div class="card__header flex-between">
          <div class="flex-row">
            <span class="mvu-drag-handle"
              @mousedown="groupDragEnabledIdx = gi"
              @mouseup="groupDragEnabledIdx = null"
              @mouseleave="groupDragEnabledIdx = null"
              title="拖拽排序分组">&#x22EE;&#x22EE;</span>
            <input class="input" style="width:200px;font-weight:600" v-model="group.name"
              placeholder="分组名（如：世界、主角、NPC）">
            <span class="badge badge--accent">{{ group.fields.length }} 个变量</span>
          </div>
          <div class="flex-row">
            <button class="btn btn--secondary btn--sm" @click="addField(group)">+ 添加变量</button>
            <button class="btn btn--danger btn--sm"
              @click="appStore.confirmAction('删除这个变量分组？', () => varGroups.splice(gi, 1))">删除分组</button>
          </div>
        </div>
        <div class="card__body">
          <div v-for="(field, fi) in group.fields" :key="fi" class="var-field"
            :class="{ 'mvu-field--dragging': fieldDragSrc?.gi === gi && fieldDragSrc?.fi === fi, 'mvu-field--dragover': fieldDragOver?.gi === gi && fieldDragOver?.fi === fi }"
            :draggable="fieldDragEnabled?.gi === gi && fieldDragEnabled?.fi === fi"
            @dragstart="onFieldDragStart($event, gi, fi)"
            @dragover.prevent="onFieldDragOver($event, gi, fi)"
            @dragleave="onFieldDragLeave(gi, fi)"
            @drop.prevent="onFieldDrop($event, gi, fi)"
            @dragend="onFieldDragEnd">
            <div class="grid-4">
              <div class="form-group">
                <label>变量名</label>
                <input class="input" v-model="field.name" placeholder="如：HP、好感度">
              </div>
              <div class="form-group">
                <label>类型</label>
                <select class="select" v-model="field.type">
                  <option value="number">数字 (number)</option>
                  <option value="string">文本 (string)</option>
                  <option value="boolean">布尔 (boolean)</option>
                  <option value="enum">枚举 (enum)</option>
                  <option value="record">字典 (record)</option>
                  <option value="array">数组 (array)</option>
                </select>
              </div>
              <div class="form-group">
                <label>默认值</label>
                <input class="input" v-model="field.defaultValue" :placeholder="getDefaultPlaceholder(field.type)">
              </div>
              <div class="form-group" style="display:flex;align-items:flex-end;gap:4px">
                <span class="mvu-drag-handle"
                  @mousedown="fieldDragEnabled = { gi, fi }"
                  @mouseup="fieldDragEnabled = null"
                  @mouseleave="fieldDragEnabled = null"
                  title="拖拽排序">&#x22EE;&#x22EE;</span>
                <button class="btn btn--ghost btn--sm" @click="field.showAdvanced = !field.showAdvanced">
                  {{ field.showAdvanced ? '收起' : '高级' }}
                </button>
                <button class="btn btn--danger btn--sm" @click="group.fields.splice(fi, 1)">x</button>
              </div>
            </div>
            <div v-if="field.showAdvanced" class="var-advanced">
              <div class="grid-3" v-if="field.type === 'number'">
                <div class="form-group">
                  <label>最小值</label>
                  <input class="input" type="number" v-model.number="field.min" placeholder="不限">
                </div>
                <div class="form-group">
                  <label>最大值</label>
                  <input class="input" type="number" v-model.number="field.max" placeholder="不限">
                </div>
                <div class="form-group">
                  <label>自动钳位</label>
                  <select class="select" v-model="field.clamp">
                    <option :value="true">是（z.transform clamp）</option>
                    <option :value="false">否</option>
                  </select>
                </div>
              </div>
              <div v-if="field.type === 'enum'" class="form-group">
                <label>枚举值（逗号分隔）</label>
                <input class="input" v-model="field.enumValues" placeholder="如：炼气,筑基,金丹,元婴,化神">
              </div>
              <div v-if="field.type === 'record'" class="form-group">
                <label>子字段结构（逗号分隔 字段名:类型）</label>
                <input class="input" v-model="field.recordFields" placeholder="如：好感度:number,关系:string,位置:string">
              </div>
              <div class="form-group">
                <label>更新规则说明（用于 check 字段）</label>
                <input class="input" v-model="field.description"
                  placeholder="如：根据角色态度变化 +-3~6 / 突破成功后重置为0 / insert出场remove离场">
              </div>
            </div>
          </div>
          <div v-if="group.fields.length === 0" class="hint" style="text-align:center;padding:16px">
            暂无变量，点击上方「添加变量」
          </div>
        </div>
      </div>

      <div class="flex-row mb-md" style="flex-wrap:wrap">
        <button class="btn btn--secondary" @click="addGroup">+ 添加变量分组</button>
        <span class="hint" style="margin-left:12px">快捷预设：</span>
        <button v-for="p in presetKeys" :key="p.key" class="btn btn--ghost btn--sm"
          @click="loadPreset(p.key)">{{ p.label }}</button>
      </div>

      <div class="card mb-md">
        <div class="card__header"><h3>注入配置</h3></div>
        <div class="card__body">
          <div class="grid-2">
            <div class="form-group">
              <label>变量注入方式</label>
              <select class="select" v-model="injectMode">
                <option value="single">整体注入 — 一条条目注入全部变量</option>
                <option value="split">按分组拆分 — 每组独立条目，NPC 等可用绿灯触发</option>
              </select>
            </div>
            <div class="form-group">
              <label>保留最近几楼的变量更新发给 AI</label>
              <select class="select" v-model="keepFloors">
                <option :value="3">最近 3 楼（推荐，防止重复更新）</option>
                <option :value="2">最近 2 楼</option>
                <option :value="1">最近 1 楼</option>
                <option :value="0">全部不发送</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="trackPresentChars"> 启用在场角色追踪
            </label>
            <div class="hint">自动添加「在场角色」变量，AI 每次回复更新当前在场角色名单。</div>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <span></span>
        <button class="btn btn--primary" @click="goStep(1)"
          :disabled="varGroups.length === 0 || varGroups.every(g => !g.name)">
          下一步：审查确认
        </button>
      </div>
    </template>

    <!-- ==================== 第二步：审查确认 ==================== -->
    <template v-if="step === 1">
      <div class="card mb-md">
        <div class="card__body hint" style="line-height:1.8">
          审查生成的 Zod Schema、初始变量和更新规则。确认无误后进入下一步注入。
        </div>
      </div>

      <div v-if="checkIssues.length > 0" class="card mb-md">
        <div class="card__header"><h3 style="color:var(--cf-danger)">自查发现问题</h3></div>
        <div class="card__body">
          <ul style="margin:0;padding-left:20px">
            <li v-for="(issue, i) in checkIssues" :key="i" style="margin-bottom:4px">{{ issue }}</li>
          </ul>
          <div class="hint mt-sm">建议返回上一步修正后再注入。</div>
        </div>
      </div>

      <div class="card mb-md">
        <div class="card__header flex-between">
          <h3>Zod Schema（变量结构脚本）</h3>
          <button class="btn btn--ghost btn--sm" @click="copyText(zodCode)">复制</button>
        </div>
        <div class="card__body">
          <pre class="code-preview selectable">{{ zodCode }}</pre>
        </div>
      </div>

      <div class="card mb-md">
        <div class="card__header flex-between">
          <h3>[initvar] 变量初始化</h3>
          <button class="btn btn--ghost btn--sm" @click="copyText(initVarYaml)">复制</button>
        </div>
        <div class="card__body">
          <pre class="code-preview selectable">{{ initVarYaml }}</pre>
        </div>
      </div>

      <div class="card mb-md">
        <div class="card__header flex-between">
          <h3>[mvu_update] 变量更新规则</h3>
          <button class="btn btn--ghost btn--sm" @click="copyText(updateRuleText)">复制</button>
        </div>
        <div class="card__body">
          <pre class="code-preview selectable">{{ updateRuleText }}</pre>
        </div>
      </div>

      <div class="card mb-md">
        <div class="card__header"><h3>将生成的完整套装</h3></div>
        <div class="card__body hint" style="line-height:1.8">
          · 2 个脚本：MVU 变量系统（含 6 个操作按钮）+ Zod Schema<br>
          · 5 个世界书条目：[initvar]变量初始化勿开 + 变量列表 + [mvu_update]变量更新规则 + [mvu_update]变量输出格式 + [mvu_update]变量输出格式强调<br>
          · 4 个正则：[美化]变量更新中 + [美化]完整变量完成 + 只发送最新{{ keepFloors }}楼的变量更新 + [不发送]界面占位符<br>
          · 开场白末尾追加 &lt;StatusPlaceHolderImpl/&gt;<br>
          · 所有条目：D齿轮深度0，顺序200，不可递归
        </div>
      </div>

      <div class="step-actions">
        <button class="btn btn--secondary" @click="goStep(0)">上一步：修改变量</button>
        <button class="btn btn--primary" @click="generateAndInject">确认并注入</button>
      </div>
    </template>

    <!-- ==================== 第三步：注入完成 ==================== -->
    <template v-if="step === 2">
      <div class="card mb-md">
        <div class="card__body" style="text-align:center;padding:32px">
          <h2 style="color:var(--cf-accent);margin-bottom:12px">MVU 套装注入完成</h2>
          <p style="color:var(--cf-text-secondary);line-height:1.8">{{ injectSummary }}</p>
        </div>
      </div>

      <div class="card mb-md">
        <div class="card__body hint" style="line-height:1.8">
          <strong>前置插件确认：</strong><br>
          · 酒馆助手已安装，渲染页面「启用渲染器」已打开，「启用代码折叠」设为「仅前端」<br>
          · 提示词模板已安装<br>
          · 脚本库中「MVU」脚本已打开<br><br>
          <strong>下一步建议：</strong><br>
          · 前往「前端状态栏」页面生成状态栏界面<br>
          · 或新开聊天测试变量更新是否正常
        </div>
      </div>

      <div class="step-actions">
        <button class="btn btn--secondary" @click="goStep(0)">返回变量设计</button>
        <span></span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

/* ========================================================================
   步骤导航
   ======================================================================== */

const steps = ['变量设计', '审查确认', '注入完成'];
const step = ref(0);
function goStep(n) {
  if (n === 1 && (varGroups.length === 0 || varGroups.every(g => !g.name))) {
    appStore.toastError('请先添加变量分组');
    return;
  }
  step.value = n;
}

/* ========================================================================
   状态
   ======================================================================== */

const groupDragSrcIdx = ref(null);
const groupDragOverIdx = ref(null);
const groupDragEnabledIdx = ref(null);
function onGroupDragStart(e, gi) { groupDragSrcIdx.value = gi; e.dataTransfer.effectAllowed = 'move'; }
function onGroupDragOver(e, gi) { if (gi === groupDragSrcIdx.value) return; groupDragOverIdx.value = gi; e.dataTransfer.dropEffect = 'move'; }
function onGroupDragLeave(gi) { if (groupDragOverIdx.value === gi) groupDragOverIdx.value = null; }
function onGroupDrop(e, gi) { const src = groupDragSrcIdx.value; if (src !== null && src !== gi) { const [item] = varGroups.splice(src, 1); varGroups.splice(gi, 0, item); } groupDragSrcIdx.value = null; groupDragOverIdx.value = null; groupDragEnabledIdx.value = null; }
function onGroupDragEnd() { groupDragSrcIdx.value = null; groupDragOverIdx.value = null; groupDragEnabledIdx.value = null; }

const fieldDragSrc = ref(null);
const fieldDragOver = ref(null);
const fieldDragEnabled = ref(null);
function onFieldDragStart(e, gi, fi) { fieldDragSrc.value = { gi, fi }; e.dataTransfer.effectAllowed = 'move'; }
function onFieldDragOver(e, gi, fi) { if (fieldDragSrc.value?.gi !== gi || (fieldDragSrc.value?.gi === gi && fieldDragSrc.value?.fi === fi)) return; fieldDragOver.value = { gi, fi }; e.dataTransfer.dropEffect = 'move'; }
function onFieldDragLeave(gi, fi) { if (fieldDragOver.value?.gi === gi && fieldDragOver.value?.fi === fi) fieldDragOver.value = null; }
function onFieldDrop(e, gi, fi) { const src = fieldDragSrc.value; if (src && src.gi === gi && src.fi !== fi) { const [item] = varGroups[gi].fields.splice(src.fi, 1); varGroups[gi].fields.splice(fi, 0, item); } fieldDragSrc.value = null; fieldDragOver.value = null; fieldDragEnabled.value = null; }
function onFieldDragEnd() { fieldDragSrc.value = null; fieldDragOver.value = null; fieldDragEnabled.value = null; }

const injectMode = ref('single');
const keepFloors = ref(3);
const trackPresentChars = ref(false);
const injectSummary = ref('');

/* ========================================================================
   变量分组数据
   ======================================================================== */

const varGroups = reactive([]);
let _skipSave = false;

function mkField(name, type, defaultValue, min, max, clamp) {
  return {
    name: name || '', type: type || 'string', defaultValue: defaultValue || '',
    min: min ?? null, max: max ?? null, clamp: clamp || false,
    enumValues: '', recordFields: '', description: '', showAdvanced: false
  };
}

function loadVarGroupsFromCard() {
  _skipSave = true;
  varGroups.length = 0;
  const saved = cardStore.cardData.extensions?.cfMvuVarGroups;
  if (saved && saved.length > 0) {
    for (const g of saved) varGroups.push(JSON.parse(JSON.stringify(g)));
  } else {
    const parsed = parseVarGroupsFromWorldBook();
    if (parsed.length > 0) for (const g of parsed) varGroups.push(g);
  }
  _skipSave = false;
}

function parseVarGroupsFromWorldBook() {
  const groups = [];
  for (const e of cardStore.worldEntries) {
    const c = (e.comment || '').toLowerCase();
    if (!c.includes('initvar') && !c.includes('变量初始化')) continue;
    const lines = (e.content || '').split('\n');
    let cur = null;
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('<') || t.startsWith('{')) continue;
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        const m = line.match(/^(\S+)\s*[:：]/);
        if (m) { cur = { name: m[1].replace(/['"]/g, ''), fields: [] }; groups.push(cur); }
        continue;
      }
      if (cur) {
        const fm = t.match(/^(\S+)\s*[:：]\s*(.*)/);
        if (fm) {
          const n = fm[1].replace(/['"]/g, '');
          const v = (fm[2] || '').replace(/['"]/g, '').trim();
          if (!cur.fields.find(f => f.name === n))
            cur.fields.push(mkField(n, v !== '' && !isNaN(v) ? 'number' : 'string', v));
        }
      }
    }
    break;
  }
  return groups;
}

loadVarGroupsFromCard();
watch(() => cardStore.cardData.name, () => { loadVarGroupsFromCard(); step.value = 0; });
watch(varGroups, () => {
  if (_skipSave) return;
  if (!cardStore.cardData.extensions) cardStore.cardData.extensions = {};
  cardStore.cardData.extensions.cfMvuVarGroups = JSON.parse(JSON.stringify(varGroups));
  cardStore.markDirty();
}, { deep: true });

function addGroup() { varGroups.push({ name: '', fields: [] }); }
function addField(group) { group.fields.push(mkField('', 'number', '')); }
function getDefaultPlaceholder(type) {
  return { number: '如：100', string: '如：未知', boolean: 'true / false', enum: '第一个枚举值', record: '{}', array: '[]' }[type] || '';
}

/* ========================================================================
   快捷预设
   ======================================================================== */

const presetKeys = [
  { key: 'rpg', label: 'RPG' }, { key: 'xiuxian', label: '修仙' },
  { key: 'school', label: '校园' }, { key: 'simulation', label: '模拟经营' },
  { key: 'dating', label: '恋爱' }, { key: 'survival', label: '生存' }
];
const presets = {
  rpg: [
    { name: '世界', fields: [mkField('日期','string',''), mkField('时间','string',''), mkField('位置','string',''), mkField('天气','string','')] },
    { name: '主角', fields: [mkField('HP','number','100',0,100,true), mkField('MP','number','50',0,50,true), mkField('等级','number','1',1,99,true), mkField('经验','number','0',0,null,true), mkField('金币','number','500',0,null,true)] },
    { name: 'NPC', fields: [mkField('','record','',null,null,false)] },
    { name: '背包', fields: [mkField('','record','',null,null,false)] }
  ],
  xiuxian: [
    { name: '世界', fields: [mkField('日期','string',''), mkField('位置','string','')] },
    { name: '主角', fields: [mkField('修为境界','enum','凡人'), mkField('修炼进度','number','0',0,100,true), mkField('灵力','number','100',0,100,true), mkField('灵石','number','100',0,null,true)] },
    { name: 'NPC', fields: [mkField('','record','',null,null,false)] },
    { name: '背包', fields: [mkField('','record','',null,null,false)] }
  ],
  school: [
    { name: '系统', fields: [mkField('日期','string',''), mkField('时间','string',''), mkField('星期','string',''), mkField('位置','string','')] },
    { name: '主角', fields: [mkField('体力','number','100',0,100,true), mkField('心情','number','80',0,100,true), mkField('金钱','number','5000',0,null,true)] },
    { name: 'NPC', fields: [mkField('','record','',null,null,false)] }
  ],
  simulation: [
    { name: '系统', fields: [mkField('日期','string',''), mkField('回合数','number','1',1,null,false), mkField('行动点','number','5',0,10,true)] },
    { name: '资源', fields: [mkField('金币','number','10000',0,null,true), mkField('声望','number','0',-100,100,true), mkField('人口','number','10',0,null,true)] }
  ],
  dating: [
    { name: '系统', fields: [mkField('日期','string',''), mkField('时间','string',''), mkField('位置','string','')] },
    { name: '主角', fields: [mkField('魅力','number','50',0,100,true), mkField('金钱','number','3000',0,null,true), mkField('体力','number','100',0,100,true)] },
    { name: 'NPC', fields: [mkField('','record','',null,null,false)] }
  ],
  survival: [
    { name: '环境', fields: [mkField('天数','number','1',1,null,false), mkField('天气','string',''), mkField('温度','number','25'), mkField('位置','string','')] },
    { name: '生存', fields: [mkField('HP','number','100',0,100,true), mkField('饥饿','number','100',0,100,true), mkField('口渴','number','100',0,100,true), mkField('体力','number','100',0,100,true)] },
    { name: '物资', fields: [mkField('','record','',null,null,false)] }
  ]
};
function loadPreset(key) {
  const p = presets[key]; if (!p) return;
  varGroups.length = 0;
  for (const g of p) varGroups.push({ name: g.name, fields: g.fields.map(f => ({ ...f })) });
  appStore.toastSuccess('预设已加载，可继续调整');
}

/* ========================================================================
   世界书条目通用配置
   position=4 (D齿轮在深度), depth=0, order=200, 不可递归
   ======================================================================== */

function applyEntryConfig(entry, opts = {}) {
  entry.constant = opts.constant !== undefined ? opts.constant : true;
  entry.enabled = opts.enabled !== undefined ? opts.enabled : true;
  entry.extensions.position = 4;
  entry.insertion_order = opts.order || 200;
  if (!entry.extensions) entry.extensions = {};
  entry.extensions.depth = opts.depth !== undefined ? opts.depth : 0;
  entry.extensions.prevent_recursion = true;
  entry.extensions.exclude_recursion = true;
}

/* ========================================================================
   Zod Schema 生成
   完整规则：z.coerce.number / z.prefault(非z.default) / z.transform clamp(软约束) /
   prefault值必须是schema合法输入 / compound prefault时子字段也prefault /
   z.record优于z.array / 不用z.strict z.passthrough / 幂等性 /
   z.describe仅在字段名不够解释时(如record的key类型)
   ======================================================================== */

const zodCode = computed(() => {
  if (varGroups.length === 0 || varGroups.every(g => !g.name)) return '(请先添加变量分组)';
  let code = "import { registerMvuSchema } from\n  'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';\n\nexport const Schema = z.object({\n";
  for (const group of varGroups) {
    if (!group.name) continue;
    const wholeRecord = group.fields.length === 1 && group.fields[0].type === 'record' && !group.fields[0].name;
    if (wholeRecord) {
      code += `  ${group.name}: ${buildZodType(group.fields[0], group.name)},\n`;
    } else {
      code += `  ${group.name}: z.object({\n`;
      /* 构建嵌套树处理含.的字段名 */
      const zodTree = {};
      for (const f of group.fields) {
        if (!f.name) continue;
        const parts = f.name.split('.');
        let node = zodTree;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!node[parts[i]]) node[parts[i]] = { __children: {} };
          node = node[parts[i]].__children;
        }
        node[parts[parts.length - 1]] = { __field: f };
      }
      code += zodTreeToCode(zodTree, 2);
      code += '  }).prefault({}),\n';
    }
  }
  if (trackPresentChars.value) {
    code += "  在场角色追踪: z.object({\n    在场角色: z.string().prefault('')\n  }).prefault({}),\n";
  }
  code += '});\n\n$(() => {\n  registerMvuSchema(Schema);\n});\n';
  return code;
});

function zodTreeToCode(tree, indent) {
  let code = '';
  const pad = '  '.repeat(indent);
  for (const [k, v] of Object.entries(tree)) {
    if (v.__field) {
      code += `${pad}${k}: ${buildZodType(v.__field)},\n`;
    } else if (v.__children) {
      code += `${pad}${k}: z.object({\n`;
      code += zodTreeToCode(v.__children, indent + 1);
      code += `${pad}}).prefault({}),\n`;
    }
  }
  return code;
}

function buildZodType(field, groupName) {
  switch (field.type) {
    case 'number': {
      let t = 'z.coerce.number()';
      if (field.clamp && (field.min !== null || field.max !== null)) {
        const lo = field.min ?? -999999;
        const hi = field.max ?? 999999;
        t += `.transform(v => _.clamp(v, ${lo}, ${hi}))`;
      }
      t += `.prefault(${field.defaultValue || 0})`;
      return t;
    }
    case 'string':
      return `z.string().prefault('${field.defaultValue || ''}')`;
    case 'boolean':
      return `z.boolean().prefault(${field.defaultValue || 'false'})`;
    case 'enum': {
      const vals = (field.enumValues || '').split(',').map(v => `'${v.trim()}'`).filter(v => v !== "''").join(', ');
      return `z.enum([${vals}]).prefault('${field.defaultValue || ''}')`;
    }
    case 'record': {
      const keyDesc = groupName || field.name || '键名';
      const sub = (field.recordFields || '').split(',').map(s => {
        const parts = s.trim().split(':');
        if (parts.length < 2 || !parts[0]) return '';
        const n = parts[0].trim();
        const t = parts[1].trim();
        const zt = t === 'number' ? 'z.coerce.number().prefault(0)' : "z.string().prefault('')";
        return `      ${n}: ${zt}`;
      }).filter(Boolean).join(',\n');
      if (sub) {
        return `z.record(\n    z.string().describe('${keyDesc}'),\n    z.object({\n${sub}\n    }).prefault({})\n  ).prefault({})`;
      }
      return `z.record(z.string().describe('${keyDesc}'), z.string().prefault('')).prefault({})`;
    }
    case 'array':
      return "z.array(z.string()).prefault([])";
    default:
      return "z.string().prefault('')";
  }
}

/* ========================================================================
   InitVar YAML 生成
   record类型 = {}, 三层路径正确嵌套
   ======================================================================== */

const initVarYaml = computed(() => {
  if (varGroups.length === 0) return '(请添加变量分组)';
  let yaml = '';
  for (const group of varGroups) {
    if (!group.name) continue;
    yaml += `${group.name}:\n`;
    /* 构建嵌套树：处理字段名含.的情况（如 货币.石质天元 → 货币: 石质天元:） */
    const tree = {};
    for (const f of group.fields) {
      if (!f.name) continue;
      const parts = f.name.split('.');
      let node = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]] || typeof node[parts[i]] !== 'object' || node[parts[i]].__leaf) node[parts[i]] = {};
        node = node[parts[i]];
      }
      const leaf = parts[parts.length - 1];
      let val;
      if (f.type === 'record') val = '{}';
      else if (f.type === 'number') val = f.defaultValue || '0';
      else if (f.type === 'boolean') val = f.defaultValue || 'false';
      else if (f.type === 'array') val = '[]';
      else val = `"${f.defaultValue || ''}"`;
      node[leaf] = { __leaf: true, val };
    }
    yaml += treeToYaml(tree, 1);
  }
  if (trackPresentChars.value) yaml += '在场角色追踪:\n  在场角色: ""\n';
  return yaml || '(请添加变量)';
});

function treeToYaml(obj, indent) {
  let yaml = '';
  const pad = '  '.repeat(indent);
  for (const [k, v] of Object.entries(obj)) {
    if (v && v.__leaf) {
      yaml += `${pad}${k}: ${v.val}\n`;
    } else {
      yaml += `${pad}${k}:\n${treeToYaml(v, indent + 1)}`;
    }
  }
  return yaml;
}

/* ========================================================================
   变量更新规则生成
   type/range/format/check 结构
   自明变量省略 / 同类路径合并 / record用TS风格type /
   _只读不列 / check写具体触发条件和幅度
   ======================================================================== */

const updateRuleText = computed(() => {
  if (varGroups.length === 0) return '(请先添加变量)';
  let text = '---\n变量更新规则:\n';
  for (const group of varGroups) {
    if (!group.name) continue;
    const updatable = group.fields.filter(f => f.name && !f.name.startsWith('_'));
    if (updatable.length === 0) continue;
    text += `  ${group.name}:\n`;

    /* 按.拆分第一层分组，合并同一子分组下的字段 */
    const subGroups = {};
    const topLevel = [];
    for (const f of updatable) {
      const dotIdx = f.name.indexOf('.');
      if (dotIdx > 0) {
        const sub = f.name.substring(0, dotIdx);
        const leaf = f.name.substring(dotIdx + 1);
        if (!subGroups[sub]) subGroups[sub] = [];
        subGroups[sub].push({ ...f, leafName: leaf });
      } else {
        topLevel.push(f);
      }
    }

    /* 输出顶层字段 */
    const plainStrings = topLevel.filter(f => f.type === 'string' && !f.description);
    const others = topLevel.filter(f => !(f.type === 'string' && !f.description));

    if (plainStrings.length > 1) {
      text += `    ${plainStrings.map(f => f.name).join(', ')}:\n`;
      text += '      check:\n        - update when this information changes in the narrative\n';
    } else if (plainStrings.length === 1) {
      text += `    ${plainStrings[0].name}:\n`;
      text += '      check:\n        - update when this information changes in the narrative\n';
    }
    for (const f of others) {
      text += buildRuleField(f, f.name, 4);
    }

    /* 输出嵌套子分组：合并同一子分组下的同类字段 */
    for (const [sub, fields] of Object.entries(subGroups)) {
      text += `    ${sub}:\n`;
      const subPlain = fields.filter(f => f.type === 'string' && !f.description);
      const subOthers = fields.filter(f => !(f.type === 'string' && !f.description));

      if (subPlain.length > 1) {
        text += `      ${subPlain.map(f => f.leafName).join(', ')}:\n`;
        text += '        check:\n          - update when this information changes in the narrative\n';
      } else if (subPlain.length === 1) {
        text += `      ${subPlain[0].leafName}:\n`;
        text += '        check:\n          - update when this information changes in the narrative\n';
      }
      /* 合并同类型+同描述的非string字段 */
      const sameCheck = {};
      for (const f of subOthers) {
        const key = f.type + '|' + (f.description || getDefaultCheck(f));
        if (!sameCheck[key]) sameCheck[key] = [];
        sameCheck[key].push(f);
      }
      for (const [, group] of Object.entries(sameCheck)) {
        if (group.length > 1) {
          text += `      ${group.map(f => f.leafName).join(', ')}:\n`;
          const f0 = group[0];
          if (f0.type === 'number') text += '        type: number\n';
          text += '        check:\n';
          text += `          - ${f0.description || getDefaultCheck(f0)}\n`;
        } else {
          text += buildRuleField(group[0], group[0].leafName, 6);
        }
      }
    }
  }
  if (trackPresentChars.value) {
    text += '  在场角色追踪:\n    在场角色:\n      check:\n        - update with comma-separated names of characters currently present in the scene\n';
  }
  return text;
});

function buildRuleField(f, name, indent) {
  const pad = '  '.repeat(indent / 2);
  let text = `${pad}${name}:\n`;
  if (f.type === 'number') {
    text += `${pad}  type: number\n`;
    if (f.min !== null || f.max !== null)
      text += `${pad}  range: ${f.min ?? 0}~${f.max ?? '...'}\n`;
  } else if (f.type === 'enum' && f.enumValues) {
    text += `${pad}  type: ${f.enumValues.split(',').map(v => "'" + v.trim() + "'").join('|')}\n`;
  } else if (f.type === 'record') {
    const sub = (f.recordFields || '').split(',').map(s => {
      const parts = s.trim().split(':');
      return parts.length >= 2 ? `${pad}      ${parts[0].trim()}: ${parts[1].trim()};` : '';
    }).filter(Boolean).join('\n');
    if (sub)
      text += `${pad}  type: |-\n${pad}    {\n${pad}      [${name}: string]: {\n${sub}\n${pad}      }\n${pad}    }\n`;
  } else if (f.type === 'boolean') {
    text += `${pad}  type: boolean\n`;
  }
  text += `${pad}  check:\n`;
  text += `${pad}    - ${f.description || getDefaultCheck(f)}\n`;
  return text;
}

function getDefaultCheck(field) {
  switch (field.type) {
    case 'number': return 'update when relevant events cause this value to change, use reasonable delta';
    case 'enum': return 'update only when conditions trigger a stage transition';
    case 'record': return 'insert when new entries appear, remove when they leave or are consumed';
    case 'boolean': return 'toggle when the condition changes';
    default: return 'update when this information changes in the narrative';
  }
}

/* ========================================================================
   固定模板 — 原封不动照抄教程
   ======================================================================== */

const OUTPUT_FORMAT_TEXT = `---
变量输出格式:
  rule:
    - you must output the update analysis and the actual update commands at once in the end of the next reply
    - the update commands works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:
      - replace: replace the value of existing paths
      - delta: update the value of existing number paths by a delta value
      - insert: insert new items into an object or array (using \`-\` as array index intends appending to the end)
      - remove
      - move
    - don't update field names starts with \`_\` as they are readonly, such as \`_变量\`
  format: |-
    <UpdateVariable>
    <Analysis>$(IN CHINESE, no more than 400 words)
    - \${calculate time passed: ...}
    - \${decide whether dramatic updates are allowed as it's in a special case or the time passed is more than usual: yes/no}
    - \${analyze every variable based on its corresponding \`check\`, according only to current reply instead of previous plots: ...}
    </Analysis>
    <JSONPatch>
    [
      { "op": "replace", "path": "\${/path/to/variable}", "value": "\${new_value}" },
      { "op": "delta", "path": "\${/path/to/number/variable}", "value": "\${positive_or_negative_delta}" },
      { "op": "insert", "path": "\${/path/to/object/new_key}", "value": "\${new_value}" },
      { "op": "insert", "path": "\${/path/to/array/-}", "value": "\${new_value}" },
      { "op": "remove", "path": "\${/path/to/object/key}" },
      { "op": "remove", "path": "\${/path/to/array/0}" },
      { "op": "move", "from": "\${/path/to/variable}", "to": "\${/path/to/another/path}" },
      ...
    ]
    </JSONPatch>
    </UpdateVariable>`;

const OUTPUT_EMPHASIS_TEXT = `---
变量输出格式强调:
  rule: The following must be inserted to the end of reply, and cannot be omitted
  format: |-
    <UpdateVariable>
    ...
    </UpdateVariable>`;

const VARIABLE_LIST_TEXT = `---
<status_current_variables>
{{format_message_variable::stat_data}}
</status_current_variables>`;

/* ========================================================================
   自查逻辑 — 内置MVU自查清单的核心检查项
   ======================================================================== */

const checkIssues = computed(() => {
  const issues = [];
  /* Schema脚本检查 */
  if (zodCode.value.includes('z.number()') && !zodCode.value.includes('z.coerce.number()'))
    issues.push('Zod: 应使用 z.coerce.number() 而非 z.number()');
  if (zodCode.value.includes('.default('))
    issues.push('Zod: 应使用 .prefault() 而非 .default()');
  if (zodCode.value.includes('.strict(') || zodCode.value.includes('.passthrough('))
    issues.push('Zod: z.strict 和 z.passthrough 不存在，请移除');
  if (zodCode.value.includes('.min(') || zodCode.value.includes('.max('))
    issues.push('Zod: 建议用 .transform(v => _.clamp()) 替代 .min()/.max()');

  /* 变量结构检查 */
  for (const g of varGroups) {
    if (!g.name) { issues.push('存在未命名的变量分组'); continue; }
    for (const f of g.fields) {
      if (f.type === 'enum' && !f.enumValues)
        issues.push(`${g.name}.${f.name}: 枚举类型缺少枚举值`);
      if (f.type === 'number' && f.clamp && f.min === null && f.max === null)
        issues.push(`${g.name}.${f.name}: 开启了钳位但未设置最小/最大值`);
    }
  }
  return issues;
});

/* ========================================================================
   AI 推荐变量
   融合 A.U.T.O. Step16 数据盘点思路：先通读角色卡盘点动态数据，
   再根据卡的世界观和互动范式设计变量，不套RPG模板
   ======================================================================== */


/* ========================================================================
   生成并注入
   完整套装：2脚本 + 5世界书 + 4正则 + 开场白占位符
   ======================================================================== */

const mvuKeywords = ['变量更新规则', '变量输出格式', '变量输出格式强调', '当前变量值',
  '变量初始化', '变量列表', 'Zod Schema', 'MVU 变量系统', 'MVUbeta'];
const regexKeywords = ['变量更新中', '完整变量完成', '变量更新', '界面占位符'];

function hasExistingMvu() {
  return cardStore.worldEntries.some(e => mvuKeywords.some(k => (e.comment || '').includes(k)))
    || cardStore.tavernScripts.some(s => mvuKeywords.some(k => (s.name || '').includes(k)));
}

function removeExistingMvu() {
  for (let i = cardStore.worldEntries.length - 1; i >= 0; i--) {
    if (mvuKeywords.some(k => (cardStore.worldEntries[i].comment || '').includes(k)))
      cardStore.removeWorldEntry(cardStore.worldEntries[i].id);
  }
  for (let i = cardStore.tavernScripts.length - 1; i >= 0; i--) {
    if (mvuKeywords.some(k => (cardStore.tavernScripts[i].name || '').includes(k)))
      cardStore.removeTavernScript(cardStore.tavernScripts[i].id);
  }
  for (let i = cardStore.regexScripts.length - 1; i >= 0; i--) {
    if (regexKeywords.some(k => (cardStore.regexScripts[i].scriptName || '').includes(k)))
      cardStore.removeRegexScript(cardStore.regexScripts[i].id);
  }
}

function clearAllMvu() {
  appStore.confirmAction('确定清空所有 MVU 条目？（脚本 + 世界书 + 正则 + 开场白占位符）', () => {
    removeExistingMvu();
    /* 清除开场白中的占位符 */
    if (cardStore.cardData.first_mes) {
      cardStore.cardData.first_mes = cardStore.cardData.first_mes.replace(/\n?<StatusPlaceHolderImpl\s*\/>/g, '');
    }
    for (let i = 0; i < (cardStore.cardData.alternate_greetings || []).length; i++) {
      cardStore.cardData.alternate_greetings[i] = cardStore.cardData.alternate_greetings[i].replace(/\n?<StatusPlaceHolderImpl\s*\/>/g, '');
    }
    /* 清除varGroups */
    varGroups.length = 0;
    if (cardStore.cardData.extensions) {
      delete cardStore.cardData.extensions.cfMvuVarGroups;
    }
    cardStore.markDirty();
    step.value = 0;
    appStore.toastSuccess('所有 MVU 条目已清空');
  });
}

function generateAndInject() {
  if (hasExistingMvu()) {
    appStore.confirmAction('已存在 MVU 条目，是否替换？', () => { removeExistingMvu(); doInject(); });
  } else {
    doInject();
  }
}

function doInject() {
  /* ---- 脚本1: MVU 加载 + 6个操作按钮 ---- */
  const mvuScript = cardStore.createEmptyTavernScript();
  mvuScript.name = 'MVU 变量系统';
  mvuScript.content = "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';";
  mvuScript.button = {
    enabled: true,
    buttons: [
      { name: '重新处理变量', visible: true },
      { name: '重新读取初始变量', visible: true },
      { name: '清除旧楼层变量', visible: false },
      { name: '快照楼层', visible: false },
      { name: '重演楼层', visible: false },
      { name: '重试额外模型解析', visible: false }
    ]
  };
  cardStore.addTavernScript(mvuScript);

  /* ---- 脚本2: Zod Schema ---- */
  const zodScript = cardStore.createEmptyTavernScript();
  zodScript.name = 'Zod Schema';
  zodScript.content = zodCode.value;
  cardStore.addTavernScript(zodScript);

  /* ---- 世界书1: [initvar]变量初始化勿开 (disabled) ---- */
  const initEntry = cardStore.addWorldEntry();
  initEntry.comment = '[initvar]变量初始化勿开';
  initEntry.content = initVarYaml.value;
  applyEntryConfig(initEntry, { constant: false, enabled: false });

  /* ---- 世界书2: 变量列表 (不加[mvu_update]！两个AI都需要看到) ---- */
  if (injectMode.value === 'split') {
    let orderBase = 190;
    for (const group of varGroups) {
      if (!group.name) continue;
      const ve = cardStore.addWorldEntry();
      ve.comment = `${group.name}变量`;
      ve.content = `${group.name}:\n  {{format_message_variable::stat_data.${group.name}}}`;
      const alwaysOn = ['世界', '系统', '环境', '主角'].includes(group.name);
      applyEntryConfig(ve, { constant: alwaysOn, order: orderBase++ });
      if (!alwaysOn) ve.keys = [group.name];
    }
  } else {
    const varEntry = cardStore.addWorldEntry();
    varEntry.comment = '变量列表';
    varEntry.content = VARIABLE_LIST_TEXT;
    applyEntryConfig(varEntry);
  }

  /* ---- 世界书3: [mvu_update]变量更新规则 ---- */
  const ruleEntry = cardStore.addWorldEntry();
  ruleEntry.comment = '[mvu_update]变量更新规则';
  ruleEntry.content = updateRuleText.value;
  applyEntryConfig(ruleEntry);

  /* ---- 世界书4: [mvu_update]变量输出格式 ---- */
  const fmtEntry = cardStore.addWorldEntry();
  fmtEntry.comment = '[mvu_update]变量输出格式';
  fmtEntry.content = OUTPUT_FORMAT_TEXT;
  applyEntryConfig(fmtEntry);

  /* ---- 世界书5: [mvu_update]变量输出格式强调 ---- */
  const emphEntry = cardStore.addWorldEntry();
  emphEntry.comment = '[mvu_update]变量输出格式强调';
  emphEntry.content = OUTPUT_EMPHASIS_TEXT;
  applyEntryConfig(emphEntry);

  /* ---- 4个正则（顺序：更新中 → 完整 → 只发送N楼 → 界面占位符）---- */

  /* 正则1: [美化]变量更新中 — 必须在"完整"之前 */
  cardStore.addRegexScript({
    ...cardStore.createEmptyRegexScript(),
    scriptName: '[美化]变量更新中',
    findRegex: '/<UpdateVariable>([\\s\\S]*?)$/gs',
    replaceString: '<details open style="background:rgba(0,0,0,0.15);border:1px solid rgba(100,200,255,0.15);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#60a5fa">变量更新中...</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true,
    promptOnly: false
  });

  /* 正则2: [美化]完整变量完成 */
  cardStore.addRegexScript({
    ...cardStore.createEmptyRegexScript(),
    scriptName: '[美化]完整变量完成',
    findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gs',
    replaceString: '<details style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#888">变量更新</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
    markdownOnly: true,
    promptOnly: false
  });

  /* 正则3: 只发送最新N楼的变量更新 */
  const minD = keepFloors.value * 2;
  cardStore.addRegexScript({
    ...cardStore.createEmptyRegexScript(),
    scriptName: `只发送最新${keepFloors.value}楼的变量更新`,
    findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
    replaceString: '',
    markdownOnly: false,
    promptOnly: true,
    minDepth: minD || null
  });

  /* 正则4: [不发送]界面占位符 */
  cardStore.addRegexScript({
    ...cardStore.createEmptyRegexScript(),
    scriptName: '[不发送]界面占位符',
    findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
    replaceString: '',
    markdownOnly: false,
    promptOnly: true
  });

  /* ---- 开场白追加 StatusPlaceHolderImpl ---- */
  const firstMes = cardStore.cardData.first_mes || '';
  if (!firstMes.includes('StatusPlaceHolderImpl'))
    cardStore.cardData.first_mes = firstMes + '\n<StatusPlaceHolderImpl/>';
  for (let i = 0; i < (cardStore.cardData.alternate_greetings || []).length; i++) {
    if (!cardStore.cardData.alternate_greetings[i].includes('StatusPlaceHolderImpl'))
      cardStore.cardData.alternate_greetings[i] += '\n<StatusPlaceHolderImpl/>';
  }

  cardStore.markDirty();
  const ec = injectMode.value === 'split' ? 4 + varGroups.filter(g => g.name).length : 5;
  injectSummary.value = `2 脚本 + ${ec} 世界书条目 + 4 正则 + 开场白占位符`;
  step.value = 2;
  appStore.toastSuccess('MVU 套装注入完成');
}

/* ========================================================================
   工具
   ======================================================================== */

function copyText(text) {
  navigator.clipboard.writeText(text);
  appStore.toastSuccess('已复制');
}
</script>

<style scoped>
/* 步骤导航 */
.step-nav {
  display: flex; gap: 4px;
}
.step-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  background: rgba(0,0,0,0.15); border: 1px solid var(--cf-border);
  color: var(--cf-text-muted); font-size: 12px; cursor: pointer;
  transition: all 0.2s;
}
.step-btn:hover { border-color: rgba(255,215,0,0.3); }
.step-btn.active {
  background: rgba(255,215,0,0.1); border-color: rgba(255,215,0,0.5);
  color: #ffd700;
}
.step-btn.done {
  background: rgba(100,200,100,0.1); border-color: rgba(100,200,100,0.4);
  color: #8fc; }
.step-num {
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.08); font-weight: 600; font-size: 11px;
}
.step-btn.active .step-num { background: rgba(255,215,0,0.25); }
.step-btn.done .step-num { background: rgba(100,200,100,0.25); }

/* 步骤底部操作栏 */
.step-actions {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 0; margin-top: 8px;
}

/* 变量字段卡片 */
.mvu-drag-handle { cursor: grab; padding: 0 6px; color: var(--cf-text-muted); font-size: 14px; letter-spacing: -2px; user-select: none; }
.mvu-drag-handle:active { cursor: grabbing; }
.mvu-group--dragging { opacity: 0.4; }
.mvu-group--dragover { border-color: var(--cf-accent) !important; box-shadow: 0 0 8px rgba(96,165,250,0.3); }
.mvu-field--dragging { opacity: 0.4; }
.mvu-field--dragover { border-color: var(--cf-accent) !important; box-shadow: 0 0 6px rgba(96,165,250,0.25); }
.var-field {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 12px; margin-bottom: 8px;
}
.var-advanced {
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid var(--cf-border);
}
.grid-4 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: var(--cf-gap-sm); align-items: end;
}
.code-preview {
  font-family: var(--cf-font-mono);
  font-size: 12px; line-height: 1.6;
  color: var(--cf-text-primary);
  white-space: pre-wrap; word-wrap: break-word;
  background: none; border: none; margin: 0;
  max-height: 400px; overflow-y: auto;
}
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
</style>

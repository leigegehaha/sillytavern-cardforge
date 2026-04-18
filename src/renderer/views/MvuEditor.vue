<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>MVU 变量系统</h1>
        <p>可视化设计变量结构，自动生成 Zod Schema 和 MVU 脚本</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--accent" @click="aiRecommend" :disabled="aiGen">
          {{ aiGen ? '推荐中...' : 'AI 推荐变量' }}
        </button>
        <button class="btn btn--primary" @click="generateAndInject">生成并注入脚本</button>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        MVU（MagVarUpdate）是 SillyTavern 的变量管理系统，让 AI 在每次回复中更新游戏数据（HP、好感度、位置等）。<br>
        · <strong>第一步</strong>：在下方设计你的变量结构（或用快捷预设 / AI 推荐）<br>
        · <strong>第二步</strong>：点右上角「生成并注入脚本」，会自动创建 MVU 加载脚本 + Zod Schema + 初始变量 + 变量更新规则 + 配套正则<br>
        · <strong>AI 推荐变量</strong>：让 AI 根据角色卡推荐变量结构，结果会填到下方 UI（可继续手动调整），不直接注入<br>
        · <strong>Zod Schema</strong>：定义变量的类型和范围，防止 AI 输出异常值（如好感度变成999999）<br>
        · <strong>前置插件</strong>：玩家需要安装「酒馆助手」和「提示词模板」两个插件才能使用 MVU<br>
        · <strong>变量前缀</strong>：变量名加 _ 开头表示只读（AI看得见但不能改），加 $ 开头表示隐藏（AI看不见）<br>
        · <strong>条目前缀</strong>：[mvu_update] 仅发给变量解析AI，[mvu_plot] 仅发给剧情AI，无前缀两个AI都收到
      </div>
    </div>

    <!-- AI 推荐额外要求 -->
    <div class="card mb-md">
      <div class="card__header"><h3>AI 推荐额外要求</h3></div>
      <div class="card__body">
        <input class="input" v-model="aiExtraReq"
          placeholder="如：要修仙系统不要校园 / 加入NPC好感度+背包 / 不要HP和MP...">
        <div class="hint mt-md">点击右上角「AI 推荐变量」时会带上这些要求。</div>
      </div>
    </div>

    <!-- 变量组列表 -->
    <div v-for="(group, gi) in varGroups" :key="gi" class="card mb-md">
      <div class="card__header flex-between">
        <div class="flex-row">
          <input class="input" style="width:200px;font-weight:600" v-model="group.name" placeholder="分组名称（如：世界、主角、NPC）">
          <span class="badge badge--accent">{{ group.fields.length }} 个变量</span>
        </div>
        <div class="flex-row">
          <button class="btn btn--secondary btn--sm" @click="addField(group)">+ 添加变量</button>
          <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('删除这个变量分组？', () => varGroups.splice(gi, 1))">删除分组</button>
        </div>
      </div>
      <div class="card__body">
        <div v-for="(field, fi) in group.fields" :key="fi" class="var-field">
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
              <button class="btn btn--ghost btn--sm" @click="field.showAdvanced = !field.showAdvanced">
                {{ field.showAdvanced ? '收起' : '高级' }}
              </button>
              <button class="btn btn--danger btn--sm" @click="group.fields.splice(fi, 1)">×</button>
            </div>
          </div>

          <!-- 高级设置 -->
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
                  <option :value="true">是（超出范围自动修正）</option>
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
              <label>说明</label>
              <input class="input" v-model="field.description" placeholder="这个变量的用途说明">
            </div>
          </div>
        </div>

        <div v-if="group.fields.length === 0" class="hint" style="text-align:center;padding:16px">
          暂无变量，点击上方「添加变量」
        </div>
      </div>
    </div>

    <button class="btn btn--secondary mb-md" @click="addGroup">+ 添加变量分组</button>

    <!-- 格式与选项 -->
    <div class="card mb-md">
      <div class="card__header"><h3>变量更新格式</h3></div>
      <div class="card__body">
        <div class="grid-2">
          <div class="form-group">
            <label>AI 输出变量更新的格式</label>
            <select class="select" v-model="updateFormat">
              <option value="lodash">lodash 格式 — _.set('路径', 旧值, 新值)</option>
              <option value="jsonpatch">JSON Patch (RFC 6902) — replace/delta 操作</option>
            </select>
            <div class="hint">lodash 格式更直观易读，JSON Patch 更标准精确。大多数卡用 lodash。</div>
          </div>
          <div class="form-group">
            <label>变量注入方式</label>
            <select class="select" v-model="injectMode">
              <option value="single">整体注入 — 一条条目注入全部变量</option>
              <option value="split">按分组拆分 — 每个分组一条条目（适合有NPC的卡）</option>
            </select>
            <div class="hint">拆分注入可以让 NPC 变量跟随关键词触发，节省 Token。</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>条目命名前缀</label>
            <select class="select" v-model="namingPrefix">
              <option value="none">无前缀</option>
              <option value="mvu">加 [mvu_update] / [mvu_plot] 前缀</option>
              <option value="bracket">加 【变量】/ 【设定】 前缀</option>
            </select>
            <div class="hint">前缀帮助区分条目类型，方便管理大量条目。</div>
          </div>
          <div class="form-group">
            <label>变量列表 XML 包裹</label>
            <select class="select" v-model="xmlWrap">
              <option value="none">不包裹</option>
              <option value="status">用 &lt;status_current_variable&gt; 包裹</option>
              <option value="custom">自定义标签</option>
            </select>
            <div class="hint">XML 标签帮助 AI 区分变量数据和正文内容。</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="trackPresentChars"> 启用在场角色追踪
            </label>
            <div class="hint">勾选后会自动添加"在场角色"变量，AI 每次回复更新当前在场的角色名单，状态栏据此动态显示/隐藏角色面板。</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 变量提示词布局 -->
    <div class="card mb-md">
      <div class="card__header"><h3>变量提示词布局策略</h3></div>
      <div class="card__body">
        <div class="form-group">
          <label>布局方案</label>
          <select class="select" v-model="layoutStrategy">
            <option value="centralized">集中式 — 变量列表+规则+格式全放同一位置（简单卡推荐）</option>
            <option value="distributed">分散式 — 规则放D4，变量列表放D1，输出格式放D0（复杂卡推荐）</option>
            <option value="hybrid">混合式 — 常驻变量集中，NPC变量跟随关键词触发（多角色推荐）</option>
          </select>
          <div class="hint">
            集中式：简单直接，适合变量少的卡。<br>
            分散式：规则放远处减少干扰，格式放D0效力最强，适合复杂卡。<br>
            混合式：系统变量常驻，NPC变量按需加载节省Token。
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷预设 -->
    <div class="card mb-md">
      <div class="card__header"><h3>快捷预设</h3></div>
      <div class="card__body flex-row" style="flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" @click="loadPreset('rpg')">RPG 游戏</button>
        <button class="btn btn--ghost btn--sm" @click="loadPreset('xiuxian')">修仙世界</button>
        <button class="btn btn--ghost btn--sm" @click="loadPreset('school')">校园日常</button>
        <button class="btn btn--ghost btn--sm" @click="loadPreset('simulation')">模拟经营</button>
        <button class="btn btn--ghost btn--sm" @click="loadPreset('dating')">恋爱养成</button>
        <button class="btn btn--ghost btn--sm" @click="loadPreset('survival')">生存冒险</button>
      </div>
    </div>

    <!-- 预览生成代码 -->
    <div class="card mb-md">
      <div class="card__header flex-between">
        <h3>生成的 Zod Schema 代码</h3>
        <button class="btn btn--ghost btn--sm" @click="copyCode(zodCode)">复制</button>
      </div>
      <div class="card__body">
        <pre class="code-preview selectable">{{ zodCode }}</pre>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__header flex-between">
        <h3>生成的初始变量 (InitVar)</h3>
        <button class="btn btn--ghost btn--sm" @click="copyCode(initVarYaml)">复制</button>
      </div>
      <div class="card__body">
        <pre class="code-preview selectable">{{ initVarYaml }}</pre>
      </div>
    </div>

    <div class="card">
      <div class="card__header flex-between">
        <h3>变量更新格式（给 AI 看的规则）</h3>
        <button class="btn btn--ghost btn--sm" @click="copyCode(updateRuleText)">复制</button>
      </div>
      <div class="card__body">
        <pre class="code-preview selectable">{{ updateRuleText }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';
import { chatForJsonArray } from '../utils/json-repair.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const aiGen = ref(false);
const aiExtraReq = ref('');
const updateFormat = ref('lodash');
const layoutStrategy = ref('centralized');
const injectMode = ref('single');
const namingPrefix = ref('mvu');
const xmlWrap = ref('status');
const trackPresentChars = ref(false);

const defaultVarGroups = [
  {
    name: '世界',
    fields: [
      { name: '日期', type: 'string', defaultValue: '第1天', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '游戏内日期', showAdvanced: false },
      { name: '时间', type: 'string', defaultValue: '08:00', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '', showAdvanced: false },
      { name: '位置', type: 'string', defaultValue: '未知', min: null, max: null, clamp: false, enumValues: '', recordFields: '', description: '', showAdvanced: false }
    ]
  },
  {
    name: '主角',
    fields: [
      { name: 'HP', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true, enumValues: '', recordFields: '', description: '生命值', showAdvanced: false },
      { name: '金钱', type: 'number', defaultValue: '1000', min: 0, max: null, clamp: true, enumValues: '', recordFields: '', description: '', showAdvanced: false }
    ]
  }
];

// 从角色卡 extensions 读取已保存的 varGroups，没有则用默认值
const varGroups = reactive([]);
let _skipSave = false;

function loadVarGroupsFromCard() {
  _skipSave = true;
  const saved = cardStore.cardData.extensions?.cfMvuVarGroups;
  varGroups.length = 0;

  if (saved && saved.length > 0) {
    // 有保存过的变量组，直接加载
    for (const g of saved) varGroups.push(JSON.parse(JSON.stringify(g)));
  } else {
    // 没有保存过，尝试从世界书条目中解析
    const parsed = parseVarGroupsFromWorldBook();
    if (parsed.length > 0) {
      for (const g of parsed) varGroups.push(g);
    } else {
      for (const g of defaultVarGroups) varGroups.push(JSON.parse(JSON.stringify(g)));
    }
  }
  _skipSave = false;
}

function parseVarGroupsFromWorldBook() {
  const entries = cardStore.worldEntries;
  const groups = [];

  // 方式1：从分组变量条目解析（如 "[mvu_update]世界变量" 内容含 format_message_variable::stat_data.世界）
  for (const e of entries) {
    const content = e.content || '';
    const comment = e.comment || '';
    // 匹配 format_message_variable::stat_data.组名 或 get_message_variable::stat_data.组名
    const groupMatch = content.match(/(?:format_message_variable|get_message_variable)::stat_data\.(\S+)/);
    if (groupMatch) {
      const groupName = groupMatch[1].replace(/[{}]/g, '');
      if (!groups.find(g => g.name === groupName)) {
        groups.push({ name: groupName, fields: [] });
      }
    }
  }

  // 方式2：从initvar/变量初始化条目解析变量名
  for (const e of entries) {
    const comment = (e.comment || '').toLowerCase();
    if (comment.includes('initvar') || comment.includes('变量初始化') || comment.includes('初始变量')) {
      const content = e.content || '';
      // 解析 YAML 风格的变量定义
      const lines = content.split('\n');
      let currentGroup = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<') || trimmed.startsWith('{')) continue;
        // 顶级键（无缩进或少缩进）= 分组名
        const groupMatch = line.match(/^(\S+)\s*[:：]/);
        if (groupMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
          const name = groupMatch[1].replace(/['"]/g, '');
          currentGroup = groups.find(g => g.name === name);
          if (!currentGroup) {
            currentGroup = { name, fields: [] };
            groups.push(currentGroup);
          }
          continue;
        }
        // 子级键（有缩进）= 变量名
        if (currentGroup) {
          const fieldMatch = trimmed.match(/^(\S+)\s*[:：]\s*(.*)/);
          if (fieldMatch) {
            const fieldName = fieldMatch[1].replace(/['"]/g, '');
            const defaultVal = (fieldMatch[2] || '').replace(/['"]/g, '').trim();
            if (!currentGroup.fields.find(f => f.name === fieldName)) {
              const isNum = !isNaN(defaultVal) && defaultVal !== '';
              currentGroup.fields.push({
                name: fieldName, type: isNum ? 'number' : 'string',
                defaultValue: defaultVal || '', min: null, max: null,
                clamp: false, enumValues: '', recordFields: '',
                description: '', showAdvanced: false
              });
            }
          }
        }
      }
      break; // 只解析第一个匹配的初始化条目
    }
  }

  // 方式3：从变量更新规则条目解析变量名（备选）
  if (groups.length === 0) {
    for (const e of entries) {
      const comment = (e.comment || '').toLowerCase();
      if (comment.includes('变量更新规则') || comment.includes('mvu_update')) {
        const content = e.content || '';
        // 匹配 YAML 格式的顶级键
        const lines = content.split('\n');
        let currentGroup = null;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('-') || trimmed.startsWith('#') || trimmed.startsWith('<')) continue;
          const topKey = line.match(/^  (\S+)\s*[:：]/);
          if (topKey) {
            const name = topKey[1].replace(/['"]/g, '');
            if (['rule', 'format', 'check', 'type', 'op', 'path', 'value'].includes(name.toLowerCase())) continue;
            currentGroup = groups.find(g => g.name === name);
            if (!currentGroup) {
              currentGroup = { name, fields: [] };
              groups.push(currentGroup);
            }
          }
        }
        if (groups.length > 0) break;
      }
    }
  }

  return groups;
}

// 初始化加载
loadVarGroupsFromCard();

// 监听卡片变化（导入新卡时重新加载）
watch(() => cardStore.cardData.name, () => {
  loadVarGroupsFromCard();
});

// 监听 varGroups 变化，自动保存到角色卡 extensions
watch(varGroups, () => {
  if (_skipSave) return;
  if (!cardStore.cardData.extensions) cardStore.cardData.extensions = {};
  cardStore.cardData.extensions.cfMvuVarGroups = JSON.parse(JSON.stringify(varGroups));
  cardStore.markDirty();
}, { deep: true });

function addGroup() {
  varGroups.push({ name: '新分组', fields: [] });
}

function addField(group) {
  group.fields.push({
    name: '', type: 'number', defaultValue: '', min: null, max: null,
    clamp: false, enumValues: '', recordFields: '', description: '', showAdvanced: false
  });
}

function getDefaultPlaceholder(type) {
  return { number: '如：100', string: '如：未知', boolean: 'true 或 false', enum: '第一个枚举值', record: '{}', array: '[]' }[type] || '';
}

// ======== 预设 ========

const presets = {
  rpg: [
    { name: '世界', fields: [
      { name: '日期', type: 'string', defaultValue: '第1天' },
      { name: '时间', type: 'string', defaultValue: '08:00' },
      { name: '位置', type: 'string', defaultValue: '初始城镇' },
      { name: '天气', type: 'string', defaultValue: '晴' }
    ]},
    { name: '主角', fields: [
      { name: 'HP', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: 'MP', type: 'number', defaultValue: '50', min: 0, max: 50, clamp: true },
      { name: '等级', type: 'number', defaultValue: '1', min: 1, max: 99, clamp: true },
      { name: '经验', type: 'number', defaultValue: '0', min: 0, clamp: true },
      { name: '金币', type: 'number', defaultValue: '500', min: 0, clamp: true },
      { name: '攻击力', type: 'number', defaultValue: '10' },
      { name: '防御力', type: 'number', defaultValue: '5' }
    ]},
    { name: 'NPC', fields: [
      { name: '', type: 'record', recordFields: '好感度:number,关系:string,位置:string' }
    ]},
    { name: '背包', fields: [
      { name: '', type: 'record', recordFields: '数量:number,描述:string' }
    ]}
  ],
  xiuxian: [
    { name: '世界', fields: [
      { name: '日期', type: 'string', defaultValue: '天元历1年1月1日' },
      { name: '位置', type: 'string', defaultValue: '青云宗' },
      { name: '当前大域', type: 'string', defaultValue: '中央神州' }
    ]},
    { name: '主角', fields: [
      { name: 'HP', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: '灵力', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: '境界', type: 'enum', enumValues: '凡人,炼气一层,炼气二层,炼气三层,筑基初期,筑基中期,筑基后期,金丹初期,金丹中期,金丹后期,元婴初期,元婴中期,元婴后期,化神期', defaultValue: '凡人' },
      { name: '修炼进度', type: 'number', defaultValue: '0', min: 0, max: 100, clamp: true },
      { name: '灵石', type: 'number', defaultValue: '100', min: 0, clamp: true },
      { name: '所属宗门', type: 'string', defaultValue: '散修' }
    ]},
    { name: 'NPC', fields: [
      { name: '', type: 'record', recordFields: '好感度:number,境界:string,位置:string' }
    ]},
    { name: '背包', fields: [
      { name: '', type: 'record', recordFields: '数量:number,品级:string' }
    ]}
  ],
  school: [
    { name: '系统', fields: [
      { name: '日期', type: 'string', defaultValue: '4月1日' },
      { name: '时间', type: 'string', defaultValue: '08:00' },
      { name: '星期', type: 'string', defaultValue: '星期一' },
      { name: '位置', type: 'string', defaultValue: '教室' },
      { name: '天气', type: 'string', defaultValue: '晴' }
    ]},
    { name: '主角', fields: [
      { name: '体力', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: '心情', type: 'number', defaultValue: '80', min: 0, max: 100, clamp: true },
      { name: '金钱', type: 'number', defaultValue: '5000', min: 0, clamp: true },
      { name: '学业', type: 'number', defaultValue: '60', min: 0, max: 100, clamp: true }
    ]},
    { name: 'NPC', fields: [
      { name: '', type: 'record', recordFields: '好感度:number,关系:string' }
    ]}
  ],
  simulation: [
    { name: '系统', fields: [
      { name: '日期', type: 'string', defaultValue: '第1天' },
      { name: '时间', type: 'string', defaultValue: '上午' },
      { name: '回合数', type: 'number', defaultValue: '1', min: 1 },
      { name: '行动点', type: 'number', defaultValue: '5', min: 0, max: 10, clamp: true }
    ]},
    { name: '资源', fields: [
      { name: '金币', type: 'number', defaultValue: '10000', min: 0, clamp: true },
      { name: '声望', type: 'number', defaultValue: '0', min: -100, max: 100, clamp: true },
      { name: '人口', type: 'number', defaultValue: '10', min: 0, clamp: true }
    ]},
    { name: '状态', fields: [
      { name: '阶段', type: 'enum', enumValues: '起步期,发展期,扩张期,鼎盛期', defaultValue: '起步期' }
    ]}
  ],
  dating: [
    { name: '系统', fields: [
      { name: '日期', type: 'string', defaultValue: '第1天' },
      { name: '时间', type: 'string', defaultValue: '上午' },
      { name: '位置', type: 'string', defaultValue: '家里' }
    ]},
    { name: '主角', fields: [
      { name: '魅力', type: 'number', defaultValue: '50', min: 0, max: 100, clamp: true },
      { name: '金钱', type: 'number', defaultValue: '3000', min: 0, clamp: true },
      { name: '体力', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true }
    ]},
    { name: 'NPC', fields: [
      { name: '', type: 'record', recordFields: '好感度:number,信任度:number,关系:string,解锁事件:string' }
    ]}
  ],
  survival: [
    { name: '环境', fields: [
      { name: '天数', type: 'number', defaultValue: '1', min: 1 },
      { name: '时间', type: 'string', defaultValue: '白天' },
      { name: '天气', type: 'string', defaultValue: '晴' },
      { name: '温度', type: 'number', defaultValue: '25' },
      { name: '位置', type: 'string', defaultValue: '海岸' }
    ]},
    { name: '生存', fields: [
      { name: 'HP', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: '饥饿', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: '口渴', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: '体力', type: 'number', defaultValue: '100', min: 0, max: 100, clamp: true },
      { name: '精神', type: 'number', defaultValue: '80', min: 0, max: 100, clamp: true }
    ]},
    { name: '物资', fields: [
      { name: '', type: 'record', recordFields: '数量:number' }
    ]}
  ]
};

function loadPreset(key) {
  const preset = presets[key];
  if (!preset) return;
  varGroups.length = 0;
  for (const g of preset) {
    varGroups.push({
      name: g.name,
      fields: g.fields.map(f => ({
        name: f.name || '', type: f.type || 'string', defaultValue: f.defaultValue || '',
        min: f.min ?? null, max: f.max ?? null, clamp: f.clamp || false,
        enumValues: f.enumValues || '', recordFields: f.recordFields || '',
        description: f.description || '', showAdvanced: false
      }))
    });
  }
  appStore.toastSuccess('预设已加载');
}

// ======== 代码生成 ========

const zodCode = computed(() => {
  let code = `import { registerMvuSchema } from\n  'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';\n\n`;
  code += `export const Schema = z.object({\n`;

  for (const group of varGroups) {
    if (!group.name) continue;
    code += `  ${group.name}: z.object({\n`;
    for (const f of group.fields) {
      if (!f.name && f.type !== 'record') continue;
      code += `    ${f.name || '// record'}: ${buildZodType(f)},\n`;
    }
    if (group.fields.some(f => f.type === 'record' && !f.name)) {
      // 整个分组是 record 类型
      const rf = group.fields.find(f => f.type === 'record');
      code = code.replace(`  ${group.name}: z.object({\n    // record: ${buildZodType(rf)},\n`, '');
      code += `  ${group.name}: ${buildZodType(rf)},\n`;
    } else {
      code += `  }).prefault({}),\n`;
    }
  }

  code += `});\n\n`;
  code += `$(() => { registerMvuSchema(Schema); });\n`;
  return code;
});

function buildZodType(field) {
  switch (field.type) {
    case 'number': {
      let t = 'z.coerce.number()';
      if (field.clamp && (field.min !== null || field.max !== null)) {
        const min = field.min ?? -99999;
        const max = field.max ?? 99999;
        t += `.transform(v => _.clamp(v, ${min}, ${max}))`;
      }
      t += `.prefault(${field.defaultValue || 0})`;
      return t;
    }
    case 'string':
      return `z.string().prefault('${field.defaultValue || ''}')`;
    case 'boolean':
      return `z.boolean().prefault(${field.defaultValue || 'false'})`;
    case 'enum': {
      const vals = (field.enumValues || '').split(',').map(v => `'${v.trim()}'`).join(', ');
      return `z.enum([${vals}]).prefault('${field.defaultValue || ''}')`;
    }
    case 'record': {
      const subFields = (field.recordFields || '').split(',').map(s => {
        const [name, type] = s.trim().split(':');
        if (!name) return '';
        const zt = type === 'number' ? 'z.coerce.number().prefault(0)' : `z.string().prefault('')`;
        return `      ${name}: ${zt}`;
      }).filter(Boolean).join(',\n');
      return `z.record(z.string(), z.object({\n${subFields}\n    })).prefault({})`;
    }
    case 'array':
      return `z.array(z.string()).prefault([])`;
    default:
      return `z.string().prefault('')`;
  }
}

const initVarYaml = computed(() => {
  let yaml = '';
  for (const group of varGroups) {
    if (!group.name) continue;
    yaml += `${group.name}:\n`;
    for (const f of group.fields) {
      if (!f.name) continue;
      const val = f.type === 'number' ? (f.defaultValue || '0') : `"${f.defaultValue || ''}"`;
      yaml += `  ${f.name}: ${val}\n`;
    }
  }
  if (trackPresentChars.value) {
    // Find character names from var groups to build default list
    const charNames = varGroups.filter(g => g.fields.length > 0).map(g => g.name).join(',');
    yaml += `在场角色追踪:\n  在场角色: "${charNames}"\n`;
  }
  return yaml || '(请添加变量)';
});

const updateRuleText = computed(() => {
  let text = '';
  if (updateFormat.value === 'lodash') {
    text = '---\n变量更新规则:\n  rule:\n    - you must output the update analysis and the actual update commands at once in <UpdateVariable> tag\n  format: lodash _.set\n---\n\n每次回复末尾，请在 <UpdateVariable> 标签内更新变化的变量。\n格式：\n\n<UpdateVariable>\n';
    for (const group of varGroups) {
      for (const f of group.fields) {
        if (!f.name) continue;
        if (f.type === 'number') {
          text += `_.set('${group.name}.${f.name}', 旧值, 新值);\n`;
        } else {
          text += `_.set('${group.name}.${f.name}', '旧值', '新值');\n`;
        }
      }
    }
    text += '</UpdateVariable>';
  } else {
    text = '---\n变量更新规则:\n  rule:\n    - you must output JSON Patch (RFC 6902) operations in <UpdateVariable> tag\n  format: JSON Patch\n---\n\n每次回复末尾，请在 <UpdateVariable> 标签内用 JSON Patch 格式更新变量。\n支持的操作：replace（替换）、delta（增减数值）\n\n<UpdateVariable>\n';
    for (const group of varGroups) {
      for (const f of group.fields) {
        if (!f.name) continue;
        if (f.type === 'number') {
          text += `{ "op": "delta", "path": "/${group.name}/${f.name}", "value": 变化量 }\n`;
        } else {
          text += `{ "op": "replace", "path": "/${group.name}/${f.name}", "value": "新值" }\n`;
        }
      }
    }
    text += '</UpdateVariable>';
  }
  if (trackPresentChars.value) {
    if (updateFormat.value === 'lodash') {
      text += `_.set('在场角色追踪.在场角色', '旧值', '当前在场的角色名用逗号分隔');\n`;
    } else {
      text += `{ "op": "replace", "path": "/在场角色追踪/在场角色", "value": "当前在场的角色名用逗号分隔" }\n`;
    }
  }
  text += '\n\n注意：只更新发生变化的变量，未变化的不需要输出。';
  return text;
});

// ======== AI 推荐变量 ========

async function aiRecommend() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  aiGen.value = true;
  try {
    const context = buildCardContext(cardStore);
    const entries = cardStore.worldEntries;
    let worldBookDetail = '';
    if (entries.length > 0) {
      worldBookDetail = '\n\n【已有世界书条目详情】\n';
      for (const e of entries.slice(0, 30)) {
        const type = e.constant ? '常驻' : e.enabled ? '触发' : '禁用';
        worldBookDetail += `[${type}] ${e.comment || '(未命名)'} keys:${(e.keys||[]).join(',')}\n`;
        if (e.content) worldBookDetail += `  内容: ${e.content.slice(0, 200)}${e.content.length > 200 ? '...' : ''}\n`;
      }
    }
    const prompt = `你是 SillyTavern MVU 变量系统设计专家。根据以下角色卡信息和已有世界书内容，推荐需要追踪的变量。

【角色卡基本信息】
${context}
${worldBookDetail}

${aiExtraReq.value ? '【用户额外要求】\n' + aiExtraReq.value + '\n' : ''}

请输出 JSON 格式的变量分组：
[
  {
    "name": "分组名",
    "fields": [
      { "name": "变量名", "type": "number/string/enum/record", "defaultValue": "默认值", "min": null, "max": null, "clamp": false, "enumValues": "", "recordFields": "", "description": "说明" }
    ]
  }
]

type 可选：number / string / boolean / enum（需填 enumValues 逗号分隔）/ record（需填 recordFields 如 "好感度:number,关系:string"）

根据角色卡的类型合理设计：
- RPG/冒险：HP、MP、等级、金币、位置、背包
- 校园/日常：日期、时间、体力、心情、NPC好感度
- 修仙：境界、灵力、修炼进度、灵石
- 模拟经营：资源、声望、回合

只输出 JSON 数组。`;

    const groups = await chatForJsonArray(apiStore, [
      { role: 'system', content: '你是变量系统设计专家。只输出合法JSON数组。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });

    varGroups.length = 0;
    for (const g of groups) {
      varGroups.push({
        name: g.name,
        fields: (g.fields || []).map(f => ({
          name: f.name || '', type: f.type || 'string', defaultValue: f.defaultValue || '',
          min: f.min ?? null, max: f.max ?? null, clamp: f.clamp || false,
          enumValues: f.enumValues || '', recordFields: f.recordFields || '',
          description: f.description || '', showAdvanced: false
        }))
      });
    }

    appStore.toastSuccess(`AI 推荐了 ${groups.length} 组变量，已填到下方 UI。可以继续调整后点「生成并注入脚本」`);
  } catch (e) {
    appStore.toastError('推荐失败: ' + e.message);
  } finally { aiGen.value = false; }
}

// ======== 注入脚本 ========

const mvuKeywords = ['变量更新规则', '变量输出格式', '变量输出格式强调', '当前变量值', '变量初始化', 'Zod Schema', 'MVU 变量系统'];

function hasExistingMvu() {
  const entries = cardStore.worldEntries;
  const scripts = cardStore.tavernScripts;
  const hasEntries = entries.some(e => mvuKeywords.some(k => (e.comment || '').includes(k)));
  const hasScripts = scripts.some(s => mvuKeywords.some(k => (s.name || '').includes(k)));
  return hasEntries || hasScripts;
}

function removeExistingMvu() {
  // 删除旧的 MVU 世界书条目
  const entries = cardStore.worldEntries;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (mvuKeywords.some(k => (entries[i].comment || '').includes(k))) {
      cardStore.removeWorldEntry(entries[i].id);
    }
  }
  // 删除旧的 MVU 酒馆脚本
  const scripts = cardStore.tavernScripts;
  for (let i = scripts.length - 1; i >= 0; i--) {
    if (mvuKeywords.some(k => (scripts[i].name || '').includes(k))) {
      cardStore.removeTavernScript(scripts[i].id);
    }
  }
  // 删除旧的 MVU 正则脚本
  const regex = cardStore.regexScripts;
  const regexKeywords = ['去除变量更新', '仅格式思维链', '界面占位符', '变量解析', '变量加载', '变量注入'];
  for (let i = regex.length - 1; i >= 0; i--) {
    if (regexKeywords.some(k => (regex[i].scriptName || '').includes(k))) {
      cardStore.removeRegexScript(regex[i].id);
    }
  }
}

function generateAndInject() {
  if (hasExistingMvu()) {
    appStore.confirmAction('已存在 MVU 变量条目，是否替换？', () => {
      removeExistingMvu();
      doGenerateAndInject();
    });
  } else {
    doGenerateAndInject();
  }
}

function doGenerateAndInject() {
  // 1. 生成 MVU 加载脚本
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

  // 2. 生成 Zod Schema 脚本
  const zodScript = cardStore.createEmptyTavernScript();
  zodScript.name = 'Zod Schema';
  zodScript.content = zodCode.value;

  // 注入
  cardStore.addTavernScript(mvuScript);
  cardStore.addTavernScript(zodScript);

  // 3. 生成初始变量世界书条目（disabled）
  const pfx = namingPrefix.value === 'mvu' ? '[initvar]' : namingPrefix.value === 'bracket' ? '【初始】' : '';
  const initEntry = cardStore.addWorldEntry();
  initEntry.comment = `${pfx}变量初始化`;
  initEntry.content = initVarYaml.value;
  initEntry.enabled = false;
  initEntry.constant = false;

  // 4. 生成变量更新规则世界书条目（常驻）
  const rulePfx = namingPrefix.value === 'mvu' ? '[mvu_update]' : namingPrefix.value === 'bracket' ? '【变量】' : '';
  const ruleEntry = cardStore.addWorldEntry();
  ruleEntry.comment = `${rulePfx}变量更新规则`;
  ruleEntry.content = updateRuleText.value;
  ruleEntry.constant = true;
  ruleEntry.enabled = true;
  ruleEntry.position = 'after_char';
  ruleEntry.insertion_order = 200;
  ruleEntry.extensions.depth = 0;

  // 5. 生成变量注入条目
  const prefix = namingPrefix.value === 'mvu' ? '[mvu_update]' : namingPrefix.value === 'bracket' ? '【变量】' : '';
  const wrapOpen = xmlWrap.value === 'status' ? '<status_current_variable>\n' : '';
  const wrapClose = xmlWrap.value === 'status' ? '\n</status_current_variable>' : '';

  if (injectMode.value === 'split') {
    // 按分组拆分注入
    let orderBase = 190;
    for (const group of varGroups) {
      if (!group.name) continue;
      const ve = cardStore.addWorldEntry();
      ve.comment = `${prefix}${group.name}变量`;
      ve.content = `${group.name}:\n  {{format_message_variable::stat_data.${group.name}}}`;
      ve.constant = group.name === '世界' || group.name === '系统' || group.name === '环境';
      ve.enabled = true;
      ve.position = 'after_char';
      ve.insertion_order = orderBase++;
      ve.extensions.depth = 0;
      // NPC分组用关键词触发
      if (!ve.constant) {
        ve.keys = [group.name];
      }
    }
  } else {
    // 整体注入
    const varEntry = cardStore.addWorldEntry();
    varEntry.comment = `${prefix}当前变量值`;
    varEntry.content = `${wrapOpen}当前游戏数据：\n{{format_message_variable::stat_data}}${wrapClose}`;
    varEntry.constant = true;
    varEntry.enabled = true;
    varEntry.position = 'after_char';
    varEntry.insertion_order = 200;
    varEntry.extensions.depth = 0;
  }

  // 6. 生成变量输出格式条目（常驻，告诉AI用什么格式输出变量更新）
  const fmtEntry = cardStore.addWorldEntry();
  fmtEntry.comment = `${rulePfx}变量输出格式`;
  fmtEntry.constant = true;
  fmtEntry.enabled = true;
  fmtEntry.position = 'after_char';
  fmtEntry.insertion_order = 200;
  fmtEntry.extensions.depth = 0;
  if (updateFormat.value === 'lodash') {
    fmtEntry.content = '---\n变量输出格式:\n  rule:\n    - you must output the update analysis and the actual update commands at once in <UpdateVariable> tag\n    - use lodash _.set format\n  format: |\n    <UpdateVariable>\n    _.set(\'路径\', 旧值, 新值);\n    </UpdateVariable>\n---';
  } else {
    fmtEntry.content = '---\n变量输出格式:\n  rule:\n    - you must output JSON Patch operations in <UpdateVariable> tag\n    - supported ops: replace, delta\n  format: |\n    <UpdateVariable>\n    { "op": "replace", "path": "/路径", "value": "新值" }\n    { "op": "delta", "path": "/路径", "value": 变化量 }\n    </UpdateVariable>\n---';
  }

  // 7. 变量输出格式强调条目（常驻）
  const emphEntry = cardStore.addWorldEntry();
  emphEntry.comment = `${rulePfx}变量输出格式强调`;
  emphEntry.content = '---\n变量输出格式强调:\n  rule: The following must be inserted to the end of reply, and cannot be omitted\n  format: |\n    <UpdateVariable>\n    (variable update commands)\n    </UpdateVariable>\n    <StatusPlaceHolderImpl/>\n  note: <StatusPlaceHolderImpl/> must always appear after </UpdateVariable>, never omit it\n---';
  emphEntry.constant = true;
  emphEntry.enabled = true;
  emphEntry.position = 'after_char';
  emphEntry.insertion_order = 200;
  emphEntry.extensions.depth = 0;

  // 8. 自动配套正则脚本（完整6个）
  const regexPairs = [
    { scriptName: '[不发送]去除变量更新', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
      replaceString: '', markdownOnly: false, promptOnly: true, minDepth: 6, maxDepth: null },
    { scriptName: '[不发送]仅格式思维链', findRegex: '/<Analysis>[\\s\\S]*?<\\/Analysis>/gm',
      replaceString: '', markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null },
    { scriptName: '[不发送]界面占位符', findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
      replaceString: '', markdownOnly: false, promptOnly: true, minDepth: null, maxDepth: null },
    { scriptName: '[隐藏]变量更新', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gs',
      replaceString: '', markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null },
    { scriptName: '[美化]完整变量完成', findRegex: '/<UpdateVariable>([\\s\\S]*?)<\\/UpdateVariable>/gs',
      replaceString: '<details style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#888">变量更新</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
      markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null },
    { scriptName: '[美化]变量更新中', findRegex: '/<UpdateVariable>([\\s\\S]*?)$/gs',
      replaceString: '<details open style="background:rgba(0,0,0,0.15);border:1px solid rgba(100,200,255,0.15);border-radius:6px;padding:8px;margin:4px 0;font-size:12px"><summary style="cursor:pointer;color:#60a5fa">变量更新中...</summary><pre style="white-space:pre-wrap;color:#aaa;margin:4px 0">$1</pre></details>',
      markdownOnly: true, promptOnly: false, minDepth: null, maxDepth: null }
  ];
  for (const r of regexPairs) {
    cardStore.addRegexScript({ ...cardStore.createEmptyRegexScript(), scriptName: r.scriptName, findRegex: r.findRegex, replaceString: r.replaceString, markdownOnly: r.markdownOnly, promptOnly: r.promptOnly, minDepth: r.minDepth, maxDepth: r.maxDepth });
  }

  // 9. 为开场白追加占位符
  const firstMes = cardStore.cardData.first_mes || '';
  if (!firstMes.includes('StatusPlaceHolderImpl')) {
    cardStore.cardData.first_mes = firstMes + '\n<StatusPlaceHolderImpl/>';
  }
  for (let i = 0; i < (cardStore.cardData.alternate_greetings || []).length; i++) {
    if (!cardStore.cardData.alternate_greetings[i].includes('StatusPlaceHolderImpl')) {
      cardStore.cardData.alternate_greetings[i] += '\n<StatusPlaceHolderImpl/>';
    }
  }

  appStore.toastSuccess('MVU 完整套装已生成：2脚本 + 5世界书 + 6正则 + 开场白占位符');
}

function copyCode(text) {
  navigator.clipboard.writeText(text);
  appStore.toastSuccess('已复制');
}
</script>

<style scoped>
.var-field {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 12px;
  margin-bottom: 8px;
}
.var-advanced {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--cf-border);
}
.grid-4 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: var(--cf-gap-sm);
  align-items: end;
}
.code-preview {
  font-family: var(--cf-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  background: none;
  border: none;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
</style>

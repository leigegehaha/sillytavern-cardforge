<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>世界书编辑器</h1>
        <p>管理角色卡的世界书条目 — 当前 {{ entries.length }} 条</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--secondary btn--sm" @click="showAiPanel = !showAiPanel">
          {{ showAiPanel ? '关闭AI生成' : 'AI 生成条目' }}
        </button>
        <button class="btn btn--secondary btn--sm" @click="handleFilter">
          {{ filterText ? '清除筛选' : '筛选' }}
        </button>
        <button class="btn btn--ghost" @click="toggleBatchMode" v-if="entries.length > 0">
          {{ batchMode ? '退出批量' : '批量操作' }}
        </button>
        <button class="btn btn--primary" @click="handleAdd">+ 新建条目</button>
      </div>
    </div>

    <!-- AI 世界书生成面板 -->
    <div v-if="showAiPanel" class="card mb-md ai-panel">
      <div class="card__header">
        <h3>AI 世界书生成</h3>
        <span class="badge badge--info">描述你的世界观，AI 自动生成世界书条目</span>
      </div>
      <div class="card__body">
        <div class="form-group">
          <label>世界观描述 <span class="badge badge--danger">必填</span></label>
          <textarea class="textarea" v-model="aiWorldDesc" rows="6"
            placeholder="详细描述你的世界观设定，越具体越好。例如：&#10;&#10;这是一个修仙世界，以灵气为修炼基础。修为境界分为：凡人→炼气→筑基→金丹→元婴→化神。世界中有多个宗门势力，以青云宗为主。货币系统使用灵石（下品/中品/上品）。主角是青云宗的外门弟子，刚入门不久..."></textarea>
        </div>

        <div class="grid-3">
          <div class="form-group">
            <label>生成类型</label>
            <div class="ai-checks">
              <label class="toggle-label" v-for="opt in entryTypeOpts" :key="opt.value">
                <input type="checkbox" v-model="aiEntryTypes" :value="opt.value"> {{ opt.label }}
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>条目数量目标</label>
            <select class="select" v-model="aiTargetCount">
              <option value="minimal">极简（5-15条）适合纯角色扮演卡</option>
              <option value="small">小型（20-35条）适合日常/校园卡</option>
              <option value="medium">中型（40-70条）适合有世界观的卡</option>
              <option value="large">大型（80-150条）适合开放世界/游戏卡</option>
              <option value="massive">超大型（150-300条）适合史诗级世界观</option>
              <option value="extreme">极限（300-500条）史诗级开放世界</option>
            </select>
          </div>
          <div class="form-group">
            <label>描述风格</label>
            <select class="select" v-model="aiDescStyle">
              <option value="auto">自动选择（AI 根据条目类型自动匹配最佳风格）</option>
              <option value="concise">简洁命令式（节省Token）</option>
              <option value="narrative">叙述体（自然语言）</option>
              <option value="yaml">YAML 结构化</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>额外要求（可选）</label>
          <input class="input" v-model="aiExtraReq"
            placeholder="如：NPC要包含核心矛盾、地点要有互动提示、需要包含战斗规则...">
        </div>

        <button class="btn btn--primary btn--lg" style="width:100%" :disabled="aiGenerating || !aiWorldDesc.trim()"
          @click="handleAiGenerate">
          {{ aiGenerating ? 'AI 正在生成世界书条目...' : ['large','massive','extreme'].includes(aiTargetCount) ? '分批生成世界书（大型模式）' : '开始生成世界书' }}
        </button>

        <!-- 生成结果预览 -->
        <div v-if="aiResults.length > 0" class="ai-results mt-md">
          <div class="flex-between mb-md">
            <h4>生成了 {{ aiResults.length }} 条世界书条目</h4>
            <div class="flex-row">
              <button class="btn btn--secondary btn--sm" @click="selectAllResults(!allSelected)">
                {{ allSelected ? '取消全选' : '全选' }}
              </button>
              <button class="btn btn--primary btn--sm" @click="injectSelectedResults">
                注入选中条目 ({{ aiResults.filter(r => r.selected).length }})
              </button>
              <button class="btn btn--secondary btn--sm" @click="continueGenerate" :disabled="aiGenerating">
                {{ aiGenerating ? '生成中...' : '+ 继续生成更多' }}
              </button>
            </div>
          </div>

          <div v-for="(result, i) in aiResults" :key="i" class="ai-result-item"
            :class="{ 'ai-result-item--selected': result.selected }">
            <div class="flex-between">
              <div class="flex-row">
                <input type="checkbox" v-model="result.selected" style="accent-color:var(--cf-accent)">
                <span class="ai-result-item__name">{{ result.comment }}</span>
                <span class="badge" :class="typeBadgeClass(result.type)">{{ result.type }}</span>
                <span v-if="result.constant" class="badge badge--warning">常驻</span>
              </div>
              <span class="ai-result-item__keys">{{ result.keys.join(', ') }}</span>
            </div>
            <pre class="ai-result-item__content selectable">{{ result.content }}</pre>
            <div class="ai-result-item__meta">
              {{ result.position }} | order {{ result.insertion_order }} | {{ result.content.length }} 字符
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div v-if="showFilter" class="card mb-md">
      <div class="card__body flex-row">
        <input class="input flex-1" v-model="filterText" placeholder="搜索条目名称、关键词、内容...">
        <select class="select" style="width:160px" v-model="filterType">
          <option value="">全部类型</option>
          <option value="constant">常驻条目</option>
          <option value="triggered">触发条目</option>
          <option value="disabled">禁用条目</option>
        </select>
        <select class="select" style="width:140px" v-model="filterPosition">
          <option value="">全部位置</option>
          <option value="before_char">before_char</option>
          <option value="after_char">after_char</option>
        </select>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="batchMode && entries.length > 0" class="card mb-md batch-bar">
      <div class="card__body">
        <div class="flex-between mb-md">
          <div class="flex-row">
            <label class="toggle-label">
              <input type="checkbox" :checked="wbSelectedAll" @change="wbToggleSelectAll"> 全选
            </label>
            <span style="font-size:12px;color:var(--cf-text-muted)">已选 {{ wbSelectedIds.size }} / {{ filteredEntries.length }}</span>
          </div>
          <div class="flex-row" style="flex-wrap:wrap;gap:6px">
            <button class="btn btn--secondary btn--sm" @click="wbBatchEnable(true)" :disabled="wbSelectedIds.size === 0">启用</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchEnable(false)" :disabled="wbSelectedIds.size === 0">禁用</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchConstant(true)" :disabled="wbSelectedIds.size === 0">设为常驻</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchConstant(false)" :disabled="wbSelectedIds.size === 0">取消常驻</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchPosition('before_char')" :disabled="wbSelectedIds.size === 0">改 before_char</button>
            <button class="btn btn--secondary btn--sm" @click="wbBatchPosition('after_char')" :disabled="wbSelectedIds.size === 0">改 after_char</button>
            <button class="btn btn--danger btn--sm" @click="wbBatchDelete" :disabled="wbSelectedIds.size === 0">删除选中</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计栏 -->
    <div class="wb-stats mb-md">
      <span class="badge badge--accent">{{ entries.length }} 总计</span>
      <span class="badge badge--success">{{ entries.filter(e => e.enabled).length }} 启用</span>
      <span class="badge badge--warning">{{ entries.filter(e => e.constant && e.enabled).length }} 常驻</span>
      <span class="badge badge--info">{{ entries.filter(e => !e.constant && e.enabled).length }} 触发</span>
      <span class="badge badge--danger">{{ entries.filter(e => !e.enabled).length }} 禁用</span>
    </div>

    <!-- 条目列表 -->
    <div v-if="filteredEntries.length === 0 && !showAiPanel" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">暂无世界书条目</div>
        <div class="empty-state__desc">点击「AI 生成条目」让 AI 帮你自动生成，或点击「新建条目」手动添加</div>
      </div>
    </div>

    <div v-else>
      <div v-for="(entry, idx) in filteredEntries" :key="entry.id" class="wb-entry"
        :class="{ 'wb-entry--disabled': !entry.enabled, 'wb-entry--constant': entry.constant && entry.enabled, 'wb-entry--dragging': dragSourceId === entry.id, 'wb-entry--dragover': dragOverId === entry.id }"
        :draggable="dragEnabledId === entry.id"
        @dragstart="onDragStart($event, entry.id)"
        @dragover.prevent="onDragOver($event, entry.id)"
        @dragleave="onDragLeave(entry.id)"
        @drop.prevent="onDrop($event, entry.id)"
        @dragend="onDragEnd">

        <!-- 条目头部 -->
        <div class="wb-entry__header" @click="toggleExpand(entry.id)">
          <div class="flex-row">
            <span class="wb-drag-handle"
              @click.stop
              @mousedown="dragEnabledId = entry.id"
              @mouseup="dragEnabledId = null"
              @mouseleave="dragEnabledId = null"
              title="按住拖动排序">⋮⋮</span>
            <label v-if="batchMode" class="toggle-label" style="margin-right:4px" @click.stop>
              <input type="checkbox" :checked="wbSelectedIds.has(entry.id)"
                @change="wbToggleSelect(entry.id)">
            </label>
            <input type="number" class="wb-order-input"
              :value="entry.extensions.cfSortKey"
              @click.stop
              @mousedown.stop
              @change="updateOrder(entry, $event.target.value)"
              title="显示序号 — 仅 CardForge 内部排序，不影响 insertion_order">
            <span class="wb-entry__expand">{{ expandedIds.has(entry.id) ? '▼' : '▶' }}</span>
            <span class="wb-entry__name">{{ entry.comment || '(未命名)' }}</span>
            <span v-if="entry.constant && entry.enabled" class="badge badge--warning">常驻</span>
            <span v-if="!entry.enabled" class="badge badge--danger">禁用</span>
            <span v-if="entry.keys.length" class="wb-entry__keys">
              {{ entry.keys.slice(0, 3).join(', ') }}{{ entry.keys.length > 3 ? '...' : '' }}
            </span>
          </div>
          <div class="flex-row" @click.stop>
            <span class="wb-entry__meta">{{ entry.position }}</span>
            <button class="btn btn--ghost btn--sm" @click="store.duplicateWorldEntry(entry.id)">复制</button>
            <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('删除这条世界书条目？', () => store.removeWorldEntry(entry.id))">删除</button>
          </div>
        </div>

        <!-- 条目详情 -->
        <div v-if="expandedIds.has(entry.id)" class="wb-entry__body">
          <div class="grid-2">
            <div class="form-group">
              <label>条目名称 (comment)</label>
              <input class="input" v-model="entry.comment" @input="store.markDirty()">
            </div>
            <div class="form-group">
              <label>关键词 (keys)</label>
              <input class="input" :value="entry.keys.join(', ')"
                @input="entry.keys = $event.target.value.split(',').map(k => k.trim()).filter(Boolean); store.markDirty()">
              <div class="hint">用逗号分隔多个关键词</div>
            </div>
          </div>

          <div class="form-group">
            <label>内容 (content)</label>
            <textarea class="textarea selectable" v-model="entry.content" rows="8"
              style="font-family: var(--cf-font-mono); font-size: 12px;"
              @input="store.markDirty()"></textarea>
            <div class="hint">{{ (entry.content || '').length }} 字符 | ~{{ Math.round((entry.content || '').length * 1.3) }} Token</div>
          </div>

          <div class="grid-3">
            <div class="form-group">
              <label>插入位置 (position)</label>
              <select class="select" v-model="entry.position" @change="syncPosition(entry); store.markDirty()">
                <option value="before_char">角色定义之前</option>
                <option value="after_char">角色定义之后</option>
                <option value="before_example">示例消息前</option>
                <option value="after_example">示例消息后</option>
                <option value="before_author">作者注释之前</option>
                <option value="after_author">作者注释之后</option>
                <option value="atDepth_system">@D [系统] 在深度</option>
                <option value="atDepth_user">@D [用户] 在深度</option>
                <option value="atDepth_ai">@D [AI] 在深度</option>
              </select>
              <div v-if="entry.position?.startsWith('atDepth')" class="form-group" style="margin-top:6px">
                <label>深度值</label>
                <input class="input" type="number" v-model.number="entry.extensions.depth" min="0" placeholder="0=最底部" @input="store.markDirty()">
                <div class="hint">D0=最新内容旁（效力最强），D1=最后一条消息，D4=较远位置</div>
              </div>
              <div class="hint" v-else>角色定义前/后是最常用的。深度插入（@D）越靠近底部效力越强。</div>
            </div>
            <div class="form-group">
              <label>插入顺序 (insertion_order)</label>
              <input class="input" type="number" v-model.number="entry.insertion_order" @input="store.markDirty()">
              <div class="hint">数值越大越靠下。推荐：系统规则1-10，NPC 50-80，输出格式9990+</div>
            </div>
            <div class="form-group">
              <label>扫描深度 (depth)</label>
              <input class="input" type="number" v-model.number="entry.extensions.depth" min="0" @input="store.markDirty()">
              <div class="hint">扫描最近几条消息匹配关键词。0=始终匹配，4=默认</div>
            </div>
          </div>

          <div class="flex-row gap-md" style="flex-wrap:wrap">
            <label class="toggle-label">
              <input type="checkbox" v-model="entry.enabled" @change="store.markDirty()"> 启用
            </label>
            <label class="toggle-label">
              <input type="checkbox" v-model="entry.constant" @change="store.markDirty()"> 常驻（蓝灯）
            </label>
            <label class="toggle-label">
              <input type="checkbox" v-model="entry.selective" @change="store.markDirty()"> 启用二级关键词
            </label>
            <label class="toggle-label">
              <input type="checkbox" v-model="entry.extensions.exclude_recursion" @change="store.markDirty()"> 不可递归
            </label>
            <label class="toggle-label">
              <input type="checkbox" v-model="entry.extensions.prevent_recursion" @change="store.markDirty()"> 防止进一步递归
            </label>
          </div>

          <div v-if="entry.selective" class="form-group mt-md">
            <label>二级关键词逻辑 (selectiveLogic)</label>
            <select class="select" v-model.number="entry.extensions.selectiveLogic" @change="store.markDirty()">
              <option :value="0">与任意 (AND ANY) — 右侧任一匹配即触发</option>
              <option :value="1">与所有 (AND ALL) — 右侧全部匹配才触发</option>
              <option :value="2">非所有 (NOT ALL) — 右侧至少一个不匹配时触发</option>
              <option :value="3">非任何 (NOT ANY) — 右侧全部不匹配时触发</option>
            </select>
          </div>

          <div v-if="entry.selective" class="form-group mt-md">
            <label>二级关键词 (secondary_keys)</label>
            <input class="input" :value="entry.secondary_keys.join(', ')"
              @input="entry.secondary_keys = $event.target.value.split(',').map(k => k.trim()).filter(Boolean); store.markDirty()">
            <div class="hint">需要同时满足主关键词和二级关键词才触发</div>
          </div>

          <!-- 高级设置（折叠） -->
          <details class="mt-md">
            <summary style="font-size:12px;color:var(--cf-text-muted);cursor:pointer">高级设置</summary>
            <div style="margin-top:12px">
              <div class="grid-3">
                <div class="form-group">
                  <label>角色 (role)</label>
                  <select class="select" v-model.number="entry.extensions.role" @change="store.markDirty()">
                    <option :value="0">System</option>
                    <option :value="1">User</option>
                    <option :value="2">Assistant</option>
                  </select>
                  <div class="hint">条目以什么身份插入提示词</div>
                </div>
                <div class="form-group">
                  <label>触发概率 (%)</label>
                  <input class="input" type="number" v-model.number="entry.extensions.probability" min="0" max="100" @input="store.markDirty()">
                  <div class="hint">关键词匹配后实际触发的概率</div>
                </div>
                <div class="form-group">
                  <label>独立扫描深度</label>
                  <input class="input" type="number" v-model.number="entry.extensions.scan_depth" placeholder="跟随全局" @input="store.markDirty()">
                  <div class="hint">留空则用全局深度</div>
                </div>
              </div>
              <div class="grid-3">
                <div class="form-group">
                  <label>分组 (group)</label>
                  <input class="input" v-model="entry.extensions.group" @input="store.markDirty()">
                  <div class="hint">同组条目互斥，只触发权重最高的</div>
                </div>
                <div class="form-group">
                  <label>分组权重</label>
                  <input class="input" type="number" v-model.number="entry.extensions.group_weight" @input="store.markDirty()">
                </div>
                <div class="form-group">
                  <label>粘性 (sticky)</label>
                  <input class="input" type="number" v-model.number="entry.extensions.sticky" placeholder="0" @input="store.markDirty()">
                  <div class="hint">触发后持续激活的轮数</div>
                </div>
              </div>
              <div class="grid-3">
                <div class="form-group">
                  <label>冷却 (cooldown)</label>
                  <input class="input" type="number" v-model.number="entry.extensions.cooldown" placeholder="0" @input="store.markDirty()">
                  <div class="hint">触发后冷却的轮数</div>
                </div>
                <div class="form-group">
                  <label>延迟 (delay)</label>
                  <input class="input" type="number" v-model.number="entry.extensions.delay" placeholder="0" @input="store.markDirty()">
                  <div class="hint">关键词匹配后延迟几轮才触发</div>
                </div>
                <div class="form-group">
                  <label>选项</label>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <label class="toggle-label">
                      <input type="checkbox" v-model="entry.use_regex" @change="store.markDirty()"> 关键词使用正则匹配
                    </label>
                    <label class="toggle-label">
                      <input type="checkbox" v-model="entry.extensions.match_whole_words" @change="store.markDirty()"> 整词匹配
                    </label>
                    <label class="toggle-label">
                      <input type="checkbox" v-model="entry.extensions.case_sensitive" @change="store.markDirty()"> 大小写敏感
                    </label>
                    <label class="toggle-label">
                      <input type="checkbox" v-model="entry.extensions.ignore_budget" @change="store.markDirty()"> 忽略 Token 预算
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </details>
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
import { chatForJsonArray } from '../utils/json-repair.js';

const store = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();
const entries = computed(() => store.worldEntries);

const showFilter = ref(false);
const filterText = ref('');
const filterType = ref('');
const filterPosition = ref('');
const expandedIds = ref(new Set());

// AI 生成相关
const showAiPanel = ref(false);
const aiWorldDesc = ref('');
const aiEntryTypes = ref(['system', 'world', 'npc', 'location', 'event', 'format']);
const aiTargetCount = ref('small');
const aiDescStyle = ref('auto');
const aiExtraReq = ref('');
const aiGenerating = ref(false);
const aiResults = ref([]);

const entryTypeOpts = [
  { value: 'system', label: '系统规则' },
  { value: 'world', label: '世界设定' },
  { value: 'npc', label: 'NPC 角色' },
  { value: 'location', label: '地点场景' },
  { value: 'event', label: '事件规则' },
  { value: 'format', label: '输出格式' }
];

const allSelected = computed(() => aiResults.value.length > 0 && aiResults.value.every(r => r.selected));

function selectAllResults(val) {
  aiResults.value.forEach(r => r.selected = val);
}

function typeBadgeClass(type) {
  const map = {
    '系统规则': 'badge--danger', '世界设定': 'badge--info', 'NPC角色': 'badge--accent',
    '地点场景': 'badge--success', '事件规则': 'badge--warning', '输出格式': 'badge--info'
  };
  return map[type] || 'badge--info';
}

const countMap = { minimal: '5-15', small: '20-35', medium: '40-70', large: '80-150', massive: '150-300', extreme: '300-500' };
const styleMap = {
  auto: '自动选择最佳风格——系统规则用简洁命令式，NPC用叙述体，数值系统用YAML结构化',
  concise: '简洁命令式，用短句和列表，节省Token。例如用"- 禁止飞行\\n- 城内不得斗法"这样的格式',
  narrative: '自然语言叙述体，像在讲故事一样描写',
  yaml: 'YAML键值对结构化格式'
};

async function handleAiGenerate() {
  if (!apiStore.isConfigured) {
    appStore.toastError('请先在 API 设置中配置 API Key');
    return;
  }

  aiGenerating.value = true;
  aiResults.value = [];

  try {
    const typeLabels = aiEntryTypes.value.map(v => entryTypeOpts.find(o => o.value === v)?.label).filter(Boolean);

    const cardContext = buildCardContext(store);
    const prompt = `你是一个专业的 SillyTavern 世界书（Character Book）架构师。
请根据以下信息生成一套完整的世界书条目。

## 已有角色卡信息
${cardContext}

## 世界观描述
${aiWorldDesc.value}

## 生成要求
- 需要生成的条目类型：${typeLabels.join('、')}
- 条目数量目标：${countMap[aiTargetCount.value]}条
- 内容风格：${styleMap[aiDescStyle.value]}
${aiExtraReq.value ? `- 额外要求：${aiExtraReq.value}` : ''}

## 条目类型说明
- 系统规则（constant=true）：AI必须始终遵守的核心规则，如世界法则、行为约束。insertion_order=1-10，position=before_char
- 世界设定（constant=true或关键词触发）：经济系统、文化、法律等。insertion_order=5-20，position=before_char
- NPC角色（关键词触发）：每个NPC含外貌、性格（含矛盾点）、背景、说话方式。insertion_order=50-80，position=before_char
- 地点场景（关键词触发）：地点描述、氛围、可交互内容、出没NPC。insertion_order=30-50，position=before_char
- 事件规则（关键词触发）：特定事件的规则和流程。insertion_order=70-90，position=before_char
- 输出格式（constant=true）：告诉AI按什么格式回复。insertion_order=9990-9999，position=after_char

## 输出格式
严格输出 JSON 数组，每个条目包含：
[
  {
    "comment": "[类型前缀]条目名称（如 [mvu_plot]核心设定、[mvu_update]变量规则）",
    "type": "系统规则|世界设定|NPC角色|地点场景|事件规则|输出格式",
    "keys": ["触发关键词1", "关键词2"],
    "content": "条目内容",
    "constant": true或false,
    "position": "before_char"或"after_char",
    "insertion_order": 数字
  }
]

只输出JSON数组，不要其他文字。`;

    const parsed = await chatForJsonArray(apiStore, [
      { role: 'system', content: '你是SillyTavern世界书架构专家。精通世界书条目的分类、关键词设计、insertion_order分层策略。始终输出合法JSON。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
    aiResults.value = parsed.map(item => ({
      ...item,
      selected: true,
      keys: item.keys || [],
      constant: item.constant ?? false,
      position: item.position || 'before_char',
      insertion_order: item.insertion_order || 100
    }));

    appStore.toastSuccess(`成功生成 ${aiResults.value.length} 条世界书条目，请预览后点击「注入选中条目」`);
  } catch (e) {
    appStore.toastError(`生成失败: ${e.message}`);
  } finally {
    aiGenerating.value = false;
  }
}

async function continueGenerate() {
  if (!apiStore.isConfigured) return;
  aiGenerating.value = true;
  try {
    const existing = aiResults.value.map(r => r.comment).join('、');
    const cardContext = buildCardContext(store);
    const prompt = `继续生成世界书条目。

已生成的条目：${existing}

【角色卡信息】
${cardContext}

【世界观】
${aiWorldDesc.value}

请生成更多未覆盖的条目（NPC、地点、事件等），不要重复已有的。
输出JSON数组格式，同之前。只输出JSON。`;

    const newItems = (await chatForJsonArray(apiStore, [
      { role: 'system', content: '你是世界书架构专家。继续补充条目，不要重复。只输出JSON。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) })).map(item => ({
      ...item, selected: true,
      keys: item.keys || [], constant: item.constant ?? false,
      position: item.position || 'before_char', insertion_order: item.insertion_order || 100
    }));
    aiResults.value.push(...newItems);
    appStore.toastSuccess(`又生成了 ${newItems.length} 条，共 ${aiResults.value.length} 条`);
  } catch (e) {
    appStore.toastError('继续生成失败: ' + e.message);
  } finally { aiGenerating.value = false; }
}

function injectSelectedResults() {
  const selected = aiResults.value.filter(r => r.selected);
  if (selected.length === 0) {
    appStore.toastWarning('请至少选中一条');
    return;
  }

  for (const item of selected) {
    const entry = store.addWorldEntry();
    entry.comment = item.comment || '';
    entry.keys = item.keys || [];
    entry.content = item.content || '';
    entry.constant = item.constant ?? false;
    entry.position = item.position || 'before_char';
    entry.insertion_order = item.insertion_order || 100;
    entry.extensions.position = entry.position === 'before_char' ? 0 : 1;
  }

  appStore.toastSuccess(`已注入 ${selected.length} 条世界书条目`);
  aiResults.value = [];
  showAiPanel.value = false;
}

// 原有功能
const filteredEntries = computed(() => {
  let result = entries.value;

  if (filterType.value === 'constant') result = result.filter(e => e.constant && e.enabled);
  else if (filterType.value === 'triggered') result = result.filter(e => !e.constant && e.enabled);
  else if (filterType.value === 'disabled') result = result.filter(e => !e.enabled);

  if (filterPosition.value) result = result.filter(e => e.position === filterPosition.value);

  if (filterText.value) {
    const q = filterText.value.toLowerCase();
    result = result.filter(e =>
      (e.comment || '').toLowerCase().includes(q) ||
      (e.content || '').toLowerCase().includes(q) ||
      e.keys.some(k => k.toLowerCase().includes(q))
    );
  }

  // 按 cfSortKey 升序排列（CardForge 内部排序，不影响 insertion_order）
  return [...result].sort((a, b) => {
    const ai = a.extensions?.cfSortKey ?? 9999999;
    const bi = b.extensions?.cfSortKey ?? 9999999;
    return ai - bi;
  });
});

function handleFilter() {
  if (filterText.value || filterType.value || filterPosition.value) {
    filterText.value = '';
    filterType.value = '';
    filterPosition.value = '';
  }
  showFilter.value = !showFilter.value;
}

function handleAdd() {
  const entry = store.addWorldEntry();
  expandedIds.value.add(entry.id);
}

function toggleExpand(id) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id);
  else expandedIds.value.add(id);
}

// 排序：数字框 — 插入到目标位置，其他条目自动重新编号
function updateOrder(entry, val) {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 1) return;

  // 取当前可见列表（已排序）
  const sorted = filteredEntries.value.slice();
  // 从列表中移除当前条目
  const idx = sorted.findIndex(e => e.id === entry.id);
  if (idx !== -1) sorted.splice(idx, 1);
  // 插入到目标位置（num-1 因为用户输入从 1 开始）
  const insertAt = Math.min(num - 1, sorted.length);
  sorted.splice(insertAt, 0, entry);
  // 重新分配 cfSortKey
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].extensions) sorted[i].extensions = {};
    sorted[i].extensions.cfSortKey = i + 1;
  }
  store.markDirty();
}

// 排序：拖拽
const dragSourceId = ref(null);
const dragOverId = ref(null);
const dragEnabledId = ref(null);  // 只有按下手柄的那条才允许拖

function onDragStart(e, id) {
  dragSourceId.value = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
}

function onDragOver(e, id) {
  if (id === dragSourceId.value) return;
  dragOverId.value = id;
  e.dataTransfer.dropEffect = 'move';
}

function onDragLeave(id) {
  if (dragOverId.value === id) dragOverId.value = null;
}

function onDrop(e, targetId) {
  const sourceId = dragSourceId.value;
  if (!sourceId || sourceId === targetId) {
    dragSourceId.value = null;
    dragOverId.value = null;
    return;
  }

  // 在筛选后的列表里调整顺序（用户看到的列表）
  const visible = [...filteredEntries.value];
  const sourceIdx = visible.findIndex(e => e.id === sourceId);
  const targetIdx = visible.findIndex(e => e.id === targetId);
  if (sourceIdx === -1 || targetIdx === -1) {
    dragSourceId.value = null;
    dragOverId.value = null;
    return;
  }

  // 把源条目从原位置移到目标位置
  const [moved] = visible.splice(sourceIdx, 1);
  visible.splice(targetIdx, 0, moved);

  // 重新分配 cfSortKey，按新顺序从 1 开始（不动 insertion_order）
  for (let i = 0; i < visible.length; i++) {
    if (!visible[i].extensions) visible[i].extensions = {};
    visible[i].extensions.cfSortKey = i + 1;
  }

  store.markDirty();
  dragSourceId.value = null;
  dragOverId.value = null;
  appStore.toastSuccess('已重新排序');
}

function onDragEnd() {
  dragSourceId.value = null;
  dragOverId.value = null;
  dragEnabledId.value = null;
}

// 批量操作
const batchMode = ref(false);
const wbSelectedIds = ref(new Set());

const wbSelectedAll = computed(() =>
  filteredEntries.value.length > 0 && wbSelectedIds.value.size === filteredEntries.value.length
);

function toggleBatchMode() {
  batchMode.value = !batchMode.value;
  wbSelectedIds.value = new Set();
}

function wbToggleSelect(id) {
  const s = new Set(wbSelectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  wbSelectedIds.value = s;
}

function wbToggleSelectAll() {
  if (wbSelectedAll.value) {
    wbSelectedIds.value = new Set();
  } else {
    wbSelectedIds.value = new Set(filteredEntries.value.map(e => e.id));
  }
}

function getSelected() {
  return entries.value.filter(e => wbSelectedIds.value.has(e.id));
}

function wbBatchEnable(val) {
  getSelected().forEach(e => { e.enabled = val; });
  store.markDirty();
  appStore.toastSuccess(`已${val ? '启用' : '禁用'} ${wbSelectedIds.value.size} 条`);
}

function wbBatchConstant(val) {
  getSelected().forEach(e => { e.constant = val; });
  store.markDirty();
  appStore.toastSuccess(`已${val ? '设为常驻' : '取消常驻'} ${wbSelectedIds.value.size} 条`);
}

function wbBatchPosition(pos) {
  getSelected().forEach(e => {
    e.position = pos;
    e.extensions.position = pos === 'before_char' ? 0 : 1;
  });
  store.markDirty();
  appStore.toastSuccess(`已批量修改 ${wbSelectedIds.value.size} 条位置`);
}

function wbBatchDelete() {
  const count = wbSelectedIds.value.size;
  appStore.confirmAction(`确定删除选中的 ${count} 条世界书条目？`, () => {
    for (const id of wbSelectedIds.value) {
      store.removeWorldEntry(id);
    }
    wbSelectedIds.value = new Set();
    appStore.toastSuccess(`已删除 ${count} 条世界书条目`);
  });
}

function syncPosition(entry) {
  const posMap = {
    'before_char': 0,
    'after_char': 1,
    'before_example': 2,
    'after_example': 3,
    'before_author': 4,
    'after_author': 5,
    'atDepth_system': 6,
    'atDepth_user': 7,
    'atDepth_ai': 8
  };
  entry.extensions.position = posMap[entry.position] ?? 0;
  // 深度插入时 role 自动设置
  if (entry.position === 'atDepth_system') entry.extensions.role = 0;
  else if (entry.position === 'atDepth_user') entry.extensions.role = 1;
  else if (entry.position === 'atDepth_ai') entry.extensions.role = 2;
}
</script>

<style scoped>
.wb-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-panel {
  border-color: var(--cf-accent);
  border-width: 1px;
  box-shadow: 0 0 24px var(--cf-accent-dim);
}

.ai-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.ai-results h4 {
  font-size: 14px;
  color: var(--cf-accent);
}

.ai-result-item {
  background: var(--cf-bg-tertiary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  padding: 12px;
  margin-bottom: 8px;
  transition: var(--cf-transition);
}
.ai-result-item--selected {
  border-color: var(--cf-accent);
  background: var(--cf-accent-dim);
}
.ai-result-item__name {
  font-weight: 600;
  font-size: 13px;
}
.ai-result-item__keys {
  font-size: 11px;
  color: var(--cf-text-muted);
}
.ai-result-item__content {
  font-size: 12px;
  line-height: 1.7;
  color: var(--cf-text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--cf-font);
  background: none;
  border: none;
  margin: 8px 0;
  max-height: 200px;
  overflow-y: auto;
}
.ai-result-item__meta {
  font-size: 11px;
  color: var(--cf-text-muted);
}

.wb-entry {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  margin-bottom: 8px;
  overflow: hidden;
  transition: var(--cf-transition);
}
.wb-entry--disabled { opacity: 0.5; }
.wb-entry--constant { border-left: 3px solid var(--cf-warning); }

.wb-entry__header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: var(--cf-transition);
}
.wb-entry__header:hover { background: var(--cf-bg-hover); }

.wb-entry__expand { font-size: 10px; color: var(--cf-text-muted); width: 16px; }
.wb-entry__id { font-size: 11px; color: var(--cf-text-muted); font-family: var(--cf-font-mono); }
.wb-entry__name { font-weight: 500; font-size: 13px; margin-left: 4px; }
.wb-entry__keys {
  font-size: 11px;
  color: var(--cf-accent);
  background: var(--cf-accent-dim);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
}
.wb-entry__meta { font-size: 11px; color: var(--cf-text-muted); }

.wb-entry__body {
  padding: 16px;
  border-top: 1px solid var(--cf-border);
  background: var(--cf-bg-tertiary);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
.batch-bar {
  border: 1px solid rgba(96, 165, 250, 0.2);
  background: rgba(96, 165, 250, 0.04);
}
.wb-drag-handle {
  display: inline-block;
  width: 14px;
  text-align: center;
  color: var(--cf-text-muted);
  cursor: grab;
  font-weight: bold;
  font-size: 14px;
  user-select: none;
  margin-right: 4px;
  &:hover { color: var(--cf-accent); }
  &:active { cursor: grabbing; }
}
.wb-order-input {
  width: 56px;
  padding: 3px 6px;
  font-size: 12px;
  font-family: var(--cf-font-mono);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--cf-border);
  border-radius: 3px;
  color: var(--cf-text-primary);
  margin-right: 6px;
  text-align: center;
  &:hover { border-color: var(--cf-border-light); }
  &:focus { border-color: rgba(255, 215, 0, 0.5); outline: none; }
  /* 隐藏 number input 的上下箭头 */
  -moz-appearance: textfield;
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
}
.wb-entry--dragging {
  opacity: 0.4;
}
.wb-entry--dragover {
  border-top: 2px solid rgba(255, 215, 0, 0.6);
  box-shadow: 0 -4px 12px rgba(255, 215, 0, 0.15);
}
</style>

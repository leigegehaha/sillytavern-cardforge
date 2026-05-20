<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>小说转世界书</h1>
        <p>把整本小说提取成结构化世界书条目（5 类分步：角色 / 事件线 / 时间线 / 设定 / 物品轨迹）</p>
      </div>
      <div class="tabs">
        <div :class="['tabs__item', { active: tab === 'auto' }]" @click="tab = 'auto'">全自动</div>
        <div :class="['tabs__item', { active: tab === 'focused' }]" @click="tab = 'focused'">重点扩写</div>
        <div :class="['tabs__item', { active: tab === 'ide' }]" @click="tab = 'ide'">IDE 引导式</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- ============ 左侧：配置 + 输入 ============ -->
      <div>
        <!-- 配置面板 -->
        <div class="card mb-md">
          <div class="card__header"><h3>篇章配置</h3></div>
          <div class="card__body">
            <div class="grid-2">
              <div class="form-group">
                <label>小说名</label>
                <input class="input" v-model="config.novelName" placeholder="如：你的小说名">
              </div>
              <div class="form-group">
                <label>篇章名（用于条目前缀）</label>
                <input class="input" v-model="config.chapterName" placeholder="如：第一篇 / 序章篇 / 修炼篇">
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label>主角姓名 <span class="badge badge--danger">必填</span></label>
                <input class="input" v-model="config.protagonistName" placeholder="如：陈逸 / 主角姓名">
              </div>
              <div class="form-group">
                <label>玩家身份</label>
                <select class="select" v-model="config.userMode">
                  <option v-for="m in PROTAGONIST_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
                <div class="hint">{{ currentModeDesc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 小说原文 -->
        <div class="card mb-md">
          <div class="card__header flex-between">
            <h3>小说原文</h3>
            <div class="flex-row">
              <button class="btn btn--secondary btn--sm" @click="importNovel">导入 txt 文件</button>
              <button class="btn btn--ghost btn--sm" @click="novelText = ''" :disabled="!novelText">清空</button>
            </div>
          </div>
          <div class="card__body">
            <textarea class="textarea" v-model="novelText" rows="10"
              placeholder="粘贴小说原文，或点上方「导入 txt 文件」"></textarea>
            <div class="hint">{{ novelText.length }} 字 · 估算 {{ estimatedTokens }} token</div>
          </div>
        </div>

        <!-- 切片预览 -->
        <div v-if="novelText.trim().length > 0" class="card mb-md">
          <div class="card__header"><h3>切片预览</h3></div>
          <div class="card__body">
            <div class="grid-3">
              <div class="form-group">
                <label>切片策略</label>
                <select class="select" v-model="config.chunkStrategy">
                  <option value="auto">智能（按章节优先 + 字数 fallback）</option>
                  <option value="chapter">强制按章节</option>
                  <option value="words">强制按字数</option>
                </select>
              </div>
              <div class="form-group" v-if="config.chunkStrategy !== 'words'">
                <label>每片章节数</label>
                <input class="input" type="number" v-model.number="config.chaptersPerChunk" min="1" max="20">
              </div>
              <div class="form-group" v-if="config.chunkStrategy !== 'chapter'">
                <label>每片字数</label>
                <input class="input" type="number" v-model.number="config.wordsPerChunk" min="1000" step="1000">
              </div>
            </div>

            <div class="chunk-preview">
              <div class="flex-between">
                <span class="badge" :class="chunkInfo.strategy === 'chapter' ? 'badge--success' : 'badge--warning'">
                  {{ chunkInfo.strategy === 'chapter' ? '按章节切' : '按字数切' }}
                </span>
                <span v-if="chunkInfo.fallback" class="hint" style="color:var(--cf-warning)">
                  原文未识别到 ≥3 个章节标题，已 fallback 到字数切
                </span>
              </div>
              <div class="hint mt-sm">
                <strong>{{ chunkInfo.totalChapters > 0 ? `检测到 ${chunkInfo.totalChapters} 章` : '未识别章节' }}</strong>
                · 切成 <strong>{{ chunkInfo.chunks.length }} 片</strong>
                · 5 类分步 = <strong>{{ totalCalls }} 次 AI 调用</strong>
                · 预估 <strong>{{ formatTime(estimatedSeconds) }}</strong>
              </div>
              <div v-if="novelText.length > 300000" class="warning-box mt-sm">
                注意：原文 {{ Math.round(novelText.length / 10000) }} 万字，超过 30 万阈值。建议分篇章操作（每次 50-100 章）。
              </div>
            </div>

            <!-- 「只跑前 N 章」限制 -->
            <div v-if="chunkInfo.chunks.length > 1" class="form-group mt-md">
              <label>只跑前 N 片（0 = 全部）</label>
              <input class="input" type="number" v-model.number="config.chapterRangeEnd"
                min="0" :max="chunkInfo.chunks.length" placeholder="0 = 全部">
              <div class="hint">先跑前几片试试效果，再决定要不要全跑（节省 token）</div>
            </div>
          </div>
        </div>

        <!-- 高级设置折叠 -->
        <div class="card mb-md">
          <details>
            <summary class="card__header" style="cursor:pointer;list-style:none">
              <h3>▶ 高级设置</h3>
            </summary>
            <div class="card__body">
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="config.enableR2DoubleCheck">
                <strong>R1+R2 双跑</strong>（每类提取两次独立跑+合并，覆盖率↑，但 token+50% 时长+50%）
              </label>
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="config.enableContinuationSummary">
                <strong>跨篇章衔接摘要</strong>（完成后自动生成衔接摘要供下一篇章使用）
              </label>
              <label class="toggle-label mb-md">
                <input type="checkbox" v-model="config.enableSelfCheck">
                <strong>每类提取后 AI 自检</strong>（额外 5 次调用，质量↑）
              </label>
            </div>
          </details>
        </div>

        <!-- Tab 内容 -->
        <div class="card">
          <div class="card__body">
            <!-- 全自动 tab -->
            <div v-if="tab === 'auto'">
              <p class="hint mb-md">一键串跑 5 类提取，全自动无需干预。中途可暂停/继续。</p>
              <button class="btn btn--primary btn--lg" style="width:100%"
                :disabled="!canStart"
                @click="startAuto">
                {{ running ? '提取中...' : '开始全自动提取' }}
              </button>
            </div>

            <!-- 重点扩写 tab -->
            <div v-if="tab === 'focused'">
              <p class="hint mb-md">只跑你选中的类型，不要的不浪费 token。</p>
              <div class="form-group">
                <label>提取这几类：</label>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                  <label v-for="t in EXTRACTION_TYPES" :key="t.key" class="toggle-label">
                    <input type="checkbox" :value="t.key" v-model="config.selectedTypes">
                    <strong>{{ t.label }}</strong>
                    <span class="hint" style="margin-left:auto">{{ t.desc }}</span>
                  </label>
                </div>
              </div>
              <button class="btn btn--primary btn--lg" style="width:100%;margin-top:12px"
                :disabled="!canStart || config.selectedTypes.length === 0"
                @click="startFocused">
                {{ running ? '提取中...' : `提取选中 ${config.selectedTypes.length} 类` }}
              </button>
            </div>

            <!-- IDE 引导式 tab -->
            <div v-if="tab === 'ide'">
              <p class="hint mb-md">
                逐类手动跑，每类完成后查看结果可单独重试。最详细的控制模式。
              </p>
              <div v-for="t in EXTRACTION_TYPES" :key="t.key" class="ide-step">
                <div class="flex-between">
                  <div>
                    <strong>{{ t.label }}</strong>
                    <span class="hint" style="margin-left:8px">{{ getStepStatus(t.key) }}</span>
                  </div>
                  <div class="flex-row">
                    <button class="btn btn--primary btn--sm"
                      :disabled="!canStart || progress[t.key]?.running"
                      @click="runSingleType(t.key)">
                      {{ progress[t.key]?.done > 0 ? '重新提取' : '开始提取' }}
                    </button>
                  </div>
                </div>
                <div v-if="progress[t.key]?.total > 0" class="ide-step__progress">
                  <div class="ide-step__bar" :style="{ width: getPercent(t.key) + '%' }"></div>
                </div>
              </div>
            </div>

            <button v-if="running" class="btn btn--danger btn--sm mt-md" style="width:100%"
              @click="stopExtraction">
              停止当前提取
            </button>
          </div>
        </div>
      </div>

      <!-- ============ 右侧：进度 + 预览 + 注入 ============ -->
      <div>
        <!-- 进度树 -->
        <div v-if="running || hasAnyResult" class="card mb-md">
          <div class="card__header"><h3>提取进度</h3></div>
          <div class="card__body">
            <div class="progress-tree">
              <div class="progress-tree__row" :class="{ done: chunkInfo.chunks.length > 0 }">
                切片预处理
                <span class="hint" style="margin-left:auto">
                  {{ chunkInfo.chunks.length > 0 ? `已切 ${chunkInfo.chunks.length} 片` : '等待原文' }}
                </span>
              </div>
              <div class="progress-tree__row">
                5 类提取
                <span class="hint" style="margin-left:auto">{{ overallProgress }}</span>
              </div>
              <div v-for="t in EXTRACTION_TYPES" :key="t.key" class="progress-tree__sub"
                :class="{
                  active: progress[t.key]?.running,
                  done: progress[t.key]?.done >= (progress[t.key]?.total || 0) && progress[t.key]?.done > 0
                }">
                <span style="margin-right:8px">{{ getProgressIcon(t.key) }}</span>
                {{ t.label }}
                <span class="hint" style="margin-left:auto">
                  {{ progress[t.key]?.done || 0 }} / {{ progress[t.key]?.total || 0 }} 片
                  <span v-if="getResultCount(t.key) > 0">· 提取 {{ getResultCount(t.key) }} 项</span>
                </span>
              </div>
              <div class="progress-tree__row" :class="{ done: previewEntries.length > 0 }">
                注入预览
                <span class="hint" style="margin-left:auto">
                  {{ previewEntries.length > 0 ? `${previewEntries.length} 条待注入` : '等提取完成' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 质量评分 -->
        <div v-if="hasAnyResult" class="card mb-md">
          <div class="card__header flex-between">
            <h3>质量评分</h3>
            <span class="quality-score" :class="getScoreClass()">{{ qualitySummary.score }} / 100</span>
          </div>
          <div class="card__body">
            <div v-if="qualitySummary.suggestions.length === 0" class="hint" style="color:var(--cf-success)">
              ✓ 未发现明显质量问题
            </div>
            <ul v-else style="margin:0;padding-left:20px">
              <li v-for="(s, i) in qualitySummary.suggestions" :key="i" class="hint">{{ s }}</li>
            </ul>
            <button v-if="hasAnyResult && !running" class="btn btn--secondary btn--sm mt-md"
              @click="runAiSelfCheckAll">
              {{ selfChecking ? '自检中...' : '一键 AI 自检全部类型' }}
            </button>
          </div>
        </div>

        <!-- 注入预览 -->
        <div class="card" style="min-height:300px">
          <div class="card__header flex-between">
            <h3>注入预览（{{ previewEntries.length }}）</h3>
            <div class="flex-row" v-if="previewEntries.length > 0">
              <button class="btn btn--ghost btn--sm" @click="selectAllPreview(true)">全选</button>
              <button class="btn btn--ghost btn--sm" @click="selectAllPreview(false)">全不选</button>
              <button class="btn btn--primary btn--sm" @click="injectSelected"
                :disabled="selectedPreviewCount === 0">
                注入选中 {{ selectedPreviewCount }} 条到世界书
              </button>
            </div>
          </div>
          <div class="card__body" style="overflow-y:auto;max-height:calc(100vh - 200px)">
            <div v-if="previewEntries.length === 0" class="empty-state">
              <div class="empty-state__title">等待提取</div>
              <div class="empty-state__desc">填好配置 + 粘贴小说后点开始</div>
            </div>
            <WorldEntryCard v-for="(entry, i) in previewEntries" :key="i"
              :entry="entry"
              mode="preview"
              :expanded="previewExpanded.has(i)"
              :selected="entry._selected !== false"
              @toggle-expand="togglePreviewExpand(i)"
              @toggle-select="entry._selected = entry._selected === false"
              @delete="previewEntries.splice(i, 1)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { chatForJsonArray } from '../utils/json-repair.js';
import WorldEntryCard from '../components/WorldEntryCard.vue';
import {
  EXTRACTION_TYPES, PROTAGONIST_MODES,
  WRITING_RULES_BASE, buildProtagonistRule,
  EXTRACT_CHARACTER_PROMPT, EXTRACT_EVENTLINE_PROMPT, EXTRACT_TIMELINE_PROMPT,
  EXTRACT_SETTING_PROMPT, EXTRACT_ITEM_TRAJECTORY_PROMPT,
  R2_OFFSET_PROMPT
} from '../utils/novel-extract-rules.js';
import {
  emptyExtraction, emptyExtractConfig,
  chunkNovel, extractionToWorldEntries,
  normalizeExtractionArray, estimateTotalCalls, estimateTotalTime, estimateTokens
} from '../utils/novel-extract-format.js';
import { aiSelfCheckExtraction, mergeR1R2, mergeSameNameByAI, summarizeExtractionQuality } from '../utils/novel-extract-checker.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

// ==================== 状态 ====================
const tab = ref('auto');
const novelText = ref('');
const config = reactive({ ...emptyExtractConfig(), enableSelfCheck: false });
const running = ref(false);
const stopFlag = ref(false);
const selfChecking = ref(false);
const extraction = reactive(emptyExtraction());
const previewEntries = ref([]);
const previewExpanded = ref(new Set());

// 每个 type 的进度
const progress = reactive({
  character: { done: 0, total: 0, running: false },
  eventline: { done: 0, total: 0, running: false },
  timeline: { done: 0, total: 0, running: false },
  setting: { done: 0, total: 0, running: false },
  item_trajectory: { done: 0, total: 0, running: false }
});

// ==================== Computed ====================
const currentModeDesc = computed(() => PROTAGONIST_MODES.find(m => m.value === config.userMode)?.desc || '');

const chunkInfo = computed(() => {
  if (!novelText.value.trim()) return { strategy: 'words', chunks: [], totalChapters: 0, fallback: false };
  return chunkNovel(novelText.value, {
    strategy: config.chunkStrategy,
    chaptersPerChunk: config.chaptersPerChunk,
    wordsPerChunk: config.wordsPerChunk
  });
});

const effectiveChunks = computed(() => {
  const all = chunkInfo.value.chunks;
  const limit = config.chapterRangeEnd > 0 ? Math.min(config.chapterRangeEnd, all.length) : all.length;
  return all.slice(0, limit);
});

const totalCalls = computed(() => {
  return estimateTotalCalls(effectiveChunks.value.length, config.selectedTypes, config.enableR2DoubleCheck)
    + (config.enableSelfCheck ? config.selectedTypes.length : 0);
});

const estimatedSeconds = computed(() => estimateTotalTime(totalCalls.value));

const estimatedTokens = computed(() => estimateTokens(novelText.value));

const canStart = computed(() => {
  return !running.value
    && novelText.value.trim().length > 0
    && config.protagonistName.trim().length > 0
    && effectiveChunks.value.length > 0
    && apiStore.isConfigured;
});

const hasAnyResult = computed(() => {
  return extraction.characters.length > 0
    || extraction.eventlines.length > 0
    || extraction.timeline.length > 0
    || extraction.settings.length > 0
    || extraction.item_trajectories.length > 0;
});

const overallProgress = computed(() => {
  let done = 0, total = 0;
  for (const t of EXTRACTION_TYPES) {
    done += progress[t.key].done;
    total += progress[t.key].total;
  }
  return total > 0 ? `${done} / ${total} 片` : '待开始';
});

const qualitySummary = computed(() => summarizeExtractionQuality(extraction));

const selectedPreviewCount = computed(() => previewEntries.value.filter(e => e._selected !== false).length);

// ==================== 持久化（断点续跑）====================
const STORAGE_KEY = 'cf_novel_extract_state';

function saveState() {
  try {
    const state = { config: JSON.parse(JSON.stringify(config)), extraction: JSON.parse(JSON.stringify(extraction)), novelText: novelText.value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.config) Object.assign(config, state.config);
    if (state.extraction) Object.assign(extraction, state.extraction);
    if (state.novelText) novelText.value = state.novelText;
    rebuildPreview();
  } catch (e) {}
}

watch([extraction, () => config.chapterName, () => config.userMode], () => { saveState(); }, { deep: true });

onMounted(() => { loadState(); });

// ==================== 工具 ====================
function importNovel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.text,.md';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      novelText.value = await file.text();
      appStore.toastSuccess(`已导入「${file.name}」(${novelText.value.length} 字)`);
    } catch (err) {
      appStore.toastError('导入失败: ' + err.message);
    }
  };
  input.click();
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${(seconds / 3600).toFixed(1)} 小时`;
}

function getStepStatus(typeKey) {
  const p = progress[typeKey];
  if (p.running) return `进行中 ${p.done}/${p.total}`;
  if (p.done > 0 && p.done >= p.total) return `已完成 (${getResultCount(typeKey)} 项)`;
  if (p.done > 0) return `已部分完成 ${p.done}/${p.total}`;
  return '未开始';
}

function getResultCount(typeKey) {
  const map = {
    character: 'characters', eventline: 'eventlines', timeline: 'timeline',
    setting: 'settings', item_trajectory: 'item_trajectories'
  };
  return extraction[map[typeKey]]?.length || 0;
}

function getProgressIcon(typeKey) {
  const p = progress[typeKey];
  if (p.running) return '·';
  if (p.done > 0 && p.done >= p.total) return '·';
  return '·';
}

function getPercent(typeKey) {
  const p = progress[typeKey];
  return p.total > 0 ? Math.round(p.done / p.total * 100) : 0;
}

function getScoreClass() {
  const s = qualitySummary.value.score;
  if (s >= 80) return 'quality-score--good';
  if (s >= 60) return 'quality-score--mid';
  return 'quality-score--bad';
}

// ==================== 提取核心 ====================
const TYPE_PROMPT_MAP = {
  character: EXTRACT_CHARACTER_PROMPT,
  eventline: EXTRACT_EVENTLINE_PROMPT,
  timeline: EXTRACT_TIMELINE_PROMPT,
  setting: EXTRACT_SETTING_PROMPT,
  item_trajectory: EXTRACT_ITEM_TRAJECTORY_PROMPT
};

const TYPE_RESULT_KEY = {
  character: 'characters',
  eventline: 'eventlines',
  timeline: 'timeline',
  setting: 'settings',
  item_trajectory: 'item_trajectories'
};

async function runChunkExtract(chunk, type, withR2 = false) {
  const sysMsg = '你是 SillyTavern 写卡专家。' + WRITING_RULES_BASE + '\n\n' + buildProtagonistRule(config.userMode, config.protagonistName);
  const userPrompt = TYPE_PROMPT_MAP[type]
    + (withR2 ? '\n\n' + R2_OFFSET_PROMPT : '')
    + `\n\n## 小说原文片段\n\n${chunk}`;

  const result = await chatForJsonArray(apiStore, [
    { role: 'system', content: sysMsg },
    { role: 'user', content: userPrompt }
  ], {
    temperature: 0.7,
    maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model)
  });
  return normalizeExtractionArray(result, type);
}

async function runTypeForAllChunks(type) {
  const chunks = effectiveChunks.value;
  progress[type].running = true;
  progress[type].total = chunks.length;
  progress[type].done = 0;

  const r1Results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (stopFlag.value) break;
    try {
      const items = await runChunkExtract(chunks[i], type, false);
      r1Results.push(...items);
    } catch (e) {
      appStore.toastWarning(`第 ${i + 1} 片 [${type}] 出错: ${e.message}`);
    }
    progress[type].done = i + 1;
    if (i < chunks.length - 1) await sleep(13000);
  }

  let finalResults = r1Results;

  // 跨片同名合并（默认路径必跑，解决跨 chunk 同名重复 bug）
  if (!stopFlag.value && finalResults.length > 1) {
    appStore.toastInfo(`[${type}] 跨片合并同名条目中...`);
    finalResults = await mergeSameNameByAI(apiStore, finalResults, type);
  }

  if (config.enableR2DoubleCheck && !stopFlag.value) {
    let r2Results = [];
    progress[type].done = 0;
    appStore.toastInfo(`[${type}] R2 双跑开始...`);
    for (let i = 0; i < chunks.length; i++) {
      if (stopFlag.value) break;
      try {
        const items = await runChunkExtract(chunks[i], type, true);
        r2Results.push(...items);
      } catch (e) {}
      progress[type].done = i + 1;
      if (i < chunks.length - 1) await sleep(13000);
    }
    if (!stopFlag.value && r2Results.length > 1) {
      appStore.toastInfo(`[${type}] R2 跨片合并同名条目中...`);
      r2Results = await mergeSameNameByAI(apiStore, r2Results, type);
    }
    if (!stopFlag.value) {
      finalResults = await mergeR1R2(apiStore, finalResults, r2Results, type);
    }
  }

  if (config.enableSelfCheck && !stopFlag.value) {
    appStore.toastInfo(`[${type}] AI 自检中...`);
    finalResults = await aiSelfCheckExtraction(apiStore, finalResults, type);
  }

  extraction[TYPE_RESULT_KEY[type]] = finalResults;
  progress[type].running = false;
  rebuildPreview();
}

async function startAuto() {
  config.selectedTypes = ['character', 'eventline', 'timeline', 'setting', 'item_trajectory'];
  await runTypes(config.selectedTypes);
}

async function startFocused() {
  if (config.selectedTypes.length === 0) {
    appStore.toastError('请至少选一类');
    return;
  }
  await runTypes(config.selectedTypes);
}

async function runSingleType(type) {
  await runTypes([type]);
}

async function runTypes(types) {
  if (!canStart.value) return;
  running.value = true;
  stopFlag.value = false;
  try {
    for (const type of types) {
      if (stopFlag.value) break;
      await runTypeForAllChunks(type);
    }
    if (!stopFlag.value) {
      appStore.toastSuccess(`提取完成 (${types.length} 类)`);
    } else {
      appStore.toastInfo('已停止提取');
    }
  } catch (e) {
    appStore.toastError(`提取失败: ${e.message}`);
  } finally {
    running.value = false;
    stopFlag.value = false;
  }
}

function stopExtraction() {
  stopFlag.value = true;
  appStore.toastInfo('收到停止信号，等当前片完成后停下');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ==================== AI 自检全部 ====================
async function runAiSelfCheckAll() {
  if (!apiStore.isConfigured) return;
  selfChecking.value = true;
  try {
    for (const t of EXTRACTION_TYPES) {
      const key = TYPE_RESULT_KEY[t.key];
      if (extraction[key].length === 0) continue;
      extraction[key] = await aiSelfCheckExtraction(apiStore, extraction[key], t.key);
      await sleep(13000);
    }
    rebuildPreview();
    appStore.toastSuccess('全部自检完成');
  } catch (e) {
    appStore.toastError('自检失败: ' + e.message);
  } finally {
    selfChecking.value = false;
  }
}

// ==================== 预览 + 注入 ====================
function rebuildPreview() {
  const entries = extractionToWorldEntries(extraction, config);
  for (const e of entries) e._selected = true;
  previewEntries.value = entries;
}

function togglePreviewExpand(idx) {
  if (previewExpanded.value.has(idx)) previewExpanded.value.delete(idx);
  else previewExpanded.value.add(idx);
  previewExpanded.value = new Set(previewExpanded.value);
}

function selectAllPreview(val) {
  for (const e of previewEntries.value) e._selected = val;
}

function injectSelected() {
  const selected = previewEntries.value.filter(e => e._selected !== false);
  if (selected.length === 0) {
    appStore.toastWarning('请至少选中一条');
    return;
  }
  let count = 0;
  for (const e of selected) {
    const entry = cardStore.addWorldEntry();
    entry.comment = e.comment;
    entry.keys = e.keys;
    entry.secondary_keys = e.secondary_keys || [];
    entry.content = e.content;
    entry.constant = e.constant;
    entry.selective = e.selective;
    entry.enabled = e.enabled !== false;
    entry.position = e.position;
    entry.insertion_order = e.insertion_order || 100;
    Object.assign(entry.extensions, e.extensions || {});
    count++;
  }
  appStore.toastSuccess(`已注入 ${count} 条到世界书`);
  // 注入后清空预览，避免重复
  previewEntries.value = [];
}
</script>

<style scoped>
.tabs { display: flex; gap: 4px; }
.tabs__item {
  padding: 8px 16px; cursor: pointer; font-size: 13px;
  color: var(--cf-text-secondary); border-bottom: 2px solid transparent;
  transition: all var(--cf-transition);
}
.tabs__item:hover { color: var(--cf-text-primary); }
.tabs__item.active { color: var(--cf-accent); border-bottom-color: var(--cf-accent); }

.toggle-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
}
.toggle-label input { accent-color: var(--cf-accent); }

.chunk-preview {
  background: var(--cf-bg-tertiary);
  border-radius: var(--cf-radius-sm);
  padding: 12px;
  margin-top: 12px;
}

.warning-box {
  background: rgba(251,191,36,0.1);
  border: 1px solid rgba(251,191,36,0.3);
  color: var(--cf-warning);
  padding: 8px 10px;
  border-radius: var(--cf-radius-sm);
  font-size: 12px;
}

.ide-step {
  padding: 12px;
  background: var(--cf-bg-tertiary);
  border-radius: var(--cf-radius-sm);
  margin-bottom: 8px;
}
.ide-step__progress {
  height: 4px; background: var(--cf-bg-secondary);
  border-radius: 2px; margin-top: 8px; overflow: hidden;
}
.ide-step__bar {
  height: 100%; background: var(--cf-accent);
  transition: width 0.3s;
}

.progress-tree__row {
  padding: 8px 12px;
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--cf-text-secondary);
}
.progress-tree__row.done { color: var(--cf-success); }
.progress-tree__sub {
  padding: 6px 12px 6px 32px;
  display: flex; align-items: center;
  font-size: 12px; color: var(--cf-text-muted);
}
.progress-tree__sub.active { color: var(--cf-info); font-weight: 500; }
.progress-tree__sub.done { color: var(--cf-success); }

.quality-score {
  font-size: 18px; font-weight: 600;
  padding: 4px 12px; border-radius: 4px;
}
.quality-score--good { color: var(--cf-success); background: rgba(74,222,128,0.1); }
.quality-score--mid { color: var(--cf-warning); background: rgba(251,191,36,0.1); }
.quality-score--bad { color: var(--cf-danger); background: rgba(248,113,113,0.1); }

.flex-row { display: flex; align-items: center; gap: 8px; }
.mt-md { margin-top: var(--cf-gap-md); }
.mt-sm { margin-top: var(--cf-gap-sm); }
.mb-md { margin-bottom: var(--cf-gap-md); }
</style>

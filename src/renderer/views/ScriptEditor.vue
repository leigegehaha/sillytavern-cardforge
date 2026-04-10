<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>酒馆助手脚本</h1>
        <p>编辑 Tavern Helper 脚本 — MVU加载、Zod Schema、自动化逻辑</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--accent" @click="autoGenScript" :disabled="aiGen">
          {{ aiGen ? '全自动生成中...' : 'AI 全自动生成' }}
        </button>
        <button class="btn btn--primary" @click="store.addTavernScript()">+ 新建脚本</button>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card__body hint" style="line-height:1.8">
        酒馆助手脚本是用 JavaScript 编写的程序，运行在 SillyTavern 里。常见用途：<br>
        · <strong>加载 MVU</strong> — 一行 import 语句加载变量系统（用 MVU 页面自动生成更方便）<br>
        · <strong>Zod Schema</strong> — 定义变量的结构和范围约束<br>
        · <strong>自动化</strong> — 监听变量更新，自动计算（如每日体力恢复）<br>
        · <strong>按钮</strong> — 在界面添加自定义操作按钮<br>
        · <strong>不需要脚本？</strong> 简单的角色卡不需要这个，只有做游戏系统/变量追踪时才用
      </div>
    </div>

    <div v-if="scripts.length === 0" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">暂无酒馆助手脚本</div>
        <div class="empty-state__desc">脚本可用于加载MVU变量系统、定义Zod Schema、添加按钮等</div>
      </div>
    </div>

    <div v-for="(script, i) in scripts" :key="script.id" class="card mb-md">
      <div class="card__header">
        <div class="flex-row">
          <span class="badge badge--accent">#{{ i + 1 }}</span>
          <input class="input" style="width:300px;font-weight:600" v-model="script.name" @input="store.markDirty()">
          <label class="toggle-label">
            <input type="checkbox" v-model="script.enabled" @change="store.markDirty()"> 启用
          </label>
        </div>
        <button class="btn btn--danger btn--sm" @click="appStore.confirmAction('删除这个脚本？', () => store.removeTavernScript(script.id))">删除</button>
      </div>
      <div class="card__body">
        <div class="form-group">
          <label>脚本说明 (info)</label>
          <input class="input" v-model="script.info" placeholder="可选的说明文字" @input="store.markDirty()">
        </div>
        <div class="form-group">
          <label>脚本代码 (content)</label>
          <textarea class="textarea selectable" v-model="script.content" rows="16"
            style="font-family:var(--cf-font-mono);font-size:12px;line-height:1.6"
            placeholder="JavaScript 代码，如:&#10;import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';"
            @input="store.markDirty()"></textarea>
          <div class="hint">{{ (script.content || '').length }} 字符</div>
        </div>

        <!-- 快捷模板 -->
        <div class="flex-row mb-md">
          <span style="font-size:12px;color:var(--cf-text-muted)">快捷插入：</span>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'mvu')">MVU 加载</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'zod')">Zod Schema</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'auto')">自动化模板</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'command')">命令修正</button>
          <button class="btn btn--ghost btn--sm" @click="insertTemplate(script, 'inject')">注入提示词</button>
        </div>

        <!-- 按钮配置 -->
        <div class="form-group">
          <div class="flex-between">
            <label>按钮配置</label>
            <label class="toggle-label">
              <input type="checkbox" v-model="script.button.enabled" @change="store.markDirty()"> 启用按钮
            </label>
          </div>
          <div v-if="script.button.enabled">
            <div v-for="(btn, j) in script.button.buttons" :key="j" class="flex-row mb-md">
              <input class="input flex-1" v-model="btn.name" placeholder="按钮名称" @input="store.markDirty()">
              <label class="toggle-label">
                <input type="checkbox" v-model="btn.visible" @change="store.markDirty()"> 默认显示
              </label>
              <button class="btn btn--danger btn--sm"
                @click="script.button.buttons.splice(j, 1); store.markDirty()">×</button>
            </div>
            <button class="btn btn--secondary btn--sm"
              @click="script.button.buttons.push({ name: '新按钮', visible: true }); store.markDirty()">
              + 添加按钮
            </button>
          </div>
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
const aiGen = ref(false);

async function autoGenScript() {
  if (!apiStore.isConfigured) { appStore.toastError('请先配置 API Key'); return; }
  aiGen.value = true;
  try {
    const context = buildCardContext(store);
    const hasWorldBook = store.worldEntries.length > 0;
    const hasMvu = store.tavernScripts.some(s => s.content && s.content.includes('MagVarUpdate'));

    const prompt = `你是 SillyTavern 酒馆助手脚本专家。根据以下角色卡信息，自动判断需要什么脚本并生成。

【角色卡信息】
${context}

【当前状态】
- 已有世界书条目：${hasWorldBook ? '是' : '否'}
- 已有MVU变量系统：${hasMvu ? '是' : '否'}
- 已有脚本数：${store.tavernScripts.length}

请自动判断这张卡需要什么脚本。常见判断逻辑：
- 有MVU → 需要 MVU 加载脚本 + Zod Schema
- 有复杂数值系统 → 需要自动化脚本（如每日体力恢复）
- 有NPC好感度 → 可能需要注入提示词脚本

对每个脚本，输出 JSON 数组：
[{ "name": "脚本名称", "content": "完整JS代码", "info": "说明" }]

只生成真正需要的脚本。只输出JSON。`;

    const result = await apiStore.chat([
      { role: 'system', content: '你是酒馆助手脚本专家。只输出合法JSON数组。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 4096 });

    let code = result;
    const codeMatch = result.match(/\[[\s\S]*\]/);
    if (!codeMatch) throw new Error('AI返回格式异常');
    const scripts = JSON.parse(codeMatch[0]);
    for (const s of scripts) {
      store.addTavernScript({
        ...store.createEmptyTavernScript(),
        name: s.name || 'AI 生成脚本',
        content: (s.content || '').trim(),
        info: s.info || ''
      });
    }
    appStore.toastSuccess(`AI 全自动生成了 ${scripts.length} 个脚本`);
  } catch (e) {
    appStore.toastError('全自动生成失败: ' + e.message);
  } finally { aiGen.value = false; }
}

const scripts = computed(() => store.tavernScripts);

const templates = {
  mvu: `import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';`,
  zod: `import { registerMvuSchema } from
  'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// z 和 _ (lodash) 已全局可用

export const Schema = z.object({
  世界: z.object({
    日期: z.string().prefault('第1天'),
    时间: z.string().prefault('08:00'),
    位置: z.string().prefault('未知'),
  }).prefault({}),

  主角: z.object({
    HP: z.coerce.number().transform(v => _.clamp(v, 0, 100)).prefault(100),
    金钱: z.coerce.number().transform(v => Math.max(0, v)).prefault(1000),
  }).prefault({}),

  NPC: z.record(z.string(), z.object({
    好感度: z.coerce.number().transform(v => _.clamp(v, -100, 100)).prefault(0),
  })).prefault({}),
});

$(() => { registerMvuSchema(Schema); });`,
  auto: `// 自动化脚本模板 — 监听变量更新
$(() => {
  waitGlobalInitialized('Mvu').then(() => {
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, errorCatched(async () => {
      const data = Mvu.getMvuData({ type: 'message' });
      if (!data) return;

      // 在这里编写自动化逻辑
      // 例: 自动恢复体力
      // const hp = _.get(data, '主角.HP', 100);
      // if (hp < 100) {
      //   _.set(data, '主角.HP', Math.min(100, hp + 5));
      //   Mvu.replaceMvuData(data, { type: 'message' });
      // }
    }));
  });
});`,
  command: `// 命令解析修正模板 — 修复AI输出的变量更新命令
$(() => {
  waitGlobalInitialized('Mvu').then(() => {
    eventOn(Mvu.events.COMMAND_PARSED, errorCatched(commands => {
      commands.forEach(command => {
        // 修正路径中的错误字符
        command.args[0] = command.args[0].replaceAll('-', '');
        // 可以在这里添加更多修正逻辑
      });
    }));
  });
});`,
  inject: `// 注入提示词模板 — 动态注入变量值用于绿灯激活
$(() => {
  waitGlobalInitialized('Mvu').then(() => {
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, errorCatched(async (newVars) => {
      const value = _.get(newVars, 'stat_data.主角.好感度', 0);
      injectPrompts([{
        id: '激活-好感度',
        content: '好感度=' + value,
        position: 'none',
        should_scan: true,
      }]);
    }));
  });
});`
};

function insertTemplate(script, type) {
  if (script.content) {
    appStore.confirmAction('当前已有代码，是否替换？', () => {
      script.content = templates[type];
      store.markDirty();
    });
    return;
  }
  script.content = templates[type];
  store.markDirty();
}
</script>

<style scoped>
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}
</style>

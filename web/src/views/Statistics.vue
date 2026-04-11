<template>
  <div class="page">
    <div class="page__header">
      <h1>卡片统计</h1>
      <p>当前角色卡的结构分析和数据统计</p>
    </div>

    <div v-if="!cardStore.cardData.name" class="card">
      <div class="empty-state">
        <div class="empty-state__icon"></div>
        <div class="empty-state__title">暂无数据</div>
        <div class="empty-state__desc">请先创建或导入一张角色卡</div>
      </div>
    </div>

    <template v-else>
      <!-- 总览 -->
      <div class="grid-3 mb-md">
        <div class="stat-card">
          <div class="stat-card__value">{{ s.totalEntries }}</div>
          <div class="stat-card__label">世界书条目</div>
          <div class="stat-card__sub">{{ s.enabledEntries }} 启用 / {{ s.disabledEntries }} 禁用</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">{{ s.regexCount }}</div>
          <div class="stat-card__label">正则脚本</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">{{ s.scriptCount }}</div>
          <div class="stat-card__label">酒馆助手脚本</div>
        </div>
      </div>

      <div class="grid-2 mb-md">
        <div class="stat-card">
          <div class="stat-card__value">~{{ s.estimatedTokens.toLocaleString() }}</div>
          <div class="stat-card__label">预估总 Token</div>
          <div class="stat-card__sub">{{ s.totalContentChars.toLocaleString() }} 字符</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">{{ s.constantEntries }}</div>
          <div class="stat-card__label">常驻条目</div>
          <div class="stat-card__sub">每轮对话固定消耗</div>
        </div>
      </div>

      <!-- 世界书分布 -->
      <div class="card mb-md">
        <div class="card__header"><h3>世界书条目分布</h3></div>
        <div class="card__body">
          <div class="wb-dist">
            <div class="wb-dist__row">
              <span class="wb-dist__label">常驻 (constant)</span>
              <div class="wb-dist__bar">
                <div class="wb-dist__fill" style="background:var(--cf-warning)"
                  :style="{ width: pct(constCount, total) + '%' }"></div>
              </div>
              <span class="wb-dist__num">{{ constCount }}</span>
            </div>
            <div class="wb-dist__row">
              <span class="wb-dist__label">触发 (keyword)</span>
              <div class="wb-dist__bar">
                <div class="wb-dist__fill" style="background:var(--cf-info)"
                  :style="{ width: pct(triggerCount, total) + '%' }"></div>
              </div>
              <span class="wb-dist__num">{{ triggerCount }}</span>
            </div>
            <div class="wb-dist__row">
              <span class="wb-dist__label">禁用 (disabled)</span>
              <div class="wb-dist__bar">
                <div class="wb-dist__fill" style="background:var(--cf-danger)"
                  :style="{ width: pct(disabledCount, total) + '%' }"></div>
              </div>
              <span class="wb-dist__num">{{ disabledCount }}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="form-row">
            <div>
              <strong style="font-size:13px">位置分布</strong>
              <p style="font-size:12px;color:var(--cf-text-secondary);margin-top:4px">
                before_char: {{ beforeCount }} 条<br>
                after_char: {{ afterCount }} 条
              </p>
            </div>
            <div>
              <strong style="font-size:13px">字段使用</strong>
              <p style="font-size:12px;color:var(--cf-text-secondary);margin-top:4px">
                description: {{ cardStore.cardData.description ? '有内容' : '空' }}<br>
                personality: {{ cardStore.cardData.personality ? '有内容' : '空' }}<br>
                scenario: {{ cardStore.cardData.scenario ? '有内容' : '空' }}<br>
                system_prompt: {{ cardStore.cardData.system_prompt ? '有内容' : '空' }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <!-- 正则脚本详情 -->
      <div class="card mb-md" v-if="cardStore.regexScripts.length > 0">
        <div class="card__header"><h3>正则脚本详情</h3></div>
        <div class="card__body">
          <div v-for="r in cardStore.regexScripts" :key="r.id" style="margin-bottom:6px;font-size:12px">
            <span class="badge" :class="r.markdownOnly ? 'badge--info' : r.promptOnly ? 'badge--warning' : 'badge--accent'" style="margin-right:6px">
              {{ r.markdownOnly ? '显示层' : r.promptOnly ? 'AI层' : '双层' }}
            </span>
            {{ r.scriptName || '(未命名)' }}
            <span style="color:var(--cf-text-muted)"> | replace {{ (r.replaceString || '').length }}字</span>
            <span v-if="r.minDepth !== null" style="color:var(--cf-text-muted)"> | minD={{ r.minDepth }}</span>
            <span v-if="r.maxDepth !== null" style="color:var(--cf-text-muted)"> | maxD={{ r.maxDepth }}</span>
          </div>
        </div>
      </div>

      <!-- 脚本详情 -->
      <div class="card mb-md" v-if="cardStore.tavernScripts.length > 0">
        <div class="card__header"><h3>酒馆助手脚本详情</h3></div>
        <div class="card__body">
          <div v-for="sc in cardStore.tavernScripts" :key="sc.id" style="margin-bottom:6px;font-size:12px">
            <span class="badge" :class="sc.enabled ? 'badge--success' : 'badge--danger'" style="margin-right:6px">
              {{ sc.enabled ? '启用' : '禁用' }}
            </span>
            {{ sc.name || '(未命名)' }}
            <span style="color:var(--cf-text-muted)"> | {{ (sc.content || '').length }}字</span>
            <span v-if="sc.button?.buttons?.length" style="color:var(--cf-text-muted)"> | {{ sc.button.buttons.length }}个按钮</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCardStore } from '../stores/card.js';

const cardStore = useCardStore();
const s = computed(() => cardStore.stats);
const entries = computed(() => cardStore.worldEntries);

const total = computed(() => entries.value.length || 1);
const constCount = computed(() => entries.value.filter(e => e.constant && e.enabled).length);
const triggerCount = computed(() => entries.value.filter(e => !e.constant && e.enabled).length);
const disabledCount = computed(() => entries.value.filter(e => !e.enabled).length);
const beforeCount = computed(() => entries.value.filter(e => e.position === 'before_char').length);
const afterCount = computed(() => entries.value.filter(e => e.position === 'after_char').length);

function pct(n, t) { return t > 0 ? Math.round(n / t * 100) : 0; }
</script>

<style scoped>
.stat-card {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-md);
  padding: 24px;
  text-align: center;
}
.stat-card__value { font-size: 32px; font-weight: 700; color: var(--cf-accent); }
.stat-card__label { font-size: 13px; color: var(--cf-text-secondary); margin-top: 4px; }
.stat-card__sub { font-size: 11px; color: var(--cf-text-muted); margin-top: 2px; }

.wb-dist__row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.wb-dist__label { width: 120px; font-size: 13px; color: var(--cf-text-secondary); }
.wb-dist__bar {
  flex: 1; height: 8px; background: var(--cf-bg-tertiary);
  border-radius: 4px; overflow: hidden;
}
.wb-dist__fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.wb-dist__num { width: 40px; text-align: right; font-size: 13px; font-weight: 600; }
</style>

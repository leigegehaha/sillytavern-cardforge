<template>
  <div class="page">
    <div class="page__header flex-between">
      <div>
        <h1>状态栏沙盒</h1>
        <p>实时预览状态栏 HTML 渲染效果，手动改变量值看交互响应（不写回 cardData）</p>
      </div>
      <div class="flex-row">
        <button class="btn btn--secondary btn--sm" @click="resetStatData" :disabled="!hasStatusBar">重置变量</button>
      </div>
    </div>

    <div v-if="!hasStatusBar" class="card mb-md">
      <div class="card__body" style="text-align:center;padding:32px">
        <p class="hint" v-if="!statusBarHtml">尚未生成状态栏（正则脚本里没找到「状态栏美化」）。</p>
        <p class="hint" v-else-if="varGroups.length === 0">当前卡的 MVU 变量分组为空。</p>
        <p>请先到「MVU 变量系统」定义变量 + 「前端状态栏」生成状态栏 HTML 后再回来沙盒预览。</p>
        <div style="margin-top:12px">
          <router-link to="/mvu" class="btn btn--secondary">去 MVU 变量系统</router-link>
          <router-link to="/statusbar" class="btn btn--primary" style="margin-left:8px">去前端状态栏</router-link>
        </div>
      </div>
    </div>

    <div v-else class="sandbox-layout">
      <div class="sandbox-pane sandbox-pane--left">
        <div class="card mb-md">
          <div class="card__header flex-between">
            <h3>场景快照</h3>
            <button class="btn btn--secondary btn--sm" @click="saveSnapshot">+ 保存当前状态</button>
          </div>
          <div class="card__body">
            <div v-if="snapshots.length === 0" class="hint">还没保存场景。改完变量后点「+ 保存当前状态」即可命名快照（如「满血」/「残血」/「装备齐全」），切换测试不同场景</div>
            <div v-else class="flex-row" style="flex-wrap:wrap;gap:6px">
              <span v-for="s in snapshots" :key="s.id" style="display:inline-flex;align-items:center;gap:0">
                <template v-if="editingSnapshotId === s.id">
                  <input class="input" v-model="editingSnapshotName" style="width:120px"
                    @keyup.enter="confirmRenameSnapshot" @keyup.escape="cancelRenameSnapshot" @blur="confirmRenameSnapshot"/>
                </template>
                <template v-else>
                  <button class="btn btn--ghost btn--sm" @click="loadSnapshot(s)" @dblclick="startRenameSnapshot(s)"
                    title="点击加载 / 双击改名">{{ s.name }}</button>
                  <button class="btn btn--danger btn--sm" style="padding:2px 6px;font-size:11px"
                    @click="deleteSnapshot(s.id)" title="删除">×</button>
                </template>
              </span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__header">
            <h3>变量编辑器</h3>
          </div>
          <div class="card__body">
            <div v-for="(group, gi) in varGroups" :key="gi" class="mb-md">
              <div style="font-weight:600;margin-bottom:6px;color:var(--cf-accent)">{{ group.name }}</div>
              <div v-for="(field, fi) in group.fields" :key="fi" class="form-group" style="margin-bottom:6px">
                <label style="display:block;font-size:12px;margin-bottom:2px;color:var(--cf-text-secondary)">{{ field.name }}</label>
                <template v-if="field.type === 'number'">
                  <input class="input" type="number" :value="getMockValue(group.name, field.name)"
                    @input="setMockValue(group.name, field.name, Number($event.target.value))"/>
                </template>
                <template v-else-if="field.type === 'boolean'">
                  <select class="select" :value="String(getMockValue(group.name, field.name))"
                    @change="setMockValue(group.name, field.name, $event.target.value === 'true')">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </template>
                <template v-else-if="field.type === 'enum' && field.enumValues">
                  <select class="select" :value="getMockValue(group.name, field.name)"
                    @change="setMockValue(group.name, field.name, $event.target.value)">
                    <option v-for="opt in field.enumValues.split(',').map(v => v.trim()).filter(Boolean)"
                      :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </template>
                <template v-else>
                  <input class="input" :value="getMockValue(group.name, field.name)"
                    @input="setMockValue(group.name, field.name, $event.target.value)"/>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sandbox-pane sandbox-pane--right">
        <div class="card">
          <div class="card__header">
            <h3>状态栏实时预览</h3>
            <span class="hint" style="font-size:11px">改左侧字段 → 立刻触发 mock VARIABLE_UPDATE_ENDED 事件</span>
          </div>
          <div class="card__body" style="padding:0">
            <iframe ref="iframeRef" :srcdoc="iframeSrcdoc" class="sandbox-iframe"
              sandbox="allow-scripts allow-same-origin" @load="onIframeLoad"></iframe>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useAppStore } from '../stores/app.js';

const cardStore = useCardStore();
const appStore = useAppStore();

const varGroups = computed(() => cardStore.cardData.extensions?.cfMvuVarGroups || []);

const statusBarHtml = computed(() => {
  const regexes = cardStore.cardData.extensions?.regex_scripts || [];
  const found = regexes.find(r => r.scriptName === '状态栏美化');
  if (!found) return null;
  let html = found.replaceString || '';
  html = html.replace(/^```html\n?/, '').replace(/\n?```\s*$/, '');
  return html.trim() || null;
});

const hasStatusBar = computed(() => statusBarHtml.value !== null && varGroups.value.length > 0);

function buildInitialMockData() {
  const data = {};
  for (const group of varGroups.value) {
    if (!group.name) continue;
    const groupObj = {};
    for (const f of group.fields) {
      if (!f.name) continue;
      const parts = f.name.split('.');
      let node = groupObj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
        node = node[parts[i]];
      }
      const leaf = parts[parts.length - 1];
      let v;
      switch (f.type) {
        case 'number': v = Number(f.defaultValue) || 0; break;
        case 'boolean': v = f.defaultValue === 'true' || f.defaultValue === true; break;
        case 'array': v = []; break;
        case 'record': v = {}; break;
        default: v = String(f.defaultValue || '');
      }
      node[leaf] = v;
    }
    data[group.name] = groupObj;
  }
  return data;
}

const mockStatData = ref({});

function getMockValue(groupName, fieldPath) {
  const parts = [groupName, ...fieldPath.split('.')];
  let node = mockStatData.value;
  for (const p of parts) {
    if (node == null) return '';
    node = node[p];
  }
  return node === undefined ? '' : node;
}

function setMockValue(groupName, fieldPath, value) {
  const parts = [groupName, ...fieldPath.split('.')];
  let node = mockStatData.value;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
  // 触发 watch 响应
  mockStatData.value = JSON.parse(JSON.stringify(mockStatData.value));
}

function resetStatData() {
  mockStatData.value = buildInitialMockData();
  appStore.toastSuccess('已重置为初始值');
}

const iframeSrcdoc = ref('');

function buildMockScript() {
  // 注入到 iframe 的 mock 全局环境（jQuery / lodash / Mvu / 事件总线 等）
  const initialData = JSON.stringify(mockStatData.value || {});
  return '<scr' + 'ipt>\n(function(){\n' +
    'function $$(sel){\n' +
    '  if(typeof sel==="function"){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",sel);}else{sel();}return;}\n' +
    '  const els=typeof sel==="string"?Array.from(document.querySelectorAll(sel)):(sel instanceof Element?[sel]:[]);\n' +
    '  const api={\n' +
    '    text:function(v){if(v===undefined)return els[0]?els[0].textContent:"";els.forEach(e=>e.textContent=v);return api;},\n' +
    '    html:function(v){if(v===undefined)return els[0]?els[0].innerHTML:"";els.forEach(e=>e.innerHTML=v);return api;},\n' +
    '    addClass:function(c){els.forEach(e=>e.classList.add(c));return api;},\n' +
    '    removeClass:function(c){els.forEach(e=>e.classList.remove(c));return api;},\n' +
    '    on:function(ev,selOrFn,handler){if(typeof selOrFn==="function"){handler=selOrFn;selOrFn=null;}els.forEach(e=>{if(selOrFn){e.addEventListener(ev,function(event){const t=event.target.closest(selOrFn);if(t&&e.contains(t))handler.call(t,event);});}else{e.addEventListener(ev,handler);}});return api;},\n' +
    '    data:function(k){return els[0]?els[0].dataset[k]:undefined;},\n' +
    '    attr:function(k,v){if(v===undefined)return els[0]?els[0].getAttribute(k):null;els.forEach(e=>e.setAttribute(k,v));return api;},\n' +
    '    val:function(v){if(v===undefined)return els[0]?els[0].value:"";els.forEach(e=>e.value=v);return api;},\n' +
    '    hide:function(){els.forEach(e=>e.style.display="none");return api;},\n' +
    '    show:function(){els.forEach(e=>e.style.display="");return api;},\n' +
    '    each:function(fn){els.forEach((e,i)=>fn.call(e,i,e));return api;},\n' +
    '    length:els.length\n' +
    '  };\n' +
    '  return api;\n' +
    '}\n' +
    'window.$=$$;window.jQuery=$$;\n' +
    'window._={\n' +
    '  get:function(obj,path,def){if(typeof path==="string")path=path.split(".");let n=obj;for(const p of path){if(n==null)return def;n=n[p];}return n===undefined?def:n;},\n' +
    '  set:function(obj,path,v){if(typeof path==="string")path=path.split(".");let n=obj;for(let i=0;i<path.length-1;i++){if(!n[path[i]]||typeof n[path[i]]!=="object")n[path[i]]={};n=n[path[i]];}n[path[path.length-1]]=v;return obj;},\n' +
    '  has:function(obj,path){if(typeof path==="string")path=path.split(".");let n=obj;for(const p of path){if(n==null||!(p in n))return false;n=n[p];}return true;},\n' +
    '  clamp:function(v,lo,hi){return Math.max(lo,Math.min(hi,v));},\n' +
    '  isEmpty:function(v){return v==null||(Array.isArray(v)&&v.length===0)||(typeof v==="object"&&Object.keys(v).length===0)||v==="";}\n' +
    '};\n' +
    'window.toastr={success:function(){console.info("[toastr.success]",...arguments);},info:function(){console.info("[toastr.info]",...arguments);},warning:function(){console.warn("[toastr.warning]",...arguments);},error:function(){console.error("[toastr.error]",...arguments);}};\n' +
    'window.waitGlobalInitialized=function(){return Promise.resolve();};\n' +
    'window.errorCatched=function(fn){return function(){try{return fn.apply(this,arguments);}catch(e){console.error("[errorCatched]",e);}};};\n' +
    'const _listeners={};\n' +
    'window.eventOn=function(ev,cb){if(!_listeners[ev])_listeners[ev]=[];_listeners[ev].push(cb);};\n' +
    'window.__triggerEvent=function(ev){const args=Array.prototype.slice.call(arguments,1);(_listeners[ev]||[]).forEach(cb=>{try{cb.apply(null,args);}catch(e){console.error(e);}});};\n' +
    'const VARIABLE_UPDATE_ENDED="mvu_mock_var_update_ended";\n' +
    'const VARIABLE_INITIALIZED="mvu_mock_var_initialized";\n' +
    'window.Mvu={events:{VARIABLE_UPDATE_ENDED:VARIABLE_UPDATE_ENDED,VARIABLE_INITIALIZED:VARIABLE_INITIALIZED}};\n' +
    'window.__mockStatData=' + initialData + ';\n' +
    'window.getAllVariables=function(){return{stat_data:window.__mockStatData};};\n' +
    'window.addEventListener("message",function(e){if(e.data&&e.data.type==="mockStatData:update"){window.__mockStatData=e.data.data;window.__triggerEvent(VARIABLE_UPDATE_ENDED);}});\n' +
    '})();\n' +
    '</scr' + 'ipt>';
}

function rebuildIframeSrcdoc() {
  if (!statusBarHtml.value) {
    iframeSrcdoc.value = '';
    return;
  }
  const mockScript = buildMockScript();
  let html = statusBarHtml.value;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1>' + mockScript);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html([^>]*)>/i, '<html$1><head>' + mockScript + '</head>');
  } else {
    html = '<!doctype html><html><head>' + mockScript + '</head><body>' + html + '</body></html>';
  }
  iframeSrcdoc.value = html;
}

const iframeRef = ref(null);

function onIframeLoad() {
  triggerIframeUpdate();
}

function triggerIframeUpdate() {
  const win = iframeRef.value && iframeRef.value.contentWindow;
  if (win) {
    win.postMessage({ type: 'mockStatData:update', data: JSON.parse(JSON.stringify(mockStatData.value)) }, '*');
  }
}

const snapshotKey = computed(() => {
  const name = cardStore.cardData?.name || 'unnamed';
  return 'cf_sandbox_snapshots_' + name;
});

const snapshots = ref([]);
const editingSnapshotId = ref(null);
const editingSnapshotName = ref('');

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(snapshotKey.value);
    snapshots.value = raw ? JSON.parse(raw) : [];
  } catch { snapshots.value = []; }
}

function persistSnapshots() {
  try { localStorage.setItem(snapshotKey.value, JSON.stringify(snapshots.value)); } catch {}
}

function saveSnapshot() {
  const snap = {
    id: 'snap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: '场景 ' + (snapshots.value.length + 1),
    data: JSON.parse(JSON.stringify(mockStatData.value)),
    createdAt: new Date().toISOString()
  };
  snapshots.value.push(snap);
  persistSnapshots();
  appStore.toastSuccess('已保存「' + snap.name + '」（双击按钮改名）');
}

function loadSnapshot(snap) {
  mockStatData.value = JSON.parse(JSON.stringify(snap.data));
  appStore.toastSuccess('已加载「' + snap.name + '」');
}

function startRenameSnapshot(snap) {
  editingSnapshotId.value = snap.id;
  editingSnapshotName.value = snap.name;
}

function confirmRenameSnapshot() {
  const snap = snapshots.value.find(s => s.id === editingSnapshotId.value);
  if (snap) {
    const n = editingSnapshotName.value.trim();
    if (n) snap.name = n;
    persistSnapshots();
  }
  editingSnapshotId.value = null;
  editingSnapshotName.value = '';
}

function cancelRenameSnapshot() {
  editingSnapshotId.value = null;
  editingSnapshotName.value = '';
}

function deleteSnapshot(id) {
  appStore.confirmAction('删除这个场景快照？', () => {
    snapshots.value = snapshots.value.filter(s => s.id !== id);
    persistSnapshots();
    appStore.toastSuccess('已删除');
  });
}

watch(statusBarHtml, rebuildIframeSrcdoc);
watch(mockStatData, () => triggerIframeUpdate(), { deep: true });
watch(() => cardStore.cardData?.name, () => {
  mockStatData.value = buildInitialMockData();
  loadSnapshots();
  rebuildIframeSrcdoc();
});

onMounted(() => {
  mockStatData.value = buildInitialMockData();
  loadSnapshots();
  rebuildIframeSrcdoc();
});
</script>

<style scoped>
.sandbox-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.sandbox-pane--left { min-width: 0; }
.sandbox-pane--right { min-width: 0; position: sticky; top: 16px; align-self: start; }
.sandbox-iframe {
  width: 100%;
  min-height: 600px;
  border: 0;
  background: var(--cf-bg-elevated, #181a23);
  border-radius: 8px;
}
@media (max-width: 1000px) {
  .sandbox-layout { grid-template-columns: 1fr; }
  .sandbox-pane--right { position: static; }
}
</style>

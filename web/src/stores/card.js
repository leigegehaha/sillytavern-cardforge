import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAppStore } from './app.js';
import { readPngCardData, writePngCardData } from '../utils/png-utils.js';

const AUTOSAVE_KEY = 'cardforge_autosave';
const AUTOSAVE_COVER_KEY = 'cardforge_autosave_cover';
const AUTOSAVE_NAME_KEY = 'cardforge_autosave_name';
const AUTOSAVE_DEBOUNCE = 3000;

function createEmptyCard() {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      tags: [],
      creator: '',
      character_version: '',
      alternate_greetings: [],
      extensions: {
        talkativeness: '0.5',
        fav: false,
        world: '',
        depth_prompt: { prompt: '', depth: 4, role: 'system' },
        regex_scripts: [],
        tavern_helper: { scripts: [], variables: {} }
      },
      group_only_greetings: [],
      character_book: {
        entries: [],
        name: ''
      }
    }
  };
}

function createEmptyWorldEntry(id = 0) {
  return {
    id,
    keys: [],
    secondary_keys: [],
    comment: '',
    content: '',
    constant: false,
    selective: true,
    order: 100,
    position: 0,
    enabled: true,
    insertion_order: 100,
    extensions: {
      position: 0,
      exclude_recursion: false,
      display_index: id,
      probability: 100,
      useProbability: true,
      depth: 4,
      selectiveLogic: 0,
      group: '',
      group_override: false,
      group_weight: 100,
      prevent_recursion: false,
      delay_until_recursion: false,
      scan_depth: null,
      match_whole_words: null,
      use_group_scoring: false,
      case_sensitive: null,
      automation_id: '',
      role: 0,
      vectorized: false,
      sticky: null,
      cooldown: null,
      delay: null
    }
  };
}

function createEmptyRegexScript() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    scriptName: '',
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [1],
    disabled: false,
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: true,
    minDepth: null,
    maxDepth: null
  };
}

function createEmptyTavernScript() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: '',
    content: '',
    info: '',
    enabled: true,
    button: null
  };
}

export const useCardStore = defineStore('card', () => {
  const card = ref(createEmptyCard());
  const isDirty = ref(false);
  const fileName = ref('');
  const coverImageBase64 = ref('');

  const cardData = computed(() => card.value.data);
  const worldEntries = computed(() => card.value.data.character_book?.entries || []);
  const regexScripts = computed(() => card.value.data.extensions?.regex_scripts || []);
  const tavernScripts = computed(() => {
    const helper = card.value.data.extensions?.tavern_helper;
    if (!helper) return [];
    const scripts = Array.isArray(helper.scripts) ? helper.scripts : [];
    for (const s of scripts) {
      if (!s.button) s.button = { enabled: false, buttons: [] };
      if (!Array.isArray(s.button.buttons)) s.button.buttons = [];
    }
    return scripts;
  });
  const cardName = computed(() => card.value.data.name || fileName.value || '');

  function newCard() {
    card.value = createEmptyCard();
    isDirty.value = false;
    fileName.value = '';
    coverImageBase64.value = '';
  }

  function loadFromJson(json, name = '') {
    // V2 spec
    if (json.data) {
      card.value = json;
    } else {
      // V1 fallback
      const v2 = createEmptyCard();
      Object.assign(v2.data, json);
      card.value = v2;
    }
    // ensure extensions
    if (!card.value.data.extensions) card.value.data.extensions = {};
    if (!card.value.data.extensions.regex_scripts) card.value.data.extensions.regex_scripts = [];
    if (!card.value.data.extensions.tavern_helper) card.value.data.extensions.tavern_helper = { scripts: [], variables: {} };
    if (!card.value.data.character_book) card.value.data.character_book = { entries: [], name: '' };
    if (!card.value.data.alternate_greetings) card.value.data.alternate_greetings = [];
    if (!card.value.data.extensions.depth_prompt) {
      card.value.data.extensions.depth_prompt = { prompt: '', depth: 4, role: 'system' };
    }

    // assign cfSortKey to world entries
    const entries = card.value.data.character_book.entries;
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].extensions) entries[i].extensions = {};
      if (entries[i].extensions.cfSortKey === undefined) {
        entries[i].extensions.cfSortKey = i + 1;
      }
    }

    fileName.value = name;
    isDirty.value = false;
  }

  function exportJson() {
    const json = JSON.parse(JSON.stringify(card.value));
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const name = (card.value.data.name || 'character') + '.json';
    downloadBlob(blob, name);
  }

  async function importFromFile() {
    const appStore = useAppStore();
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png,.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          if (file.name.endsWith('.json')) {
            const text = await file.text();
            const json = JSON.parse(text);
            loadFromJson(json, file.name.replace('.json', ''));
            appStore.toastSuccess('JSON 导入成功');
          } else if (file.name.endsWith('.png')) {
            const buffer = await file.arrayBuffer();
            const { cardData: data, imageBase64 } = await readPngCardData(buffer);
            if (data) {
              loadFromJson(data, file.name.replace('.png', ''));
              coverImageBase64.value = imageBase64 || '';
              appStore.toastSuccess('PNG 导入成功');
            } else {
              // 普通PNG图片，创建空白卡并设为封面
              newCard();
              coverImageBase64.value = imageBase64 || '';
              fileName.value = file.name.replace('.png', '');
              appStore.toastSuccess('已导入为封面图片，创建了空白角色卡');
            }
          }
        } catch (err) {
          appStore.toastError('导入失败: ' + err.message);
        }
      };
      input.click();
    } catch (err) {
      useAppStore().toastError('导入失败: ' + err.message);
    }
  }

  async function exportPng() {
    const appStore = useAppStore();
    if (!coverImageBase64.value) {
      appStore.toastError('没有封面图片，请先导入一张 PNG 角色卡或使用 JSON 导出');
      return;
    }
    try {
      const json = JSON.parse(JSON.stringify(card.value));
      const pngBuffer = await writePngCardData(coverImageBase64.value, json);
      const blob = new Blob([pngBuffer], { type: 'image/png' });
      const name = (card.value.data.name || 'character') + '.png';
      downloadBlob(blob, name);
      appStore.toastSuccess('PNG 导出成功');
    } catch (err) {
      appStore.toastError('PNG 导出失败: ' + err.message);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function markDirty() {
    isDirty.value = true;
  }

  // --- Auto-save to localStorage ---
  let autosaveTimer = null;
  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        const json = JSON.stringify(card.value);
        localStorage.setItem(AUTOSAVE_KEY, json);
        localStorage.setItem(AUTOSAVE_NAME_KEY, fileName.value || '');
        // Cover image: try to save, skip if too large
        if (coverImageBase64.value) {
          try {
            localStorage.setItem(AUTOSAVE_COVER_KEY, coverImageBase64.value);
          } catch (_) {
            localStorage.removeItem(AUTOSAVE_COVER_KEY);
          }
        } else {
          localStorage.removeItem(AUTOSAVE_COVER_KEY);
        }
      } catch (_) {
        // localStorage full or unavailable, silently skip
      }
    }, AUTOSAVE_DEBOUNCE);
  }

  function hasAutosave() {
    return !!localStorage.getItem(AUTOSAVE_KEY);
  }

  function restoreAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const json = JSON.parse(raw);
      loadFromJson(json, localStorage.getItem(AUTOSAVE_NAME_KEY) || '');
      const cover = localStorage.getItem(AUTOSAVE_COVER_KEY);
      if (cover) coverImageBase64.value = cover;
      clearAutosave();
      isDirty.value = true;
      return true;
    } catch (_) {
      clearAutosave();
      return false;
    }
  }

  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(AUTOSAVE_COVER_KEY);
    localStorage.removeItem(AUTOSAVE_NAME_KEY);
  }

  // Watch for changes and auto-save
  watch([card, coverImageBase64, fileName], () => {
    if (isDirty.value) scheduleAutosave();
  }, { deep: true });

  // World book operations
  function addWorldEntry(entry = null) {
    const entries = card.value.data.character_book.entries;
    const maxId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 0;
    const newEntry = entry || createEmptyWorldEntry(maxId);
    newEntry.id = maxId;
    if (!newEntry.extensions) newEntry.extensions = {};
    const maxKey = entries.length > 0
      ? Math.max(0, ...entries.map(e => e.extensions?.cfSortKey ?? 0))
      : 0;
    newEntry.extensions.cfSortKey = maxKey + 1;
    entries.push(newEntry);
    markDirty();
    return newEntry;
  }

  function removeWorldEntry(id) {
    const entries = card.value.data.character_book.entries;
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) { entries.splice(idx, 1); markDirty(); }
  }

  function duplicateWorldEntry(id) {
    const entries = card.value.data.character_book.entries;
    const source = entries.find(e => e.id === id);
    if (source) {
      const clone = JSON.parse(JSON.stringify(source));
      clone.comment = (clone.comment || '') + ' (副本)';
      addWorldEntry(clone);
    }
  }

  // Regex operations
  function addRegexScript(script = null) {
    const scripts = card.value.data.extensions.regex_scripts;
    scripts.push(script || createEmptyRegexScript());
    markDirty();
  }

  function removeRegexScript(id) {
    const scripts = card.value.data.extensions.regex_scripts;
    const idx = scripts.findIndex(s => s.id === id);
    if (idx !== -1) { scripts.splice(idx, 1); markDirty(); }
  }

  // Tavern script operations
  function addTavernScript(script = null) {
    const helper = card.value.data.extensions.tavern_helper;
    if (!helper.scripts) helper.scripts = [];
    helper.scripts.push(script || createEmptyTavernScript());
    markDirty();
  }

  function removeTavernScript(id) {
    const helper = card.value.data.extensions.tavern_helper;
    const idx = helper.scripts.findIndex(s => s.id === id);
    if (idx !== -1) { helper.scripts.splice(idx, 1); markDirty(); }
  }

  // Greeting operations
  function addGreeting(text = '') {
    if (!card.value.data.alternate_greetings) card.value.data.alternate_greetings = [];
    card.value.data.alternate_greetings.push(text);
    markDirty();
  }

  function removeGreeting(index) {
    card.value.data.alternate_greetings.splice(index, 1);
    markDirty();
  }

  const stats = computed(() => {
    const entries = worldEntries.value;
    const enabledEntries = entries.filter(e => e.enabled).length;
    const constantEntries = entries.filter(e => e.constant && e.enabled);
    return {
      totalEntries: entries.length,
      enabledEntries,
      constantEntries: constantEntries.length,
      disabledEntries: entries.length - enabledEntries,
      regexCount: regexScripts.value.length,
      scriptCount: tavernScripts.value.length,
      alternateGreetings: card.value.data.alternate_greetings?.length || 0,
    };
  });

  return {
    card, isDirty, fileName, coverImageBase64,
    cardData, worldEntries, regexScripts, tavernScripts, cardName, stats,
    newCard, loadFromJson, exportJson, exportPng, importFromFile, markDirty,
    addWorldEntry, removeWorldEntry, duplicateWorldEntry,
    addRegexScript, removeRegexScript,
    addTavernScript, removeTavernScript,
    addGreeting, removeGreeting,
    createEmptyWorldEntry, createEmptyRegexScript, createEmptyTavernScript,
    hasAutosave, restoreAutosave, clearAutosave
  };
});

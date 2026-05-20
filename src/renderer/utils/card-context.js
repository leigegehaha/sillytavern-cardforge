/**
 * 构建当前角色卡的上下文摘要，供 AI 生成功能使用
 * 所有 AI 功能调用前都应该附带这个上下文
 *
 * @param {*} cardStore - 角色卡 store
 * @param {string} [matchText] - 可选。传入文本后，绿灯条目按主 keys 关键词匹配
 *   (命中的才塞)；不传则按前 20 条无脑塞（旧逻辑，保持向后兼容）
 */
export function buildCardContext(cardStore, matchText = '') {
  const d = cardStore.cardData;
  const entries = cardStore.worldEntries;
  const regexScripts = cardStore.regexScripts;
  const scripts = cardStore.tavernScripts;

  const useMatch = typeof matchText === 'string' && matchText.trim().length > 0;
  const MAX_TOTAL_CHARS = 12000;
  const PER_ENTRY_CHARS = useMatch ? 1000 : 400;

  const lines = [];

  if (d.name) lines.push(`角色名：${d.name}`);
  if (d.personality) lines.push(`性格：${d.personality}`);
  if (d.scenario) lines.push(`场景设定：${d.scenario}`);
  if (d.description) lines.push(`角色描述（前500字）：${d.description.slice(0, 500)}`);
  if (d.first_mes) lines.push(`开场白（前1000字）：${d.first_mes.slice(0, 1000)}`);

  if (entries.length > 0) {
    const enabled = entries.filter(e => e.enabled);
    const constant = enabled.filter(e => e.constant);
    const triggered = enabled.filter(e => !e.constant);

    lines.push(`\n========== 世界书内容（${entries.length} 条，启用 ${enabled.length}）==========`);

    let worldBudget = MAX_TOTAL_CHARS;

    if (constant.length > 0) {
      lines.push(`\n--- 常驻设定（${constant.length} 条，蓝灯）---`);
      let written = 0;
      for (const e of constant) {
        if (worldBudget <= 0) {
          lines.push(`...世界书超字数上限 ${MAX_TOTAL_CHARS}，剩余 ${constant.length - written} 条蓝灯未展示`);
          break;
        }
        const c = (e.content || '').slice(0, PER_ENTRY_CHARS);
        const block = `【${e.comment || '(未命名)'}】 keys:[${(e.keys || []).join(',')}]\n${c}${(e.content || '').length > PER_ENTRY_CHARS ? '...' : ''}`;
        lines.push(block);
        worldBudget -= block.length;
        written++;
      }
    }

    if (triggered.length > 0) {
      if (useMatch) {
        const matchLower = matchText.toLowerCase();
        const matched = triggered.filter(e => {
          const keys = e.keys || [];
          return keys.some(k => k && matchLower.includes(String(k).toLowerCase()));
        });
        if (matched.length > 0) {
          lines.push(`\n--- 关键词触发（${matched.length} 条命中 / ${triggered.length} 条绿灯）---`);
          let written = 0;
          for (const e of matched) {
            if (worldBudget <= 0) {
              lines.push(`...世界书超字数上限，剩余 ${matched.length - written} 条命中未展示`);
              break;
            }
            const c = (e.content || '').slice(0, PER_ENTRY_CHARS);
            const block = `【${e.comment || '(未命名)'}】 keys:[${(e.keys || []).join(',')}]\n${c}${(e.content || '').length > PER_ENTRY_CHARS ? '...' : ''}`;
            lines.push(block);
            worldBudget -= block.length;
            written++;
          }
        } else {
          lines.push(`\n--- 关键词触发：${triggered.length} 条绿灯均未命中当前输入的关键词 ---`);
        }
      } else {
        const showCount = Math.min(20, triggered.length);
        lines.push(`\n--- 关键词触发（${triggered.length} 条，展示前 ${showCount}）---`);
        for (const e of triggered.slice(0, showCount)) {
          const c = (e.content || '').slice(0, 150);
          lines.push(`【${e.comment || '(未命名)'}】 keys:[${(e.keys || []).join(',')}]\n${c}${(e.content || '').length > 150 ? '...' : ''}`);
        }
        if (triggered.length > showCount) {
          lines.push(`...还有 ${triggered.length - showCount} 条触发条目未展示`);
        }
      }
    }
  }

  if (regexScripts.length > 0) {
    lines.push(`\n已有正则脚本：${regexScripts.length} 个`);
    regexScripts.slice(0, 5).forEach(r => {
      lines.push(`- ${r.scriptName} [${r.markdownOnly ? 'markdownOnly' : r.promptOnly ? 'promptOnly' : '双层'}]`);
    });
  }

  if (scripts.length > 0) {
    lines.push(`\n已有酒馆助手脚本：${scripts.length} 个`);
    scripts.slice(0, 5).forEach(s => {
      lines.push(`- ${s.name} [${s.enabled ? '启用' : '禁用'}]`);
    });
  }

  return lines.join('\n');
}

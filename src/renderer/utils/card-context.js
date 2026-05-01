/**
 * 构建当前角色卡的上下文摘要，供 AI 生成功能使用
 * 所有 AI 功能调用前都应该附带这个上下文
 */
export function buildCardContext(cardStore) {
  const d = cardStore.cardData;
  const entries = cardStore.worldEntries;
  const regexScripts = cardStore.regexScripts;
  const scripts = cardStore.tavernScripts;

  const lines = [];

  // 基本信息
  if (d.name) lines.push(`角色名：${d.name}`);
  if (d.personality) lines.push(`性格：${d.personality}`);
  if (d.scenario) lines.push(`场景设定：${d.scenario}`);
  if (d.description) lines.push(`角色描述（前500字）：${d.description.slice(0, 500)}`);
  if (d.first_mes) lines.push(`开场白（前1000字）：${d.first_mes.slice(0, 1000)}`);

  // 世界书 —— 真读 content 而不只是目录
  if (entries.length > 0) {
    const enabled = entries.filter(e => e.enabled);
    const constant = enabled.filter(e => e.constant);
    const triggered = enabled.filter(e => !e.constant);

    lines.push(`\n========== 世界书内容（${entries.length} 条，启用 ${enabled.length}）==========`);

    // 常驻条目：完整内容（截断到 400 字），AI 会一直看到，必须给完整
    if (constant.length > 0) {
      lines.push(`\n--- 常驻设定（${constant.length} 条）---`);
      for (const e of constant) {
        const c = (e.content || '').slice(0, 400);
        lines.push(`【${e.comment || '(未命名)'}】 keys:[${(e.keys || []).join(',')}]\n${c}${(e.content || '').length > 400 ? '...' : ''}`);
      }
    }

    // 触发条目：前 20 条，content 前 150 字摘要
    if (triggered.length > 0) {
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

  // 正则脚本
  if (regexScripts.length > 0) {
    lines.push(`\n已有正则脚本：${regexScripts.length} 个`);
    regexScripts.slice(0, 5).forEach(r => {
      lines.push(`- ${r.scriptName} [${r.markdownOnly ? 'markdownOnly' : r.promptOnly ? 'promptOnly' : '双层'}]`);
    });
  }

  // 酒馆助手脚本
  if (scripts.length > 0) {
    lines.push(`\n已有酒馆助手脚本：${scripts.length} 个`);
    scripts.slice(0, 5).forEach(s => {
      lines.push(`- ${s.name} [${s.enabled ? '启用' : '禁用'}]`);
    });
  }

  return lines.join('\n');
}

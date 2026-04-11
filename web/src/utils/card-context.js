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
  if (d.description) lines.push(`角色描述（前300字）：${d.description.slice(0, 300)}`);

  // 世界书条目摘要
  if (entries.length > 0) {
    lines.push(`\n已有世界书：${entries.length} 条`);
    const enabled = entries.filter(e => e.enabled);
    const constant = entries.filter(e => e.constant && e.enabled);
    lines.push(`（启用 ${enabled.length} / 常驻 ${constant.length}）`);

    // 列出前15条条目名和关键词
    const summary = entries.slice(0, 15).map(e => {
      const type = e.constant ? '常驻' : e.enabled ? '触发' : '禁用';
      return `[${type}] ${e.comment || '(未命名)'} keys:[${(e.keys || []).join(',')}]`;
    }).join('\n');
    lines.push(summary);
    if (entries.length > 15) lines.push(`...还有 ${entries.length - 15} 条`);
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

  // 开场白
  if (d.first_mes) {
    lines.push(`\n开场白（前200字）：${d.first_mes.slice(0, 200)}`);
  }

  return lines.join('\n');
}

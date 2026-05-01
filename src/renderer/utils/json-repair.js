/**
 * 调用 AI 并解析返回的 JSON 数组，失败自动重试。
 * @param {object} apiStore - API store 实例
 * @param {Array} messages - chat messages
 * @param {object} options - chat options (temperature, maxTokens 等)
 * @param {number} maxRetries - 最大重试次数（默认2次，即总共最多3次）
 * @returns {Promise<Array>} 解析后的数组
 */
export async function chatForJsonArray(apiStore, messages, options = {}, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiStore.chat(messages, options);
      return parseAiJsonArray(result);
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) continue;
    }
  }
  throw lastErr;
}

/**
 * 从 AI 返回的文本中提取并修复 JSON 数组。
 * 处理常见 AI 输出问题：markdown 代码块、注释、尾逗号、智能引号、字符串内未转义引号等。
 * @param {string} raw - AI 返回的原始文本
 * @returns {Array} 解析后的数组
 */
export function parseAiJsonArray(raw) {
  // 1. 去掉 markdown 代码块包裹
  let text = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/\/\/[^\n]*/g, '')        // 单行注释
    .replace(/\/\*[\s\S]*?\*\//g, ''); // 多行注释

  // 2. 提取最外层 [ ... ]，支持截断修复
  let match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    // 可能 JSON 被截断，没有闭合的 ]
    const openBracket = text.indexOf('[');
    if (openBracket !== -1) {
      // 尝试补全：截断到最后一个完整的 }，然后补 ]
      let truncated = text.slice(openBracket);
      const lastBrace = truncated.lastIndexOf('}');
      if (lastBrace !== -1) {
        truncated = truncated.slice(0, lastBrace + 1);
        // 去掉末尾可能的逗号
        truncated = truncated.replace(/,\s*$/, '');
        truncated += ']';
        match = [truncated];
      }
    }
    if (!match) throw new Error('AI 返回格式异常，未找到 JSON 数组');
  }

  let jsonStr = match[0];

  // 3. 基本清洗
  jsonStr = jsonStr
    .replace(/,\s*([}\]])/g, '$1')     // 尾逗号
    .replace(/[\u201c\u201d]/g, '"')   // 中文双引号
    .replace(/[\u2018\u2019]/g, "'")   // 中文单引号
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // 非法控制字符（保留 \n \r \t）

  // 4. 多轮尝试解析
  // 截断兜底：从结尾往前找最后一个完整 } ，截到那里 + 补 ]，让被 token 截掉的最后一条对象不污染前面所有完整对象
  const trimToLastObject = (s) => {
    const open = s.indexOf('[');
    if (open === -1) return s;
    let body = s.slice(open);
    const lastBrace = body.lastIndexOf('}');
    if (lastBrace === -1) return s;
    body = body.slice(0, lastBrace + 1).replace(/,\s*$/, '') + ']';
    return body;
  };

  const attempts = [
    () => jsonStr,
    () => escapeNewlinesInStrings(jsonStr),
    () => jsonStr.replace(/[\r\n]+/g, ' '),
    () => repairUnescapedQuotes(jsonStr.replace(/[\r\n]+/g, ' ')),
    () => trimToLastObject(repairUnescapedQuotes(jsonStr.replace(/[\r\n]+/g, ' '))),
    () => trimToLastObject(jsonStr),
  ];

  let lastErr;
  let lastAttemptStr = jsonStr;
  for (const attempt of attempts) {
    try {
      const s = attempt();
      lastAttemptStr = s;
      return JSON.parse(s);
    } catch (e) {
      lastErr = e;
    }
  }

  // 把出错位置前后 50 字符 + raw 前 200 字符带上，方便排查
  let contextHint = '';
  const posMatch = lastErr.message.match(/position (\d+)/);
  if (posMatch) {
    const pos = parseInt(posMatch[1]);
    const start = Math.max(0, pos - 50);
    const end = Math.min(lastAttemptStr.length, pos + 50);
    contextHint = ` | 出错附近: "...${lastAttemptStr.slice(start, pos)}【ERR→】${lastAttemptStr.slice(pos, end)}..."`;
  }
  const rawHint = ' | 原始输出前200字: ' + String(raw || '').slice(0, 200).replace(/\s+/g, ' ');
  throw new Error('AI 返回的 JSON 格式无法解析: ' + lastErr.message + contextHint + rawHint);
}

/** 转义 JSON 字符串值内部的原始换行符 */
function escapeNewlinesInStrings(str) {
  return str.replace(/"(?:[^"\\]|\\.)*"/g, m =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  );
}

/**
 * 状态机修复：区分 key 和 value 字符串，正确处理未转义引号。
 * key 字符串：出现在 { 或 , 之后，以 ": 结束
 * value 字符串：出现在 : 之后，以 ", 或 "} 或 "] 结束
 * 只有 value 字符串内部才可能有杂散引号需要转义
 */
function repairUnescapedQuotes(str) {
  const chars = [...str];
  const out = [];
  let inString = false;
  let isKeyString = false;
  // 维护括号栈：栈顶 '[' 时当前在数组内，栈顶 '{' 时在对象内
  // 数组里的字符串永远是 value；对象里看前一个非空白判断 key/value
  const bracketStack = [];
  let i = 0;

  function prevNonSpaceFromOut(skipFromEnd) {
    for (let k = out.length - skipFromEnd; k >= 0; k--) {
      const c = out[k];
      if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') return c;
    }
    return '';
  }

  while (i < chars.length) {
    const ch = chars[i];

    if (!inString) {
      out.push(ch);
      if (ch === '{' || ch === '[') {
        bracketStack.push(ch);
      } else if (ch === '}' || ch === ']') {
        bracketStack.pop();
      } else if (ch === '"') {
        inString = true;
        const top = bracketStack[bracketStack.length - 1];
        if (top === '[') {
          isKeyString = false;
        } else {
          // out 末位是刚 push 的 "，所以从 length-2 开始找前一个非空白
          const prev2 = prevNonSpaceFromOut(2);
          isKeyString = (prev2 === '{' || prev2 === ',');
        }
      }
      i++;
      continue;
    }

    if (ch === '\\') {
      out.push(ch);
      i++;
      if (i < chars.length) { out.push(chars[i]); i++; }
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < chars.length && (chars[j] === ' ' || chars[j] === '\t' || chars[j] === '\n' || chars[j] === '\r')) j++;
      const next = chars[j];

      if (isKeyString) {
        if (next === ':') {
          out.push('"');
          inString = false;
        } else {
          out.push('\\"');
        }
      } else {
        if (next === ',' || next === '}' || next === ']' || next === undefined) {
          out.push('"');
          inString = false;
        } else {
          out.push('\\"');
        }
      }
      i++;
      continue;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

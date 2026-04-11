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

  // 2. 提取最外层 [ ... ]
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI 返回格式异常，未找到 JSON 数组');

  let jsonStr = match[0];

  // 3. 基本清洗
  jsonStr = jsonStr
    .replace(/,\s*([}\]])/g, '$1')     // 尾逗号
    .replace(/[\u201c\u201d]/g, '"')   // 中文双引号
    .replace(/[\u2018\u2019]/g, "'")   // 中文单引号
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // 非法控制字符（保留 \n \r \t）

  // 4. 多轮尝试解析
  const attempts = [
    () => jsonStr,
    () => escapeNewlinesInStrings(jsonStr),
    () => jsonStr.replace(/[\r\n]+/g, ' '),
    () => repairUnescapedQuotes(jsonStr.replace(/[\r\n]+/g, ' ')),
  ];

  let lastErr;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt());
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('AI 返回的 JSON 格式无法解析: ' + lastErr.message);
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
  let isKeyString = false; // 当前字符串是 key 还是 value
  let i = 0;

  // 找到当前位置之前最后一个非空白字符
  function lastNonSpace() {
    for (let k = out.length - 1; k >= 0; k--) {
      if (out[k] !== ' ' && out[k] !== '\t') return out[k];
    }
    return '';
  }

  while (i < chars.length) {
    const ch = chars[i];

    if (!inString) {
      out.push(ch);
      if (ch === '"') {
        inString = true;
        // 判断这是 key 还是 value：
        // key 出现在 [ { , 之后；value 出现在 : 之后
        const prev = lastNonSpace();
        // 注意：lastNonSpace 返回的是 push 当前 " 之前的最后一个非空白字符
        // 但我们刚 push 了 "，所以要看倒数第二个非空白
        let prev2 = '';
        for (let k = out.length - 2; k >= 0; k--) {
          if (out[k] !== ' ' && out[k] !== '\t') { prev2 = out[k]; break; }
        }
        isKeyString = (prev2 === '{' || prev2 === ',' || prev2 === '[');
      }
      i++;
      continue;
    }

    // 在字符串内部
    if (ch === '\\') {
      out.push(ch);
      i++;
      if (i < chars.length) { out.push(chars[i]); i++; }
      continue;
    }

    if (ch === '"') {
      // 看后面跳过空白后的第一个字符
      let j = i + 1;
      while (j < chars.length && (chars[j] === ' ' || chars[j] === '\t')) j++;
      const next = chars[j];

      if (isKeyString) {
        // key 字符串：只有后面跟 : 才是正常结束
        if (next === ':') {
          out.push('"');
          inString = false;
        } else {
          out.push('\\"');
        }
      } else {
        // value 字符串：后面跟 , } ] 才是正常结束
        // 不允许 : 作为结束标志（value 内容可能包含冒号）
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

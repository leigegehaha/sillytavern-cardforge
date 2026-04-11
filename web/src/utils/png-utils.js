/**
 * 浏览器端 PNG 角色卡读写工具
 * 不依赖 Node.js，纯浏览器 API 实现
 */

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * 从 PNG ArrayBuffer 读取角色卡数据
 */
export async function readPngCardData(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const chunks = extractChunks(data);

  // 提取封面图片 base64
  const imageBase64 = arrayBufferToBase64(arrayBuffer);

  // 查找 tEXt chunk 中的 chara 数据
  for (const chunk of chunks) {
    if (chunk.type === 'tEXt') {
      const sepIdx = chunk.data.indexOf(0);
      if (sepIdx === -1) continue;
      const keyword = uint8ArrayToString(chunk.data.slice(0, sepIdx));
      if (keyword === 'chara') {
        const value = uint8ArrayToString(chunk.data.slice(sepIdx + 1));
        try {
          const json = JSON.parse(atob(value));
          return { cardData: json, imageBase64: 'data:image/png;base64,' + imageBase64 };
        } catch (e) {
          console.error('Failed to parse chara data:', e);
        }
      }
    }
  }

  return { cardData: null, imageBase64: null };
}

/**
 * 将角色卡数据写入 PNG
 */
export async function writePngCardData(imageBase64, cardJson) {
  // base64 转 ArrayBuffer
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const chunks = extractChunks(bytes);

  // 移除已有的 chara tEXt chunk
  const filtered = chunks.filter(c => {
    if (c.type !== 'tEXt') return true;
    const sepIdx = c.data.indexOf(0);
    if (sepIdx === -1) return true;
    const keyword = uint8ArrayToString(c.data.slice(0, sepIdx));
    return keyword !== 'chara';
  });

  // 创建新的 chara tEXt chunk
  const jsonStr = JSON.stringify(cardJson);
  const base64Value = btoa(unescape(encodeURIComponent(jsonStr)));
  const keyword = stringToUint8Array('chara');
  const value = stringToUint8Array(base64Value);
  const charaData = new Uint8Array(keyword.length + 1 + value.length);
  charaData.set(keyword, 0);
  charaData[keyword.length] = 0; // null separator
  charaData.set(value, keyword.length + 1);

  // 在 IEND 之前插入
  const iendIdx = filtered.findIndex(c => c.type === 'IEND');
  const charaChunk = { type: 'tEXt', data: charaData };
  if (iendIdx !== -1) {
    filtered.splice(iendIdx, 0, charaChunk);
  } else {
    filtered.push(charaChunk);
  }

  return encodeChunks(filtered);
}

/** 从 PNG 二进制中提取所有 chunk */
function extractChunks(data) {
  const chunks = [];
  let offset = 8; // skip PNG signature

  while (offset < data.length) {
    const length = readUint32(data, offset);
    const type = uint8ArrayToString(data.slice(offset + 4, offset + 8));
    const chunkData = data.slice(offset + 8, offset + 8 + length);
    const crc = readUint32(data, offset + 8 + length);
    chunks.push({ type, data: chunkData, crc });
    offset += 12 + length;
  }

  return chunks;
}

/** 将 chunk 列表编码为 PNG 二进制 */
function encodeChunks(chunks) {
  const parts = [PNG_SIGNATURE];

  for (const chunk of chunks) {
    const typeBytes = stringToUint8Array(chunk.type);
    const lengthBytes = writeUint32(chunk.data.length);
    const crcInput = new Uint8Array(4 + chunk.data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(chunk.data, 4);
    const crcBytes = writeUint32(crc32(crcInput));

    parts.push(lengthBytes, typeBytes, chunk.data, crcBytes);
  }

  // 合并所有部分
  let totalLength = 0;
  for (const p of parts) totalLength += p.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }

  return result.buffer;
}

function readUint32(data, offset) {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

function writeUint32(value) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ]);
}

function uint8ArrayToString(arr) {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return s;
}

function stringToUint8Array(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** CRC32 计算 */
const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

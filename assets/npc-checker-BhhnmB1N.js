var e=[{type:`模糊词`,pattern:/似乎|几乎|仿佛|宛如|好像/g,suggest:`改成具体描写，不要含糊其辞`},{type:`八股微表情`,pattern:/嘴角(?:微微)?上扬|眼[里中](?:闪过|涌起)一?丝|指尖(?:微微)?(?:泛白|颤抖)|眉头(?:微微)?(?:一皱|蹙起)/g,suggest:`改成自然动作（"她笑了""她皱眉"足矣）`},{type:`语气描写`,pattern:/带着[一-龥]{1,4}的口吻|用[一-龥]{1,4}的语气|充满[一-龥]{1,4}的味道/g,suggest:`删除——让对话本身说话，不要解说语气`},{type:`极端情绪词`,pattern:/陷入极大的[一-龥]{1,5}|极度(?:羞耻|恐惧|愤怒|悲伤|震惊)|万念俱灰/g,suggest:`改成具体行为或环境反应`},{type:`否定转折句`,pattern:/不是[一-龥]{1,15}而是[一-龥]{1,15}/g,suggest:`改成直接陈述，不用"不是A而是B"句式`},{type:`性格标签化`,pattern:/[她他]很(?:温柔|善良|坚强|聪明|开朗|内向|傲娇|腹黑|温暖|冷漠|可爱|漂亮)/g,suggest:`改成具体行为（如"会带受伤小动物回家"代替"她很温柔"）`},{type:`万能美人描写`,pattern:/精致的(?:脸蛋|五官|轮廓|下颚)|白皙的(?:皮肤|肌肤)|桃花眼|柳叶眉|樱桃[嘴小]口|肌肤胜雪|沉鱼落雁|倾国倾城/g,suggest:`只写偏离 AI 默认认知的特征，禁止万能美人模板`},{type:`陈旧比喻`,pattern:/像(?:小兽|小兔子|惊弓之鸟|受惊的[一-龥]{1,3})|投石入湖|心湖泛起涟漪|心如刀绞/g,suggest:`改成直接描述，不用陈词滥调比喻`}],t=`重要：所有 JSON 字符串内部如果要引用别名、称号或直接引语，必须使用中文引号「」『』《》，禁止使用英文双引号 " "（会破坏 JSON 解析导致报错）。`,n=`## NPC 写作铁律（必须严格遵守）

### 一、绝对零度 + 白描手法
- 客观叙述，不带主观判断（禁止"她真的很可爱""他实在太帅了"这种作者评价）
- 用具体行为代替抽象描述："她很温柔" ✗ → "遇到受伤的小动物会带回家照顾" ✓
- 用语料展现性格：让对话本身说话，禁止"温柔地说""带着不耐烦的口吻"
- 不堆砌无意义形容词

### 二、八股化禁令(出现一处即视为不合格)
禁止使用：
- 模糊词：似乎、几乎、仿佛、宛如、好像
- 陈旧比喻：像小兽、像小兔子、投石入湖、心湖泛起涟漪
- 八股微表情：嘴角微微上扬、眼里闪过一丝XX、指尖微微泛白、眉头微微一皱
- 语气描写：带着xx的口吻、用xx的语气、充满xx的味道
- 极端情绪词：陷入极大的恐惧、极度羞耻、万念俱灰
- 否定转折句：不是...而是...
- 性格标签化："她很温柔""他很善良""她很可爱"

### 三、外貌特征差异化原则
**只写"偏离 AI 数据库默认认知"的特征：**
- 中国角色不写"黑发黑瞳"（默认就是）
- 18 岁不写"年轻"（默认就是）
- 精灵不写"尖耳"（默认就是）
**禁止万能美人描写：** 精致的脸蛋、白皙的皮肤、桃花眼、柳叶眉、樱桃小口
**测试标准：** 遮住名字看你写的特征，能不能认出这个角色——能就对了

### 四、NPC 简化原则（NPC 专属）
NPC 是功能性角色，跟主角不一样：
- 不需要完整人生年表
- 不需要大段背景故事
- 不需要详细内心世界
- **关系定位是 NPC 最重要的部分**——围绕"NPC 跟主角的关系/互动方式/作用"写
`,r=`请扮演 SillyTavern 写卡审查专家，对以下 NPC 设定逐项检查并修正：

【检查项目】
1. **八股化检查**：是否含有"似乎/仿佛/嘴角微微上扬/她很温柔"等八股表达？有 → 改成白描
2. **万能美人检查**：外貌是否含"精致脸蛋/白皙皮肤/桃花眼"等万能描写？有 → 改成具体特征（异色瞳/疤痕/义肢/特殊发色等）
3. **性格标签化检查**：是否直接说"她很温柔/他很善良"？有 → 改成具体行为
4. **语料检查**：参考语料里是否混入了动作神态描写？有 → 删掉只保留对话
5. **关系定位检查**：与 {{user}} 的关系是否具体明确？还是含糊带过？
6. **特征差异化检查**：遮住姓名靠外貌特征能不能认出这个 NPC？不能 → 删除万能描写、补充独特特征

【输出要求】
输出修正后的完整 NPC JSON（保持原 6 字段结构：basic / appearance / personality / relationship / language / sample_dialogues），不要其他文字。
${t}
`,i=`## NPC JSON 结构（严格按 6 块输出，缺一不可）

\`\`\`json
{
  "name": "NPC 姓名",
  "keys": ["关键词1", "关键词2", "称号/外号"],
  "basic": {
    "姓名": "...",
    "年龄": "...",
    "性别": "...",
    "身份": "..."
  },
  "appearance": {
    "整体印象": "一句话概括（身高/体型/给人感觉）",
    "关键特征": "最显眼的 1-2 个特征（异色瞳/疤痕/义肢/特殊发色等）",
    "穿着风格": "日常装扮"
  },
  "personality": {
    "核心特质": "2-3 个关键词",
    "行为模式": "典型行为（不是性格定义，是具体场景下做什么）"
  },
  "relationship": {
    "与user关系": "与 {{user}} 的具体关系",
    "态度": "对 {{user}} 的态度",
    "互动方式": "如何互动"
  },
  "language": {
    "说话风格": "简单描述",
    "口头禅": "如果有"
  },
  "sample_dialogues": [
    "5-10 句典型对话",
    "纯对话，不加动作神态",
    "体现性格和说话方式"
  ]
}
\`\`\`
`,a={与user关系:`与{{user}}的关系`};function o(e){return a[e]||e}function s(e){for(let[t,n]of Object.entries(a))if(e===n)return t;return e}function c(){return{name:``,keys:[],basic:{姓名:``,年龄:``,性别:``,身份:``},appearance:{整体印象:``,关键特征:``,穿着风格:``},personality:{核心特质:``,行为模式:``},relationship:{与user关系:``,态度:``,互动方式:``},language:{说话风格:``,口头禅:``},sample_dialogues:[]}}function l(e){if(!e)return``;let t=[],n=[[`basic`,`基础信息`],[`appearance`,`外貌特征`],[`personality`,`性格核心`],[`relationship`,`关系定位`],[`language`,`语言特征`]];t.push(`NPC: ${e.name||`(未命名)`}`);for(let[r,i]of n){let n=e[r];if(!n||typeof n!=`object`)continue;let a=Object.entries(n).filter(([e,t])=>t&&String(t).trim());if(a.length!==0){t.push(`  ${i}:`);for(let[e,n]of a)t.push(`    ${o(e)}: ${u(String(n))}`)}}if(Array.isArray(e.sample_dialogues)&&e.sample_dialogues.length>0){let n=e.sample_dialogues.filter(e=>e&&String(e).trim());if(n.length>0){t.push(`  参考语料:`);for(let e of n)t.push(`    - "${String(e).replace(/"/g,`\\"`)}"`)}}return t.join(`
`)}function u(e){return/[:#\n"]/.test(e)?`"${e.replace(/"/g,`\\"`)}"`:e}function d(e){let t=c();if(!e||typeof e!=`string`)return t;let n={基础信息:`basic`,外貌特征:`appearance`,性格核心:`personality`,关系定位:`relationship`,语言特征:`language`,参考语料:`sample_dialogues`},r=e.match(/^NPC:\s*(.+)$/m);r&&(t.name=r[1].trim().replace(/^["']|["']$/g,``));let i=null,a=e.split(`
`);for(let e of a){let r=e.replace(/\s+$/,``);if(!r.trim())continue;let a=r.match(/^\s{0,4}([^:]+):\s*$/);if(a&&n[a[1].trim()]){i=n[a[1].trim()];continue}if(!i)continue;if(i===`sample_dialogues`){let e=r.match(/^\s*-\s*["']?(.+?)["']?\s*$/);e&&t.sample_dialogues.push(e[1].replace(/\\"/g,`"`));continue}let o=r.match(/^\s+([^:]+?):\s*(.+)$/);if(o){let e=s(o[1].trim()),n=o[2].trim();n=n.replace(/^["']|["']$/g,``).replace(/\\"/g,`"`),t[i]&&typeof t[i]==`object`&&(t[i][e]=n)}}return t}function f(e){if(!e||typeof e!=`object`||!e.name)return!1;for(let t of[`basic`,`appearance`,`personality`,`relationship`,`language`])if(!e[t]||typeof e[t]!=`object`)return!1;return!!Array.isArray(e.sample_dialogues)}function p(e){let t=c(),n={...t,...e||{}};for(let r of[`basic`,`appearance`,`personality`,`relationship`,`language`])n[r]={...t[r],...e?.[r]||{}};return n.keys=Array.isArray(e?.keys)?e.keys:e?.name?[e.name]:[],n.sample_dialogues=Array.isArray(e?.sample_dialogues)?e.sample_dialogues:[],n}function m(t){if(!t||typeof t!=`string`)return[];let n=[];for(let r of e){r.pattern.lastIndex=0;let e;for(;(e=r.pattern.exec(t))!==null;)n.push({word:e[0],index:e.index,type:r.type,suggest:r.suggest}),e.index===r.pattern.lastIndex&&r.pattern.lastIndex++}return n}async function h(e,n,r){if(!r||typeof r!=`string`||r.trim().length<5||!e.isConfigured)return null;let i=`你是 SillyTavern 写卡审查专家，按写卡方法论检查内容是否符合"绝对零度/白描/特征差异化/八股禁令"。`+t,a=`请检查以下 NPC 的「${n}」字段，找出八股化、万能美人、性格标签化、主观评价等问题。

字段内容：
${r}

输出 JSON（无问题时 hasIssue 为 false）：
{"hasIssue": true 或 false, "issues": ["问题1描述", "问题2描述"], "suggest": "具体修改建议"}

只输出 JSON，不要其他文字。`;try{let t=await e.chat([{role:`system`,content:i},{role:`user`,content:a}],{temperature:.3}),n=String(t||``).replace(/```(?:json)?\s*/gi,``).trim().match(/\{[\s\S]*\}/);if(!n)return null;let r=JSON.parse(n[0]);return{hasIssue:!!r.hasIssue,issues:Array.isArray(r.issues)?r.issues:[],suggest:String(r.suggest||``)}}catch{return null}}async function g(e,n){if(!n||!e.isConfigured)return n;let i=`你是 SillyTavern 写卡审查专家。按写卡方法论检查并修正 NPC，必须输出完整 6 块 JSON 结构。`+t,a=r+`

当前 NPC JSON：
`+JSON.stringify(n,null,2);try{let t=await e.chat([{role:`system`,content:i},{role:`user`,content:a}],{temperature:.3}),r=String(t||``).replace(/```(?:json)?\s*/gi,``).trim().match(/\{[\s\S]*\}/);if(!r)return n;let o=p(JSON.parse(r[0]));return f(o)?o:n}catch{return n}}function _(e){if(!e)return{total:0,byType:{}};let t=m(v(e)),n={};for(let e of t)n[e.type]=(n[e.type]||0)+1;return{total:t.length,byType:n}}function v(e){let t=[];for(let n of[`basic`,`appearance`,`personality`,`relationship`,`language`]){let r=e[n];if(r&&typeof r==`object`)for(let e of Object.values(r))typeof e==`string`&&t.push(e)}return Array.isArray(e.sample_dialogues)&&t.push(...e.sample_dialogues.filter(e=>typeof e==`string`)),t.join(`
`)}export{c as a,l as c,n as d,i as f,_ as i,d as l,g as n,f as o,m as r,p as s,h as t,t as u};
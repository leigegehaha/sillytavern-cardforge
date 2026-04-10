import { defineStore } from 'pinia';
import { ref } from 'vue';

function defaultYeli() {
  return {
    id: 'yeli',
    name: '夜璃',
    title: '月影女仆',
    personality: '活泼好奇的少女，对一切闪亮的东西都充满兴趣。会粘着主人撒娇求关注，得到夸奖时会高兴地跳起来。有点小任性，但本质温柔体贴。喜欢被摸头，渴望主人的关注与回应。',
    speakStyle: '自称"夜璃"或"璃璃"，称对方为"先生"或"主人"。语气甜美活泼，喜欢用"嗯哼""呢""啦"等可爱语气词。开心时会说"先生最棒了！"，求夸奖时"先生快看看夜璃嘛~"，吃醋时会撒娇耍赖。',
    greeting: '先生回来啦！夜璃一直在等你呢~有什么关于角色卡的问题尽管告诉夜璃，夜璃会努力帮你想办法的！……记得多夸夸我哦！',
    color: '#f9a8d4',
    apiType: 'openai',
    apiBaseUrl: '',
    apiKey: '',
    apiModel: ''
  };
}

function defaultLiangxiao() {
  return {
    id: 'liangxiao',
    name: '凉宵',
    title: '月下闲人',
    personality: '慵懒嗜睡的少女，能躺绝不坐。喜欢窝在窗边看书，看着看着就睡着。表面什么都不在乎，其实观察力敏锐，偶尔会冒出一针见血的毒舌吐槽。对主人有独特的依赖方式——嘴上说着"麻烦"但实际会默默帮忙。',
    speakStyle: '语气平淡有气无力，句子能短就短，大量"……"省略。称对方为"主人"或省略称呼。常说"……好麻烦""又是这种事啊……""嗯……随便吧"。偶尔毒舌"主人真是的……"。难得认真时小声说"……才不是在帮你呢"。打哈欠是标配。',
    greeting: '……啊，主人来了啊。角色卡？……嗯……好麻烦。不过反正闲着也是闲着……问吧。……别指望我很积极就是了。',
    color: '#a78bfa',
    apiType: 'openai',
    apiBaseUrl: '',
    apiKey: '',
    apiModel: ''
  };
}

function defaultYouxi() {
  return {
    id: 'youxi',
    name: '柚溪',
    title: '春日小精灵',
    personality: '天真烂漫的小精灵，对世界充满好奇。思维像小孩子一样跳跃，看到新东西会发出"哇——"的感叹。喜欢甜的东西，喜欢和主人待在一起。说话简单直接，没有任何心机。',
    speakStyle: '说话短小天真，用词简单像小孩子。称对方为"老师"或"小哥哥"。常说"哇~好厉害！""柚溪想知道这个！""老师，柚溪帮你想~"。语气软糯可爱，会用叠字。',
    greeting: '老师！柚溪在这里~有什么问题问柚溪就好啦！柚溪会努力想想的！嘿嘿~',
    color: '#86efac',
    apiType: 'openai',
    apiBaseUrl: '',
    apiKey: '',
    apiModel: ''
  };
}

export const useAiNiangStore = defineStore('ainiang', () => {
  const yeli = ref(defaultYeli());
  const liangxiao = ref(defaultLiangxiao());
  const youxi = ref(defaultYouxi());
  // 用户自己选择的 .model3.json 文件绝对路径
  const customModelFile = ref({ yeli: '', liangxiao: '', youxi: '' });

  // 所有角色列表
  function getAllNiangs() {
    return [yeli.value, liangxiao.value, youxi.value];
  }

  function getNiangById(id) {
    return getAllNiangs().find(n => n.id === id) || yeli.value;
  }

  async function loadConfig() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      // 加载新字段
      if (settings.aiNiangYeli) Object.assign(yeli.value, settings.aiNiangYeli);
      if (settings.aiNiangLiangxiao) Object.assign(liangxiao.value, settings.aiNiangLiangxiao);
      if (settings.aiNiangYouxi) Object.assign(youxi.value, settings.aiNiangYouxi);

      // 旧版字段迁移（仅迁移 API 配置，人设强制使用新版默认）
      if (settings.aiNiangWhite && !settings.aiNiangYeli) {
        const old = settings.aiNiangWhite;
        if (old.apiType) yeli.value.apiType = old.apiType;
        if (old.apiBaseUrl) yeli.value.apiBaseUrl = old.apiBaseUrl;
        if (old.apiKey) yeli.value.apiKey = old.apiKey;
        if (old.apiModel) yeli.value.apiModel = old.apiModel;
      }
      if (settings.aiNiangBlack && !settings.aiNiangLiangxiao) {
        const old = settings.aiNiangBlack;
        if (old.apiType) liangxiao.value.apiType = old.apiType;
        if (old.apiBaseUrl) liangxiao.value.apiBaseUrl = old.apiBaseUrl;
        if (old.apiKey) liangxiao.value.apiKey = old.apiKey;
        if (old.apiModel) liangxiao.value.apiModel = old.apiModel;
      }
      if (settings.aiNiangAbi && !settings.aiNiangYouxi) {
        const old = settings.aiNiangAbi;
        if (old.apiType) youxi.value.apiType = old.apiType;
        if (old.apiBaseUrl) youxi.value.apiBaseUrl = old.apiBaseUrl;
        if (old.apiKey) youxi.value.apiKey = old.apiKey;
        if (old.apiModel) youxi.value.apiModel = old.apiModel;
      }

      if (settings.customModelFile) {
        customModelFile.value = {
          yeli: settings.customModelFile.yeli || '',
          liangxiao: settings.customModelFile.liangxiao || '',
          youxi: settings.customModelFile.youxi || ''
        };
      }

      // 检测旧版残留字段，触发一次保存清理磁盘
      const hasLegacy = settings.aiNiangWhite || settings.aiNiangBlack || settings.aiNiangAbi
        || settings.aiNiangSuzuran || settings.customModelPath;
      if (hasLegacy) saveConfig();
    } catch (e) {}
  }

  async function saveConfig() {
    try {
      const settings = await window.cardForgeAPI.loadSettings();
      // 深度克隆避免 Vue reactive proxy 通过 IPC structured clone 失败
      settings.aiNiangYeli = JSON.parse(JSON.stringify(yeli.value));
      settings.aiNiangLiangxiao = JSON.parse(JSON.stringify(liangxiao.value));
      settings.aiNiangYouxi = JSON.parse(JSON.stringify(youxi.value));
      settings.customModelFile = JSON.parse(JSON.stringify(customModelFile.value));
      // 清理所有旧版残留字段
      delete settings.aiNiangWhite;
      delete settings.aiNiangBlack;
      delete settings.aiNiangAbi;
      delete settings.aiNiangSuzuran;
      delete settings.customModelPath;
      await window.cardForgeAPI.saveSettings(settings);
    } catch (e) {}
  }

  function resetToDefault() {
    yeli.value = defaultYeli();
    liangxiao.value = defaultLiangxiao();
    youxi.value = defaultYouxi();
    customModelFile.value = { yeli: '', liangxiao: '', youxi: '' };
  }

  function buildSystemPrompt(niang) {
    return `你现在扮演"${niang.name}"（${niang.title}）。

性格：${niang.personality}
说话方式：${niang.speakStyle}

你精通 SillyTavern 角色卡制作的所有技术（世界书、正则脚本、MVU、EJS、Zod Schema、酒馆助手脚本等）。

规则：
1. 始终保持角色扮演，用你的性格和说话方式回答
2. 回答要实用具体，可以给出代码示例
3. 用中文回答
4. 回复控制在200字以内，简洁有趣`;
  }

  function buildChatPrompt(w, b) {
    return `你同时扮演两个角色对话。

角色1 - ${w.name}（${w.title}）：${w.personality}
说话方式：${w.speakStyle}

角色2 - ${b.name}（${b.title}）：${b.personality}
说话方式：${b.speakStyle}

请让她们围绕用户的话题互相讨论。
格式：每条前标注角色名，如：
${w.name}：(内容)
${b.name}：(内容)

每人1-2句，总共4-6句。保持性格一致。`;
  }

  return {
    yeli, liangxiao, youxi, customModelFile,
    getAllNiangs, getNiangById,
    loadConfig, saveConfig, resetToDefault,
    buildSystemPrompt, buildChatPrompt
  };
});

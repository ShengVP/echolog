require('dotenv').config({ path: require('./lib/paths').ENV_FILE });

const { Bot } = require('grammy');
const ollama = require('./lib/llm');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const fetch = require('node-fetch');

const { HttpsProxyAgent } = require('https-proxy-agent');

// 🌐 强制使用中国时间
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Shanghai");

// ⚠️ 配置（全部走 .env，不进 git）
const TOKEN = process.env.TG_BOT_TOKEN;
const MY_TELEGRAM_ID = parseInt(process.env.TG_OWNER_ID, 10);
const PROXY_URL = process.env.TG_PROXY_URL || 'http://127.0.0.1:7897';
const OLLAMA_TEXT_MODEL = process.env.LLM_TEXT_MODEL || process.env.OLLAMA_TEXT_MODEL || 'qwen3.5:9b';
const OLLAMA_VISION_MODEL = process.env.LLM_VISION_MODEL || process.env.OLLAMA_VISION_MODEL || 'openbmb/minicpm-o2.6:latest';

if (!TOKEN || !MY_TELEGRAM_ID) {
  console.error('❌ 缺少 TG_BOT_TOKEN 或 TG_OWNER_ID（参考 .env.example）');
  process.exit(1);
}

const proxyAgent = new HttpsProxyAgent(PROXY_URL);

const { VAULT_DIR } = require('./lib/paths');
const AUDIT_LOG = path.join(__dirname, 'security_audit.log');

// const bot = new Bot(TOKEN);

// 👇 [修改] 2. 给 Bot 注入代理配置，打通任督二脉
const bot = new Bot(TOKEN, {
  client: {
    baseFetchConfig: {
      agent: proxyAgent,
    },
  },
});

// 📂 工具：获取并初始化当天的存储目录
function getTodayContext() {
  const todayStr = dayjs().tz().format('YYYY-MM-DD');
  const dirPath = path.join(VAULT_DIR, todayStr);
  const assetsPath = path.join(dirPath, 'assets');
  const logFile = path.join(dirPath, '01_raw_logs.md');
  const cacheFile = path.join(dirPath, '00_image_cache.json'); // 新增缓存文件
  
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  if (!fs.existsSync(assetsPath)) fs.mkdirSync(assetsPath, { recursive: true });
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, `# ${todayStr} 碎片记录\n\n`);
  if (!fs.existsSync(cacheFile)) fs.writeFileSync(cacheFile, JSON.stringify({}));
  
  return { dirPath, assetsPath, logFile, cacheFile, todayStr };
}

// 🛡️ 安全防线
bot.use(async (ctx, next) => {
  if (ctx.from?.id !== MY_TELEGRAM_ID) return;
  await next();
});

// 📥 工具：下载 Telegram 文件
async function downloadMedia(fileId, extension, defaultName = '') {
  const { assetsPath } = getTodayContext();
  const file = await bot.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
 //  const response = await fetch(url);
  const response = await fetch(url, { agent: proxyAgent });
  const buffer = await response.arrayBuffer();
  
  const timeStr = dayjs().tz().format('HHmmss');
  const fileName = defaultName ? `${timeStr}_${defaultName}` : `${timeStr}_media.${extension}`;
  const savePath = path.join(assetsPath, fileName);
  fs.writeFileSync(savePath, Buffer.from(buffer));
  return fileName;
}

// 📝 写入日志
function appendLog(content) {
  const { logFile } = getTodayContext();
  const timeStr = dayjs().tz().format('HH:mm:ss');
  fs.appendFileSync(logFile, `\n### 🕒 ${timeStr}\n${content}\n---\n`);
}

// 👁️ 核心视觉处理：解析图片并使用本地缓存
async function getOrProcessImageDesc(fileName, assetsPath, cacheFile) {
  const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  
  // 1. 命中缓存，直接返回
  if (cacheData[fileName]) {
    console.log(`[⚡ 缓存命中] 跳过解析，直接读取图片信息: ${fileName}`);
    return cacheData[fileName];
  }

  // 2. 未命中，调用视觉模型
  console.log(`[👁️ 视觉模型] 显卡启动，正在解析新图片: ${fileName}...`);
  const imagePath = path.join(assetsPath, fileName);
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');

  try {
    const response = await ollama.chat({
      model: OLLAMA_VISION_MODEL,
      messages: [{ 
        role: 'user', 
        content: '请详细描述这张图片的内容。如果是文档、白板或屏幕截图，请提炼核心文字和逻辑；如果是生活照片，请描述场景、物体和氛围细节。', 
        images: [imageBase64] 
      }],
      think: false,
      stream: false
    });
    
    const description = response.message.content;
    
    // 3. 写入缓存
    cacheData[fileName] = description;
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    
    return description;
  } catch (error) {
    console.error(`[❌ 视觉解析失败] ${fileName}:`, error.message);
    return "图片解析失败，未能提取视觉信息。";
  }
}

// ==========================================
// 🧠 核心指令：生成带视觉增强的结构化日记
// ==========================================
bot.command('diary', async (ctx) => {
  const { dirPath, assetsPath, logFile, cacheFile, todayStr } = getTodayContext();
  if (!fs.existsSync(logFile)) return ctx.reply('📭 今天还没记录呢。');

  let loadingMsg = await ctx.reply('🧠 正在读取记忆...\n👁️ 正在校验图片缓存与视觉解析...');
  let rawLogs = fs.readFileSync(logFile, 'utf8');

  // ✨ 魔法步骤：正则提取所有图片，并把视觉解析结果注入到上下文中
  const imageRegex = /!\[.*?\]\((assets\/([^)]+))\)/g;
  let augmentedLogs = rawLogs;
  let match;
  
  while ((match = imageRegex.exec(rawLogs)) !== null) {
    const fullMarkdown = match[0];
    const fileName = match[2];
    
    // 获取解析（带缓存逻辑）
    const imageDesc = await getOrProcessImageDesc(fileName, assetsPath, cacheFile);
    console.log(`[⚡ Image 描述] : ${imageDesc}`);
    
    // 把解析结果拼接到 Markdown 图片的下面，喂给文本模型
    const replacement = `${fullMarkdown}\n> 💡 **[视觉辅助提取信息]**：${imageDesc}\n`;
    augmentedLogs = augmentedLogs.replace(fullMarkdown, replacement);
  }

  await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '✍️ 视觉信息整合完毕！正在生成深度结构化日记...');
  console.log(`[🤖 Ollama] 文本模型接管，开始撰写日记...`);

  try {
    const prompt = `
你是一位顶级的个人知识管理（PKM）专家和深度思考教练。以下是我今天的碎片化记录。
如果记录中包含图片，我已经让视觉模型帮你提取了图片的文字和画面描述（带有 \`💡 [视觉辅助提取信息]\` 标记）。

请你综合所有文本和视觉信息，帮我重构为一篇结构严谨、细节丰满的 Markdown 日记：

## 🌟 今日生活高光与核心记忆
- 这是重头戏。请把今天最值得记录的事件、情绪、成就或重点，详细、细腻、生动地写出来，让我一眼看出今天的主色调。

## ⏱️ 细粒度时间轨迹
- 严格按照时间先后顺序，用带有具体时分秒（如 **14:30:00**）的时间线形式串联。
- 将零散的文字和【视觉辅助提取信息】自然融合成完整的故事或操作流。
- 必须将原文的图片链接（如 \`![图片](assets/xxx.jpg)\`）保留在对应的时间点，并在图片下方配上一句简短且优雅的图注。

## 💡 深度反思与积极成长
根据今天的经历，帮我提炼以下三点：
1. **认知升级：** 今天的反思、总结或学到的新东西。
2. **延伸思考：** 基于今天的话题，提供更深层的极客视角或跨界联想。
3. **行动项 (Action Items)：** 接下来需要落实的具体待办。

**排版要求：**
语气从容、干练。关键人物、项目名使用加粗强调。直接输出日记，不要废话。

今日增强型数据源：
${augmentedLogs}
`;

    const response = await ollama.chat({
      model: OLLAMA_TEXT_MODEL, 
      messages: [{ role: 'user', content: prompt }],
      think: false,
      stream: false
    });

    const diaryContent = response.message.content;

    // 版本控制保存
    let version = 1;
    while (fs.existsSync(path.join(dirPath, `02_diary_v${version}.md`))) { version++; }
    fs.writeFileSync(path.join(dirPath, `02_diary_v${version}.md`), `# ${todayStr} 深度复盘 (v${version})\n\n${diaryContent}`);

    // 发送回手机端
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, `✨ 今日深度复盘已生成 (v${version}) 👇`);
    if (diaryContent.length > 4000) {
        await ctx.reply(diaryContent.substring(0, 4000));
        await ctx.reply(diaryContent.substring(4000));
    } else {
        await ctx.reply(diaryContent); 
    }

  } catch (error) {
    console.error('[❌ 错误] 文本模型调用失败:', error);
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, '⚠️ 文本大模型开小差了，请看终端控制台报错。');
  }
});

// ---------------- 接收逻辑区 ----------------

bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  appendLog(ctx.message.text);
  console.log(`[📝 记录] 文本已归档`);
  await ctx.reply('✅'); 
});

bot.on('message:photo', async (ctx) => {
  const loadingMsg = await ctx.reply('⏳ 正在下载图片...');
  const photo = ctx.message.photo[ctx.message.photo.length - 1]; 
  try {
    const fileName = await downloadMedia(photo.file_id, 'jpg');
    const caption = ctx.message.caption ? `\n说明: ${ctx.message.caption}` : '';
    appendLog(`![图片](assets/${fileName})${caption}`);
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, `✅ 图片已入库 (下次生成日记时将自动解析)`);
  } catch (err) {
    await ctx.api.editMessageText(ctx.chat.id, loadingMsg.message_id, `❌ 保存失败`);
  }
});

bot.catch((err) => console.error('Bot 全局错误:', err.message));
bot.start();
console.log(`🛡️ 极客私密日记 V4 (多模态缓存版) 已启动`);

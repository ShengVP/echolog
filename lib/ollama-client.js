// 统一的 Ollama 客户端封装
//
// 解决的问题：
//   Node 18+ 用 undici 实现 fetch，默认 headersTimeout = 300_000ms (5 分钟)。
//   ollama-js 直接用 fetch 调本机 :11434，模型 cold start 时 prefill 可能 > 5 分钟，
//   于是 fetch 在模型还没开始返回 token 时就抛 UND_ERR_HEADERS_TIMEOUT，
//   用户看到 "fetch failed"，根因被掩盖。
//
// 这里做三件事：
//   1. 构造一个 long-timeout 的 undici Agent (默认 30 min)，仅给 ollama 用，
//      不污染飞书 SDK / url-enrich 等其他 fetch 调用。
//   2. 默认追加 keep_alive='30m'，让模型加载后常驻 30 min，避免反复 cold start。
//   3. 错误信息友好化：UND_ERR_HEADERS_TIMEOUT / ECONNREFUSED / model not found 都翻成人话。
//   4. warmup() 在主进程启动时 fire-and-forget 调一次，把模型先加载到显存。
//
// 用 env 调（都有合理默认）：
//   OLLAMA_HOST                  默认 http://127.0.0.1:11434
//   OLLAMA_KEEP_ALIVE            默认 30m
//   OLLAMA_HEADERS_TIMEOUT_MS    默认 1800000 (30 min)
//   OLLAMA_BODY_TIMEOUT_MS       默认 1800000 (30 min)

const { Ollama } = require('ollama');
const { fetch: undiciFetch, Agent } = require('undici');

const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';
const HEADERS_TIMEOUT_MS = parseInt(process.env.OLLAMA_HEADERS_TIMEOUT_MS || `${30 * 60 * 1000}`, 10);
const BODY_TIMEOUT_MS = parseInt(process.env.OLLAMA_BODY_TIMEOUT_MS || `${30 * 60 * 1000}`, 10);
const CONNECT_TIMEOUT_MS = 30_000;

const longAgent = new Agent({
  headersTimeout: HEADERS_TIMEOUT_MS,
  bodyTimeout: BODY_TIMEOUT_MS,
  connectTimeout: CONNECT_TIMEOUT_MS,
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 600_000,
});

const customFetch = (url, init = {}) =>
  undiciFetch(url, { ...init, dispatcher: longAgent });

const client = new Ollama({ host: HOST, fetch: customFetch });

function humanizeError(err) {
  const code = err?.cause?.code || err?.code;
  if (code === 'UND_ERR_HEADERS_TIMEOUT') {
    return `模型推理超时 (>${(HEADERS_TIMEOUT_MS / 60000).toFixed(0)}min)，可能是 cold start 太慢 / 上下文太长 / 模型没加载`;
  }
  if (code === 'UND_ERR_BODY_TIMEOUT') return '模型响应中断 (body timeout)';
  if (code === 'UND_ERR_CONNECT_TIMEOUT') return `连接 ${HOST} 超时`;
  if (code === 'ECONNREFUSED') return `Ollama 服务未启动 (${HOST} 拒绝连接)`;
  if (code === 'ENOTFOUND') return `Ollama host 无法解析: ${HOST}`;
  if (/model.*not found|pull.*model/i.test(err?.message || '')) {
    return `模型未拉取，需要 ollama pull: ${err.message}`;
  }
  return err?.message || String(err);
}

async function chat(req) {
  const { tag, ...rest } = req;
  const finalReq = { keep_alive: KEEP_ALIVE, ...rest };
  const t0 = Date.now();
  try {
    const r = await client.chat(finalReq);
    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    if (tag) console.log(`[ollama ${tag}] ${finalReq.model} ${dur}s`);
    return r;
  } catch (err) {
    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    err.friendlyMessage = humanizeError(err);
    console.error(`[ollama ${tag || 'chat'}] ${finalReq.model} ❌ ${dur}s — ${err.friendlyMessage}`);
    throw err;
  }
}

async function embed(req) {
  const { tag, ...rest } = req;
  const finalReq = { keep_alive: KEEP_ALIVE, ...rest };
  const t0 = Date.now();
  try {
    const r = await client.embed(finalReq);
    if (tag) {
      const dur = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[ollama embed/${tag}] ${finalReq.model} ${dur}s`);
    }
    return r;
  } catch (err) {
    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    err.friendlyMessage = humanizeError(err);
    console.error(`[ollama embed/${tag || ''}] ${finalReq.model} ❌ ${dur}s — ${err.friendlyMessage}`);
    throw err;
  }
}

// 启动时 fire-and-forget 调用，把模型先加载到内存
// 失败不阻塞主流程（ollama 可能还没起、网络瞬时问题等）
async function warmup(models = []) {
  for (const model of models) {
    if (!model) continue;
    const t0 = Date.now();
    try {
      await client.chat({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        think: false,
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: { num_predict: 1, temperature: 0 },
      });
      const dur = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[🔥 warmup] ${model} ready ${dur}s`);
    } catch (err) {
      console.error(`[⚠️ warmup ${model}] ${humanizeError(err)}`);
    }
  }
}

// 直接探活 ollama 服务（不加载模型，毫秒级返回）
async function ping() {
  try {
    await client.list();
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  chat,
  embed,
  warmup,
  ping,
  humanizeError,
  client,
  HOST,
  KEEP_ALIVE,
  HEADERS_TIMEOUT_MS,
};

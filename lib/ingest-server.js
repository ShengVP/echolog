// HTTP /ingest 端点 —— 让 Android (Tasker / HTTP Shortcuts) 直接往 echolog 灌内容
//
// 协议：
//   POST http://127.0.0.1:8766/ingest
//   Header: X-Echolog-Token: <token>     (与 .env 的 INGEST_TOKEN 比对；未设 token 则关闭服务)
//   Body (application/json):
//     {
//       "text":   "...",                    必填或 image_path/audio_path 至少有一个
//       "image_path": "/abs/path.jpg",      可选；文件必须在本机
//       "audio_path": "/abs/path.opus",     可选；文件必须在本机
//       "ts":     "2026-05-04T20:30:00+08:00",   可选，不传用当前时间（Asia/Shanghai）
//       "source": "tasker:walk",            可选，标签前缀
//       "tags":   "#health/walk"            可选
//     }
//
// 安全：
//   - 仅监听 127.0.0.1（不暴露到 LAN）
//   - 必须配 INGEST_TOKEN（.env），且至少 16 字符
//   - 跨设备（小米手机 → Mac）必须走 Tailscale / SSH tunnel，不开公网

const http = require('http');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const DEFAULT_PORT = parseInt(process.env.INGEST_PORT || '8766', 10);
const MAX_BODY = 2 * 1024 * 1024; // 2MB；图片大时让用户传 image_path 而不是 base64

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', d => {
      total += d.length;
      if (total > MAX_BODY) {
        reject(new Error('body too large (max 2MB; use image_path for binaries)'));
        req.destroy();
        return;
      }
      chunks.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// 桌面 GUI 调用 bot 命令时用的本地控制端点
// 不需要 INGEST_TOKEN（127.0.0.1 + 进程内 PID 文件校验已经够安全）
// 用法：POST /command  body: { command: "diary", date: "2026-05-28", chatId?: "..." }

function startIngestServer({ port = DEFAULT_PORT, token, onIngest, onCommand, logger = console }) {
  if (!token || token.length < 16) {
    logger.warn(`[ingest] INGEST_TOKEN 未配置或太短（要求 ≥16 char）—— ingest server 未启动`);
    return null;
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/health') {
      return send(200, { ok: true, service: 'echolog ingest', time: new Date().toISOString() });
    }

    // 桌面 GUI → bot 命令触发（仅 127.0.0.1，不暴露公网；不需要 token，因为只 bind localhost）
    if (req.method === 'POST' && req.url === '/command') {
      if (!onCommand) return send(501, { error: 'command handler not registered' });
      try {
        const raw = await readBody(req);
        const payload = JSON.parse(raw || '{}');
        const { command, date, chatId } = payload;
        if (!command) return send(400, { error: 'command 必填' });
        const result = await onCommand({ command, date, chatId });
        return send(200, { ok: true, ...result });
      } catch (err) {
        logger.error(`[command] ${err.message}`);
        return send(500, { error: err.message });
      }
    }

    if (req.method !== 'POST' || req.url !== '/ingest') {
      return send(404, { error: 'not found; use POST /ingest or POST /command' });
    }
    if (req.headers['x-echolog-token'] !== token) {
      return send(401, { error: 'unauthorized' });
    }
    try {
      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw || '{}');
      } catch {
        return send(400, { error: 'invalid JSON body' });
      }
      const { text, image_path, audio_path, ts, source, tags } = payload;
      if (!text && !image_path && !audio_path) {
        return send(400, { error: '需要 text / image_path / audio_path 至少一个' });
      }
      if (image_path && !fs.existsSync(image_path)) {
        return send(400, { error: `image_path 不存在: ${image_path}` });
      }
      if (audio_path && !fs.existsSync(audio_path)) {
        return send(400, { error: `audio_path 不存在: ${audio_path}` });
      }
      const sendDt = ts ? dayjs(ts) : dayjs();
      const result = await onIngest({
        text,
        imagePath: image_path,
        audioPath: audio_path,
        sendDt,
        source: source || 'ingest',
        tags: tags || '',
      });
      return send(200, { ok: true, ...result });
    } catch (err) {
      logger.error(`[ingest] ${err.message}`);
      return send(500, { error: err.message });
    }
  });
  server.listen(port, '127.0.0.1', () => {
    logger.log(`[ingest] HTTP server: http://127.0.0.1:${port}/ingest + /command`);
  });
  return server;
}

module.exports = { startIngestServer };

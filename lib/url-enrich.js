// URL 元数据抽取 —— 用户在飞书发链接时，bot 后台抓 title + description 附到 logs
//
// 设计：
//   - 不抓正文（避免 SSRF / 法律风险 / 性能开销）
//   - 仅抽 <title>、<meta name="description">、og:title、og:description
//   - timeout 8s；UA 伪装 Chrome
//   - 失败 graceful：返回 null，主流程继续

const fetch = require('node-fetch');

const URL_REGEX = /https?:\/\/[^\s<>"'一-龥]+/g;
const TIMEOUT_MS = 8000;
const MAX_HTML = 256 * 1024; // 只读前 256KB；title/meta 都在 head 里

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

function extractUrls(text) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(URL_REGEX)) {
    let u = m[0].replace(/[.,;)>\]]+$/, ''); // 剥末尾标点
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function pick(html, regex) {
  const m = html.match(regex);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

async function fetchMeta(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      signal: ctrl.signal,
      redirect: 'follow',
      size: MAX_HTML,
    });
    if (!r.ok) return { url, error: `HTTP ${r.status}` };
    const ctype = r.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(ctype)) {
      return { url, error: `non-html (${ctype})` };
    }
    let html = await r.text();
    if (html.length > MAX_HTML) html = html.slice(0, MAX_HTML);
    const ogTitle = pick(html, /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);
    const title = ogTitle || pick(html, /<title[^>]*>([^<]+)<\/title>/i);
    const description =
      pick(html, /<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      pick(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const siteName = pick(html, /<meta\s+(?:property|name)=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    return { url, title: title || '', description: description || '', siteName: siteName || '' };
  } catch (err) {
    return { url, error: err.message };
  } finally {
    clearTimeout(t);
  }
}

// 将 URL meta 渲染成 markdown 块（追加到 logs 用）
function renderMeta(meta) {
  if (!meta || meta.error) return null;
  const titlePart = meta.title ? `**${meta.title}**` : meta.url;
  const sitePart = meta.siteName ? `_${meta.siteName}_` : '';
  const descPart = meta.description
    ? meta.description.length > 240
      ? meta.description.slice(0, 240) + '…'
      : meta.description
    : '';
  const lines = [`> 🔗 ${titlePart}${sitePart ? ` · ${sitePart}` : ''}`];
  if (descPart) lines.push(`> ${descPart}`);
  return lines.join('\n');
}

module.exports = { extractUrls, fetchMeta, renderMeta };

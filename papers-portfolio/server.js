import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const NEWS_CACHE_MS = 5 * 60 * 1000;
let newsCache = null;

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .trim();
}

function readTag(source, tag) {
  const match = source.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? decodeXml(match[1]) : '';
}

function isAllowedHost(hostname, domain) {
  const host = String(hostname || '').toLowerCase();
  return host === domain || host.endsWith('.' + domain);
}

function parseNewsFeed(xml, category, domain, cutoff) {
  const results = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    let title = readTag(block, 'title').replace(/\s+/g, ' ');
    const date = new Date(readTag(block, 'pubDate'));
    const sourceTag = block.match(/<source\s+[^>]*url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i);
    const sourceUrl = sourceTag ? decodeXml(sourceTag[1]) : '';
    const sourceLabel = sourceTag ? decodeXml(sourceTag[2]).replace(/\s+/g, ' ') : '';
    if (sourceLabel && title.endsWith(' - ' + sourceLabel)) title = title.slice(0, -sourceLabel.length - 3).trim();
    title = title.replace(/\s+-\s+(?:GOV\.KZ|управлен\w*\s+роспотребнадзора|роспотребнадзор|всемирная организация здравоохранения).*$/i, '').trim();
    const href = readTag(block, 'link');
    let sourceHost = '';
    let articleHost = '';
    try { sourceHost = new URL(sourceUrl).hostname; } catch { /* malformed feed item */ }
    try { articleHost = new URL(href).hostname; } catch { /* malformed feed item */ }
    if (!title || !/[А-Яа-яЁё]/.test(title) || !Number.isFinite(date.valueOf()) || date < cutoff) continue;
    if (!isAllowedHost(sourceHost, domain) || !isAllowedHost(articleHost, 'news.google.com')) continue;
    if (/^управление роспотребнадзора по (городу|области)/i.test(title)) continue;
    if (category.startsWith('ДИПЛОМАТИЯ') && !/(визит|прибыл|посетил|приедет|переговор|встреч[аеу]|глав государств)/i.test(title)) continue;
    results.push({
      category,
      title: title.slice(0, 180),
      source: domain === 'who.int' ? 'ВОЗ' : domain === 'gov.kz' ? 'GOV.KZ' : 'РОСПОТРЕБНАДЗОР',
      publishedAt: date.toISOString(),
      href,
    });
  }
  return results;
}

async function fetchNewsFeed(query, category, domain, cutoff) {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'ru');
  url.searchParams.set('gl', 'RU');
  url.searchParams.set('ceid', 'RU:ru');
  const response = await fetch(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'TairPortfolioNews/1.0' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error('News feed returned ' + response.status);
  return parseNewsFeed(await response.text(), category, domain, cutoff);
}

async function getNewsPayload() {
  if (newsCache && Date.now() - newsCache.cachedAt < NEWS_CACHE_MS) return newsCache.payload;
  const now = Date.now();
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const afterDate = cutoff.toISOString().slice(0, 10);
  const requests = [
    fetchNewsFeed(`site:who.int/ru/news (вспышка OR вирус OR инфекция) after:${afterDate}`, 'ЗДОРОВЬЕ · ВОЗ', 'who.int', cutoff),
    fetchNewsFeed(`site:rospotrebnadzor.ru (ОРВИ OR грипп OR чума OR инфекция) after:${afterDate}`, 'ЗДОРОВЬЕ · РОСПОТРЕБНАДЗОР', 'rospotrebnadzor.ru', cutoff),
    fetchNewsFeed(`site:gov.kz (визит OR прибыл OR переговоры OR встреча глав) after:${afterDate}`, 'ДИПЛОМАТИЯ · КАЗАХСТАН', 'gov.kz', cutoff),
  ];
  const settled = await Promise.allSettled(requests);
  const items = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const uniqueItems = [...new Map(items.map((item) => [item.category + '|' + item.title.toLocaleLowerCase('ru-RU'), item])).values()]
    .sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt))
    .slice(0, 5);
  const payload = {
    checkedAt: new Date().toISOString(),
    intervalMinutes: 15,
    live: settled.some((result) => result.status === 'fulfilled'),
    context: [],
    items: uniqueItems,
  };
  newsCache = { cachedAt: Date.now(), payload };
  return payload;
}

async function respondWithNews(res, forceRefresh = false) {
  if (forceRefresh) newsCache = null;
  try {
    const payload = await getNewsPayload();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ checkedAt: new Date().toISOString(), intervalMinutes: 15, live: false, context: [], items: [] }));
  }
}

const server = http.createServer((req, res) => {
  let reqPath;
  try {
    reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 Bad Request');
  }
  if (reqPath === '/api/news') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' });
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
    return void respondWithNews(res, new URL(req.url, 'http://localhost').searchParams.get('refresh') === '1');
  }
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.resolve(ROOT, `.${reqPath}`);
  const relativePath = path.relative(ROOT, filePath);

  // Reject paths outside the site root (including sibling paths with a shared prefix).
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found: ' + reqPath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[Papers Portfolio] Inspector desk server running at http://localhost:${PORT}`);
});

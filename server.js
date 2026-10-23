'use strict';

const http = require('node:http');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const CACHE_TTL_MS = Math.max(60_000, Number(process.env.NBA_CACHE_TTL_MS || 6 * 60 * 60 * 1000));
const USER_AGENT = process.env.NBA_SOURCE_USER_AGENT || 'Basketball-game data-sync (respectful low-volume fetch; configure contact via NBA_SOURCE_USER_AGENT)';
const CATEGORY_PATHS = Object.freeze({
  totals: 'totals',
  perGame: 'per_game',
  perMinute: 'per_minute',
  perPossession: 'per_poss',
  advanced: 'advanced',
  playByPlay: 'play-by-play',
  shooting: 'shooting',
  adjustedShooting: 'adj_shooting'
});
const cache = new Map();

function sourceUrl(season, category) {
  const suffix = CATEGORY_PATHS[category];
  if (!suffix) throw new Error('Unknown statistics category: ' + category);
  if (!Number.isInteger(season) || season < 1947 || season > 2100) throw new Error('Invalid season end year.');
  return 'https://www.basketball-reference.com/leagues/NBA_' + season + '_' + suffix.replace('play-by-play', 'play-by-play') + '.html';
}
function decodeEntities(s) {
  return String(s).replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function stripTags(html) {
  return decodeEntities(String(html).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ').trim();
}
function attributes(tag) {
  const out = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return out;
}
function extractTable(html, tableId) {
  const find = source => {
    const tableRe = /<table\b([^>]*)>([\s\S]*?)<\/table\s*>/gi;
    for (const match of source.matchAll(tableRe)) {
      if (attributes('<table ' + match[1] + '>').id === tableId) return match[0];
    }
    return null;
  };
  let table = find(html);
  if (table) return table;
  // Basketball-Reference sometimes places tables inside HTML comments. This only
  // reads the delivered page; it does not bypass access controls or protections.
  for (const comment of html.matchAll(/<!--[\s\S]*?-->/g)) {
    table = find(comment[0].slice(4, -3));
    if (table) return table;
  }
  return null;
}
function tableToCsv(table) {
  const rowHtml = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(m => m[1]);
  const rows = [];
  for (const row of rowHtml) {
    const cells = [...row.matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)].map(m => {
      const attr = attributes('<' + m[1] + ' ' + m[2] + '>');
      return { tag: m[1].toLowerCase(), attr, value: stripTags(m[3]) };
    });
    if (!cells.length) continue;
    if (!rows.length) {
      const headers = cells.map(c => c.attr['data-stat'] || c.value).map(h => h.trim());
      // Stable internal player key supplements, but never replaces, the displayed source columns.
      if (!headers.some(h => /^(player|name)$/i.test(h))) continue;
      const playerIndex = cells.findIndex(c => /^(player|name)$/i.test(c.attr['data-stat'] || c.value));
      rows.push(headers);
      rows.playerIndex = playerIndex;
      rows.externalIds = [];
      continue;
    }
    const playerIndex = rows.playerIndex ?? 0;
    const playerCell = cells[playerIndex];
    const rowHeaders = rows[0];
    const values = rowHeaders.map((header, i) => {
      const cell = cells[i];
      if (!cell) return '';
      return cell.value;
    });
    const playerValue = values[playerIndex] || '';
    if (!playerValue || /^player$/i.test(playerValue) || /^\s*$/u.test(playerValue)) continue;
    rows.push(values);
    rows.externalIds.push(playerCell?.attr['data-append-csv'] || playerCell?.attr['data-player-id'] || '');
  }
  if (!rows.length) throw new Error('Expected table headers were not found.');
  const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const headers = rows[0].slice();
  const playerIndex = rows.playerIndex ?? headers.findIndex(h => /^(player|name)$/i.test(h));
  if (!headers.some(h => /^player_id$/i.test(h))) headers.push('player_id');
  const idIndex = headers.findIndex(h => /^player_id$/i.test(h));
  return [headers, ...rows.slice(1).map((row, i) => {
    const output = row.slice();
    while (output.length < headers.length - 1) output.push('');
    output[idIndex] = rows.externalIds?.[i] || '';
    return output;
  })].map(row => row.map(quote).join(',')).join('\n');
}
async function fetchCategory(season, category) {
  const url = sourceUrl(season, category);
  const key = season + ':' + category;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return { ...cached.result, cached: true, fetchedAt: cached.result.fetchedAt };
  }
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, 'accept': 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000)
  });
  if (response.status === 403 || response.status === 429) {
    throw Object.assign(new Error('Basketball-Reference a refusé la requête (HTTP ' + response.status + '). Aucune tentative de contournement n’est effectuée.'), { statusCode: response.status });
  }
  if (!response.ok) throw Object.assign(new Error('Source HTTP ' + response.status), { statusCode: response.status });
  const html = await response.text();
  if (/captcha|verify you are human|access denied|automated requests/i.test(html.slice(0, 200_000))) {
    throw Object.assign(new Error('La réponse ressemble à une page de blocage; elle n’a pas été interprétée comme des statistiques.'), { statusCode: 502 });
  }
  const tableIds = { totals: 'totals_stats', perGame: 'per_game_stats', perMinute: 'per_minute_stats', perPossession: 'per_poss_stats', advanced: 'advanced_stats', playByPlay: 'pbp_stats', shooting: 'shooting_stats', adjustedShooting: 'adj_shooting_stats' };\n  const tableId = tableIds[category];
  const table = extractTable(html, tableId);
  if (!table) throw Object.assign(new Error('Table attendue "' + tableId + '" absente de la réponse.'), { statusCode: 502 });
  const csv = tableToCsv(table);
  const lineCount = Math.max(0, csv.split(/\r?\n/).length - 1);
  if (lineCount < 1) throw Object.assign(new Error('Le tableau reçu ne contient aucune ligne de joueur.'), { statusCode: 502 });
  const result = { season: String(season - 1) + '-' + String(season).slice(-2), category, source: 'Basketball-Reference', url, fetchedAt: new Date().toISOString(), rows: lineCount, csv };
  cache.set(key, { savedAt: Date.now(), result });
  return { ...result, cached: false };
}
function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(payload));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true, service: 'basketball-game-data-sync', categories: Object.keys(CATEGORY_PATHS), cacheTtlMs: CACHE_TTL_MS });
  }
  if (req.method !== 'GET' || url.pathname !== '/api/nba/stats') return send(res, 404, { error: 'Not found' });
  const season = Number(url.searchParams.get('season') || 2026);
  const category = url.searchParams.get('category') || '';
  try {
    const result = await fetchCategory(season, category);
    return send(res, 200, result);
  } catch (error) {
    return send(res, error.statusCode || 502, {
      ok: false, season, category, source: 'Basketball-Reference',
      url: (() => { try { return sourceUrl(season, category); } catch { return null; } })(),
      error: error.message || String(error), fetchedAt: new Date().toISOString()
    });
  }
});
if (require.main === module) {
  server.listen(PORT, HOST, () => console.log('NBA stats sync listening on http://' + HOST + ':' + PORT));
}
module.exports = { CATEGORY_PATHS, sourceUrl, decodeEntities, stripTags, attributes, extractTable, tableToCsv, fetchCategory, server };

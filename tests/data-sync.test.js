'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CATEGORY_PATHS, sourceUrl, decodeEntities, extractTable, csvColumnCount, tableToCsv } = require('../server');

test('registry exposes all eight requested categories and season URLs', () => {
  assert.equal(Object.keys(CATEGORY_PATHS).length, 8);
  assert.equal(sourceUrl(2026, 'totals'), 'https://www.basketball-reference.com/leagues/NBA_2026_totals.html');
  assert.equal(sourceUrl(2026, 'adjustedShooting'), 'https://www.basketball-reference.com/leagues/NBA_2026_adj_shooting.html');
  assert.equal(sourceUrl(2026, 'perMinute'), 'https://www.basketball-reference.com/leagues/NBA_2026_per_minute.html');
  assert.throws(() => sourceUrl(2026, 'unknown'), /Unknown/);
});

test('extracts a source table and preserves all headers and rows', () => {
  const html = '<table id="totals_stats"><thead><tr><th data-stat="player">Player</th><th data-stat="pts">PTS</th><th data-stat="awards">Awards</th></tr></thead><tbody><tr><th data-stat="player" data-append-csv="player01"><a>Zoë &amp; Co.</a></th><td data-stat="pts">1,234</td><td data-stat="awards">AS,NBA1</td></tr></tbody></table>';
  const table = extractTable(html, 'totals_stats');
  assert.ok(table);
  const csv = tableToCsv(table);
  assert.match(csv, /player_id/);
  assert.equal(csvColumnCount(csv), 4);
  assert.match(csv, /Zoë & Co\./);
  assert.match(csv, /awards/);
  assert.match(csv, /player01/);
  assert.equal(decodeEntities('A &amp; B'), 'A & B');
});

test('extracts tables delivered inside comments without bypassing access controls', () => {
  const html = '<html><!-- <table id="advanced_stats"><tr><th data-stat="player">Player</th><th data-stat="per">PER</th></tr><tr><th data-stat="player" data-append-csv="abc">A Player</th><td>19.2</td></tr></table> --></html>';
  assert.ok(extractTable(html, 'advanced_stats'));
});

test('restores saved synchronization interval and season, and persists changes', () => {
  const values = new Map([
    ['nbaSimLab.syncIntervalHours.v1', '6'],
    ['nbaSimLab.syncSeasonYear.v1', '2024']
  ]);
  const storage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const makeElement = value => ({
    value, disabled: false, textContent: '', className: '',
    options: ['0', '6', '24', '168'].map(value => ({ value })),
    handlers: {},
    addEventListener(type, callback) { this.handlers[type] = callback; }
  });
  const elements = {
    syncInterval: makeElement('24'),
    syncSeason: makeElement('2026'),
    syncData: makeElement(''),
    syncReport: makeElement(''),
    syncCategories: makeElement('')
  };
  const document = {
    getElementById: id => elements[id] || null,
    handlers: {},
    addEventListener(type, callback) { this.handlers[type] = callback; },
    dispatchEvent() {}
  };
  const window = { handlers: {}, addEventListener(type, callback) { this.handlers[type] = callback; } };
  const context = {
    document, window, localStorage: storage,
    fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    Date, Number, String, JSON, Math, encodeURIComponent
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data-sync.js'), 'utf8'), context);
  assert.equal(elements.syncInterval.value, '6');
  assert.equal(elements.syncSeason.value, '2024');

  elements.syncInterval.handlers.change({ target: { value: '168' } });
  elements.syncSeason.handlers.change({ target: { value: '2025' } });
  assert.equal(values.get('nbaSimLab.syncIntervalHours.v1'), '168');
  assert.equal(values.get('nbaSimLab.syncSeasonYear.v1'), '2025');
});

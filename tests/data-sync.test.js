'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORY_PATHS, sourceUrl, decodeEntities, extractTable, tableToCsv } = require('../server');

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
  assert.match(csv, /Zoë & Co\./);
  assert.match(csv, /Awards/);
  assert.match(csv, /player01/);
  assert.equal(decodeEntities('A &amp; B'), 'A & B');
});

test('extracts tables delivered inside comments without bypassing access controls', () => {
  const html = '<html><!-- <table id="advanced_stats"><tr><th data-stat="player">Player</th><th data-stat="per">PER</th></tr><tr><th data-stat="player" data-append-csv="abc">A Player</th><td>19.2</td></tr></table> --></html>';
  assert.ok(extractTable(html, 'advanced_stats'));
});

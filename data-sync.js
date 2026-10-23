(() => {
  'use strict';
  const categories = [
    { id: 'totals', label: 'Totals', filename: 'NBA_2026_totals.csv' },
    { id: 'perGame', label: 'Per Game', filename: 'NBA_2026_per_game.csv' },
    { id: 'perMinute', label: 'Per 36 Minutes', filename: 'NBA_2026_per_minute.csv' },
    { id: 'perPossession', label: 'Per 100 Possessions', filename: 'NBA_2026_per_poss.csv' },
    { id: 'advanced', label: 'Advanced', filename: 'NBA_2026_advanced.csv' },
    { id: 'playByPlay', label: 'Play-by-Play', filename: 'NBA_2026_play-by-play.csv' },
    { id: 'shooting', label: 'Shooting', filename: 'NBA_2026_shooting.csv' },
    { id: 'adjustedShooting', label: 'Adjusted Shooting', filename: 'NBA_2026_adj_shooting.csv' }
  ];
  const lastSyncKey = 'nbaSimLab.lastSync.v1';
  const settingsKey = 'nbaSimLab.syncIntervalHours.v1';
  const seasonSettingsKey = 'nbaSimLab.syncSeasonYear.v1';
  const statusEl = () => document.getElementById('syncReport');
  const setMessage = (message, bad = false) => {
    const el = statusEl();
    if (el) { el.textContent = message; el.className = bad ? 'notice' : 'muted'; }
  };
  const validIntervals = [0, 6, 24, 168];
  const interval = () => {
    const selected = Number(document.getElementById('syncInterval')?.value ?? localStorage.getItem(settingsKey) ?? 24);
    return validIntervals.includes(selected) ? selected : 24;
  };
  const seasonYear = () => {
    const selected = Number(document.getElementById('syncSeason')?.value || localStorage.getItem(seasonSettingsKey) || 2026);
    return Number.isInteger(selected) && selected >= 1947 && selected <= 2100 ? selected : 2026;
  };
  function restoreSettings() {
    const intervalSelect = document.getElementById('syncInterval');
    const savedInterval = localStorage.getItem(settingsKey);
    if (intervalSelect && savedInterval !== null && validIntervals.includes(Number(savedInterval))) intervalSelect.value = String(Number(savedInterval));
    const seasonInput = document.getElementById('syncSeason');
    const savedSeason = localStorage.getItem(seasonSettingsKey);
    if (seasonInput && savedSeason !== null) {
      const year = Number(savedSeason);
      if (Number.isInteger(year) && year >= 1947 && year <= 2100) seasonInput.value = String(year);
    }
  }
  restoreSettings();
  const toCsv = value => {
    if (typeof value !== 'string') throw new Error('La source n’a pas renvoyé de CSV valide.');
    return value;
  };
  async function sync({ automatic = false } = {}) {
    const button = document.getElementById('syncData');
    if (button?.disabled) return;
    const season = seasonYear();
    if (!Number.isInteger(season) || season < 1947 || season > 2100) {
      setMessage('Saison invalide. Indique l’année de fin de saison, par exemple 2026.', true);
      return;
    }
    if (button) { button.disabled = true; button.textContent = 'Synchronisation…'; }
    document.dispatchEvent(new CustomEvent('nba:data-sync-start', { detail: { season, automatic } }));
    setMessage('Vérification du service de données…');
    const results = [];
    try {
      const health = await fetch('/api/health', { headers: { accept: 'application/json' } });
      if (!health.ok) throw new Error('Le service de synchronisation n’est pas disponible sur cette adresse. Lance le backend Node.js (voir README).');
      const healthJson = await health.json();
      if (!healthJson.ok) throw new Error('Le service de synchronisation n’a pas confirmé son état.');
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        setMessage('Récupération ' + (i + 1) + '/' + categories.length + ' : ' + category.label + '…');
        try {
          const response = await fetch('/api/nba/stats?season=' + encodeURIComponent(season) + '&category=' + encodeURIComponent(category.id), { headers: { accept: 'application/json' } });
          const result = await response.json();
          if (!response.ok || result.ok === false || !result.csv) throw new Error(result.error || ('HTTP ' + response.status));
          results.push({ ...result, categoryLabel: category.label, filename: result.url?.split('/').pop() || category.filename, csv: toCsv(result.csv), ok: true });
        } catch (error) {
          results.push({ category: category.id, categoryLabel: category.label, source: 'Basketball-Reference', ok: false, error: error.message || String(error) });
        }
      }
      document.dispatchEvent(new CustomEvent('nba:data-sync-complete', { detail: { season, results, automatic, completedAt: new Date().toISOString() } }));
      const good = results.filter(r => r.ok).length;
      if (good === categories.length) {
        localStorage.setItem(lastSyncKey, JSON.stringify({ season, completedAt: new Date().toISOString(), categories: results.map(r => r.category) }));
        setMessage('Synchronisation terminée : ' + good + '/8 catégories validées. Les données ont été transmises à la base locale.');
      } else {
        setMessage('Synchronisation partielle : ' + good + '/8 catégories récupérées. Les catégories en échec sont listées ci-dessous; les données précédentes sont conservées.', true);
      }
    } catch (error) {
      setMessage((automatic ? 'Synchronisation automatique ignorée : ' : 'Synchronisation impossible : ') + (error.message || String(error)), true);
      document.dispatchEvent(new CustomEvent('nba:data-sync-error', { detail: { message: error.message || String(error), automatic } }));
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Prise de data'; }
    }
  }
  function renderReport(report) {
    const target = document.getElementById('syncCategories');
    if (!target) return;
    target.innerHTML = '<div class="tablewrap"><table><thead><tr><th>Catégorie</th><th>Statut</th><th>Lignes</th><th>Colonnes</th><th>Source / erreur</th></tr></thead><tbody>' +
      report.map(r => '<tr><td>' + escapeHtml(r.categoryLabel || r.category) + '</td><td>' + (r.ok ? 'Récupérée' : 'Indisponible') + '</td><td>' + (r.rows ?? '—') + '</td><td>' + (r.columns ?? '—') + '</td><td>' + escapeHtml(r.ok ? (r.cached ? 'Cache serveur · ' : '') + (r.source || 'Source inconnue') : (r.error || 'Erreur inconnue')) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  document.addEventListener('nba:data-sync-complete', event => renderReport(event.detail.results));
  document.addEventListener('nba:data-sync-error', event => {
    const target = document.getElementById('syncCategories');
    if (target) target.innerHTML = '<p class="notice">' + escapeHtml(event.detail.message) + '</p>';
  });
  document.getElementById('syncData')?.addEventListener('click', () => sync());
  document.getElementById('syncInterval')?.addEventListener('change', event => {
    const selected = Number(event.target.value);
    if (validIntervals.includes(selected)) localStorage.setItem(settingsKey, String(selected));
  });
  document.getElementById('syncSeason')?.addEventListener('change', event => {
    const selected = Number(event.target.value);
    if (Number.isInteger(selected) && selected >= 1947 && selected <= 2100) localStorage.setItem(seasonSettingsKey, String(selected));
  });
  window.NBADataSync = { sync, categories };
  // At startup, attempt a quiet sync only when the backend is installed and the configured interval elapsed.
  window.addEventListener('load', async () => {
    try {
      const response = await fetch('/api/health', { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const saved = JSON.parse(localStorage.getItem(lastSyncKey) || 'null');
      const elapsedHours = saved?.completedAt ? (Date.now() - Date.parse(saved.completedAt)) / 3_600_000 : Infinity;
      if (interval() > 0 && (!saved || saved.season !== seasonYear() || elapsedHours >= interval())) await sync({ automatic: true });
    } catch (_) { /* Static hosting without a backend is expected; manual imports remain available. */ }
  });
})();
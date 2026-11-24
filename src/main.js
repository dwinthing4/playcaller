// Boot: start the management UI and the match engine.
(function boot() {
  try { if (typeof MATCH !== 'undefined' && MATCH.init) MATCH.init(); } catch (e) { console.error('MATCH.init failed', e); }
  render();
  window.addEventListener('pcfonts', () => { if (typeof MATCH !== 'undefined' && MATCH._G) return; const m = document.getElementById('modal'); if (m && m.firstChild) return; if (L) render(); else renderTitle(); });
  window.addEventListener('beforeunload', () => { if (L && !L.picking && !L.exhibition) { try { localStorage.setItem('pc_slot_fallback_' + CUR_SLOT, serialize()); } catch (e) { } } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && L && !L.picking && !L.exhibition) saveNow(); });
})();

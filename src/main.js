// Boot: start the management UI and the match engine.
(function boot() {
  try { if (typeof MATCH !== 'undefined' && MATCH.init) MATCH.init(); } catch (e) { console.error('MATCH.init failed', e); }
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (L) render(); else renderTitle(); });
  window.addEventListener('beforeunload', () => { if (L && !L.picking && !L.exhibition) { try { localStorage.setItem('pc_slot_fallback_' + CUR_SLOT, serialize()); } catch (e) { } } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && L && !L.picking && !L.exhibition) saveNow(); });
})();

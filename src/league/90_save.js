// Saves: IndexedDB slots (big leagues do not fit localStorage), slot metadata in localStorage, export/import as JSON text.
const NSLOTS = 4; let CUR_SLOT = 1;
const SAVE_DB = 'playcaller', SAVE_STORE = 'slots';
function serialize() { L.uid = UID; const skip = { _oc: 1, blocks: 1, blocksKey: 1 }; return JSON.stringify(L, (k, v) => skip[k] ? undefined : v); }
function migrate() {
  if (!L.inbox) L.inbox = []; if (!L.rec) L.rec = { mine: {}, lg: {} }; if (!L.hof) L.hof = []; if (!L.lhist) L.lhist = []; if (!L.lhof) L.lhof = []; if (!L.rel) L.rel = {}; if (!L.coachHist) L.coachHist = []; if (!L.offers) L.offers = []; if (!L.settings) L.settings = { sound: true, haptics: true, theme: 'stadium', tags: true, view: 'auto' };
  if (!L.unis) L.unis = {};
  for (const id in L.P) { const p = L.P[id]; ensureBody(p); msrEnsure(p); if (!p.st) p.st = blankStats(); if (!p.car) p.car = {}; if (!p.hist) p.hist = []; ensureLook(p); }
  ensureStaffAll(); if (!L.picking && L.user != null) ensureUserStaff();
}
function deserialize(s) { const d = JSON.parse(s); if (!d || !d.teams || !d.P) throw new Error('Not a Playcaller league'); L = d; UID = L.uid || (Object.keys(L.P).reduce((m, k) => Math.max(m, +k), 0) + 1); migrate(); return L; }
function slotMeta() { try { return JSON.parse(localStorage.getItem('pc_slots') || '{}'); } catch (e) { return {}; } }
function writeMeta(m) { try { localStorage.setItem('pc_slots', JSON.stringify(m)); } catch (e) { } }
function idb() { return new Promise((res, rej) => { if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB')); const r = indexedDB.open(SAVE_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(SAVE_STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbPut(key, val) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(SAVE_STORE, 'readwrite'); tx.objectStore(SAVE_STORE).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbGet(key) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(SAVE_STORE, 'readonly'); const r = tx.objectStore(SAVE_STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbDel(key) { const db = await idb(); return new Promise((res) => { const tx = db.transaction(SAVE_STORE, 'readwrite'); tx.objectStore(SAVE_STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
let saveTimer = null, saveBusy = false;
function saveGame(now) { if (!L || L.picking || L.exhibition) return; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, now ? 0 : 400); }
async function saveNow() {
  if (!L || L.picking || L.exhibition || saveBusy) return; saveBusy = true;
  try { const s = serialize(); await idbPut('slot' + CUR_SLOT, s); const T = UT(); const m = slotMeta(); m[CUR_SLOT] = { team: teamName(T), c1: T.c1, coach: T.coach.fn + ' ' + T.coach.ln, year: L.year, rec: `${T.w}-${T.l}${T.tie ? '-' + T.tie : ''}`, ts: Date.now(), titles: T.coach.titles, phase: L.phase }; writeMeta(m); }
  catch (e) { try { localStorage.setItem('pc_slot_fallback_' + CUR_SLOT, serialize()); } catch (e2) { } }
  finally { saveBusy = false; }
}
async function loadSlot(n) { CUR_SLOT = n; let s = null; try { s = await idbGet('slot' + n); } catch (e) { } if (!s) { try { s = localStorage.getItem('pc_slot_fallback_' + n); } catch (e) { } } if (!s) throw new Error('No save in that slot'); deserialize(s); return L; }
async function deleteSlot(n) { await idbDel('slot' + n); const m = slotMeta(); delete m[n]; writeMeta(m); try { localStorage.removeItem('pc_slot_fallback_' + n); } catch (e) { } }
function freeSlot() { const m = slotMeta(); for (let n = 1; n <= NSLOTS; n++) if (!m[n]) return n; return null; }

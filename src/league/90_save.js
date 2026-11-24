// Saves: IndexedDB slots (big leagues do not fit localStorage), slot metadata in localStorage, export/import as JSON text.
const NSLOTS = 4; let CUR_SLOT = 1;
const SAVE_DB = 'playcaller', SAVE_STORE = 'slots';
function serialize() { L.uid = UID; const skip = { _oc: 1, blocks: 1, blocksKey: 1 }; return JSON.stringify(L, (k, v) => skip[k] ? undefined : v); }
function migrate() {
  if (!L.inbox) L.inbox = []; if (!L.rec) L.rec = { mine: {}, lg: {} }; if (!L.hof) L.hof = []; if (!L.lhist) L.lhist = []; if (!L.lhof) L.lhof = []; if (!L.rel) L.rel = {}; if (!L.coachHist) L.coachHist = []; if (!L.offers) L.offers = []; if (!L.settings) L.settings = { sound: true, haptics: true, theme: 'stadium', tags: true, view: 'auto' };
  if (!L.unis) L.unis = {};
  for (const id in L.P) { const p = L.P[id]; ensureBody(p); if (!p.st) p.st = blankStats(); if (!p.car) p.car = {}; if (!p.hist) p.hist = []; ensureLook(p); }
  ensureStaffAll(); if (!L.picking && L.user != null) ensureUserStaff();
  migrateContracts();
}
// contracts v1 (dead money ledger, bonus structure, rookie deals with 5th-year options, comp-pick log)
function migrateContracts() {
  if (!L.compLog) L.compLog = [];
  for (const t of L.teams) if (!t.deadL) t.deadL = t.dead ? [{ y: capYear(), amt: t.dead, nm: '', why: 'Earlier moves' }] : [];
  if (L.ctV) return;
  for (const t of L.teams) for (const id of t.roster) { const p = L.P[id]; if (!p || p.rk !== undefined) continue; p.rk = null;
    const d = p.drafted; if (d && d.y && d.r && p.yrs === d.y + 4 - capYear() && p.yrs >= 1 && p.yrs <= 4) p.rk = { y: d.y, r: d.r, pick: d.pick || 0, opt: null }; }
  ctInitLeague(true);
}
function deserialize(s) { const d = JSON.parse(s); if (!d || !d.teams || !d.P) throw new Error('Not a Playcaller league'); L = d; UID = L.uid || (Object.keys(L.P).reduce((m, k) => Math.max(m, +k), 0) + 1); migrate(); return L; }
function slotMeta() { try { return JSON.parse(localStorage.getItem('pc_slots') || '{}'); } catch (e) { return {}; } }
function writeMeta(m) { try { localStorage.setItem('pc_slots', JSON.stringify(m)); } catch (e) { } }
function idb() { return new Promise((res, rej) => { if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB')); const r = indexedDB.open(SAVE_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(SAVE_STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbPut(key, val) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(SAVE_STORE, 'readwrite'); tx.objectStore(SAVE_STORE).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbGet(key) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(SAVE_STORE, 'readonly'); const r = tx.objectStore(SAVE_STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbDel(key) { const db = await idb(); return new Promise((res) => { const tx = db.transaction(SAVE_STORE, 'readwrite'); tx.objectStore(SAVE_STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
// Player photos (roster files) live outside the league object: IMGS maps a key to a small data URL and p.photo holds the key, so the
// league save that is written after every action stays small. They are saved next to the slot ('img' + slot) only when they change;
// without IndexedDB they go to localStorage, and if that is full they last for this session only (IMG_WARN).
let IMGS = {}, IMGS_DIRTY = false, IMG_WARN = false;
function imgKey(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return 'ph' + (h >>> 0).toString(36) + s.length.toString(36); }
function imgPut(url) { const k = imgKey(url); if (IMGS[k] !== url) { IMGS[k] = url; IMGS_DIRTY = true; } return k; }
function imgGet(k) { return k ? IMGS[k] || null : null; }
function imgReset() { IMGS = {}; IMGS_DIRTY = false; IMG_WARN = false; }
function imgUsed() { const keep = {}; if (L) for (const id in L.P) { const k = L.P[id].photo; if (k && IMGS[k]) keep[k] = IMGS[k]; } return keep; }
async function imgSave() {
  if (!IMGS_DIRTY) return; IMGS = imgUsed(); IMGS_DIRTY = false;
  try { await idbPut('img' + CUR_SLOT, IMGS); } catch (e) { try { localStorage.setItem('pc_img_' + CUR_SLOT, JSON.stringify(IMGS)); } catch (e2) { IMG_WARN = true; } }
}
async function imgLoad(n) { imgReset(); let v = null; try { v = await idbGet('img' + n); } catch (e) { } if (!v) { try { v = JSON.parse(localStorage.getItem('pc_img_' + n) || 'null'); } catch (e) { } } if (v && typeof v === 'object') IMGS = v; }
let saveTimer = null, saveBusy = false;
function saveGame(now) { if (!L || L.picking || L.exhibition) return; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, now ? 0 : 400); }
async function saveNow() {
  if (!L || L.picking || L.exhibition || saveBusy) return; saveBusy = true;
  try { const s = serialize(); await idbPut('slot' + CUR_SLOT, s); const T = UT(); const m = slotMeta(); m[CUR_SLOT] = { team: teamName(T), c1: T.c1, coach: T.coach.fn + ' ' + T.coach.ln, year: L.year, rec: `${T.w}-${T.l}${T.tie ? '-' + T.tie : ''}`, ts: Date.now(), titles: T.coach.titles, phase: L.phase }; writeMeta(m); }
  catch (e) { try { localStorage.setItem('pc_slot_fallback_' + CUR_SLOT, serialize()); } catch (e2) { } }
  finally { try { await imgSave(); } catch (e) { } saveBusy = false; }
}
async function loadSlot(n) { CUR_SLOT = n; let s = null; try { s = await idbGet('slot' + n); } catch (e) { } if (!s) { try { s = localStorage.getItem('pc_slot_fallback_' + n); } catch (e) { } } if (!s) throw new Error('No save in that slot'); deserialize(s); await imgLoad(n); return L; }
async function deleteSlot(n) { await idbDel('slot' + n); await idbDel('img' + n); const m = slotMeta(); delete m[n]; writeMeta(m); try { localStorage.removeItem('pc_slot_fallback_' + n); localStorage.removeItem('pc_img_' + n); } catch (e) { } }
function freeSlot() { const m = slotMeta(); for (let n = 1; n <= NSLOTS; n++) if (!m[n]) return n; return null; }

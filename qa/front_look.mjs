// Front office browser check: roster file from the title screen (sample file) and from the editor (paste), export download,
// photos on busts, save/load of photos, cap sheet, cut modal, coach tree, 5th-year options and the draft order with comp picks.
// run: node tools/build.mjs && node qa/front_look.mjs [desk|phone]   (screenshots in qa/shots/front/<size>)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/'), which = process.argv[2] || 'desk';
const out = path.join(root, 'qa', 'shots', 'front', which); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1, acceptDownloads: true }); const page = await ctx.newPage(); const errs = [], probs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let n = 0; const shot = async (name, full) => { await page.waitForTimeout(250); const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov > 2) probs.push(`${name}: horizontal overflow ${ov}px`); await page.screenshot({ path: path.join(out, String(n++).padStart(2, '0') + '_' + name + '.png'), fullPage: !!full }); };
const expect = (c, msg) => { if (!c) probs.push(msg); };
await page.goto('file:///' + root + '/dist/playcaller.html', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForFunction(() => typeof renderTitle === 'function' && document.querySelector('.tbar'), null, { timeout: 90000 }); await page.waitForTimeout(500);
await page.evaluate(async () => { for (let s = 1; s <= 4; s++) await deleteSlot(s); renderTitle(); });
await shot('title');
// ---- roster file from the title screen
await page.click('text=Roster file'); await page.waitForTimeout(200); await shot('rf_load');
await page.setInputFiles('#rffile', path.join(root, 'docs', 'sample-roster.json')); await page.waitForSelector('text=Start new career', { timeout: 8000 }); await shot('rf_preview_title');
await page.click('text=Start new career'); await page.waitForTimeout(200); await shot('rf_newcareer');
await page.evaluate(() => { NG.coach = 'Pat Tester'; createLeague(); }); await page.waitForTimeout(300); await shot('rf_pickteam');
const hb = await page.evaluate(() => { const t = L.teams.find(t => t.city === 'Harbor City'); return t ? { id: t.id, name: t.name, abbr: t.abbr, logo: !!t.logoImg, qb: pname(L.P[t.depth.QB[0]]), photos: t.roster.filter(id => L.P[id].photo).length } : null; });
expect(hb && hb.name === 'Gulls' && hb.abbr === 'HBR' && hb.logo && hb.qb === 'Jordan Example' && hb.photos === 2, 'sample file applied to the new league: ' + JSON.stringify(hb));
await page.evaluate(id => pickTeam(id), hb.id); await page.waitForTimeout(400); await shot('home_gulls');
await page.evaluate(() => { go('roster'); }); await page.waitForTimeout(500); await shot('roster_photos');
await page.evaluate(() => { showPlayer(UT().depth.QB[0]); }); await page.waitForTimeout(700); await shot('player_photo');
// photos survive save + load
const kept = await page.evaluate(async () => { await saveNow(); const id = UT().depth.QB[0], k = L.P[id].photo; L = null; imgReset(); await loadSlot(CUR_SLOT); render(); return !!(k && imgGet(L.P[id].photo)); });
expect(kept, 'photo survives save and load');
// ---- editor: paste a file that renames the Pine Ridge Elks and moves their colors
await page.evaluate(() => { closeModal(); go('editor'); }); await shot('editor');
await page.evaluate(() => { const f = rfExport({ name: 'Paste test' }); f.teams = f.teams.filter(t => t.city === 'Pine Ridge').map(t => Object.assign(t, { name: 'Ridgebacks', colors: { primary: '#7a2a2a', secondary: '#e8d7a8' }, players: t.players.slice(0, 3).map((p, i) => Object.assign(p, { first: 'Pasted', last: 'Name' + i, ratings: undefined, photo: undefined })) })); rfOpen('editor'); document.querySelector('.rfpaste').open = true; document.getElementById('rfpaste').value = JSON.stringify(f); });
await page.click('text=Read pasted text'); await page.waitForSelector('text=Apply to this league', { timeout: 8000 }); await shot('rf_preview_editor');
await page.click('text=Apply to this league'); await page.waitForTimeout(300);
const pr = await page.evaluate(() => { const t = L.teams.find(t => t.city === 'Pine Ridge'); return t && t.name === 'Ridgebacks' && t.c1 === '#7a2a2a' && L.P[t.depth.QB[0]].ln === 'Name0'; }); expect(pr, 'editor paste applied (Pine Ridge Ridgebacks, starter QB renamed)');
await shot('editor_after');
// ---- export download round trip
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('text=Export roster file')]); const fp = path.join(out, 'export.json'); await dl.saveAs(fp);
const ex = JSON.parse(fs.readFileSync(fp, 'utf8')); const exT = ex.teams.find(t => t.city === 'Harbor City');
expect(ex.format === 'playcaller-roster' && ex.teams.length === 32 && exT && exT.logo && exT.players.filter(p => p.photo).length === 2, 'export download carries teams, logo and photos');
// ---- cap sheet, cut modal, coach tree
await page.evaluate(() => { closeModal(); go('contracts'); scrollTo(0, 0); }); await shot('contracts');
await page.evaluate(() => { const p = UT().roster.map(id => L.P[id]).filter(p => p.prYrs > 1).sort((a, b) => b.sal - a.sal)[0]; ctCutModal(p.id); }); await shot('cut_modal');
await page.evaluate(() => { closeModal(); go('trade'); SUB.tradeGive = [UT().roster.map(id => L.P[id]).sort((a, b) => b.pr - a.pr)[0].id]; render(); scrollTo(0, 0); }); await shot('trade_dead');
await page.evaluate(() => { SUB.tradeGive = []; go('ctree'); }); await shot('ctree', true);
await page.evaluate(() => { coachLearn('exe1'); coachXP(200, 'Test XP'); coachLearn('exe2'); render(); }); await shot('ctree_learned');
await page.evaluate(() => { go('coach'); }); await shot('coach_card');
// ---- first offseason: options; second offseason: comp picks in the draft order
await page.evaluate(() => { closeModal(); simToPlayoffs(); let g = 0; while (L.phase === 'playoffs' && g++ < 10) { if (userPlayoffGame()) instantUserGame(); else simPlayoffRound(); } go('contracts'); scrollTo(0, 0); });
const opts = await page.evaluate(() => ctOptList(UT()).length); await shot('off_contracts'); if (!opts) console.log('(no user 5th-year options this run)');
await page.evaluate(() => { closeModal(); for (let i = 0; i < 3; i++) { const r = offseasonNext(); if (!r.ok) { const T = UT(); while (T.roster.length > 53) releasePlayer(T.roster.map(id => L.P[id]).sort((a, b) => a.ovr - b.ovr)[0].id); offseasonNext(); } } simToPlayoffs(); let g = 0; while (L.phase === 'playoffs' && g++ < 10) { if (userPlayoffGame()) instantUserGame(); else simPlayoffRound(); } go('draft'); scrollTo(0, 0); });
const comp = await page.evaluate(() => (L.draftOrder || []).filter(s => s.comp).length); expect(comp > 0, 'comp picks in the second draft order');
await page.evaluate(() => { const d = document.querySelector('details.dorder'); if (d) d.open = true; }); await shot('draft_order');
console.log(`comp picks: ${comp}, user options first offseason: ${opts}`);
console.log([...errs, ...probs].length ? 'PROBLEMS\n' + [...errs, ...probs].join('\n') : 'front office: no console errors, checks pass', out); await browser.close(); process.exit([...errs, ...probs].length ? 1 : 0);

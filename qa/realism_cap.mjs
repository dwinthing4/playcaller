// Player realism in the browser: role labels on the roster, measurables + comps on the card, draft-guide reports, the combine table,
// a private workout and every training-camp drill (played by a simple bot), in all four UI styles.
// run: node tools/build.mjs && node qa/realism_cap.mjs [desk|phone] [tag]   (screenshots in qa/shots/realism/<tag>_<size>)
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/'), which = process.argv[2] || 'desk', tag = process.argv[3] || 'now';
const out = path.join(root, 'qa', 'shots', 'realism', tag + '_' + which); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 }); const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let n = 0; const shot = async (name, full) => { await page.waitForTimeout(250); return page.screenshot({ path: path.join(out, String(n++).padStart(2, '0') + '_' + name + '.png'), fullPage: !!full }); };
const modalShot = async name => { await page.waitForTimeout(300); const box = await page.$('.modal .box'); if (box) await box.screenshot({ path: path.join(out, String(n++).padStart(2, '0') + '_' + name + '.png') }); else await shot(name); };
await page.goto('file:///' + root + '/dist/playcaller.html', { timeout: 120000 }); await page.waitForTimeout(900);
await page.evaluate(() => { try { localStorage.setItem('pc_style', 'broadcast'); } catch (e) { } NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[9].id); }); await page.waitForTimeout(600);
await page.evaluate(() => { closeModal(); SUB.rosterView = 'cards'; go('roster'); }); await shot('roster_cards');
await page.evaluate(() => { SUB.rosterView = 'list'; render(); }); await shot('roster_list');
// a young player's card: measurables, role, comp
await page.evaluate(() => { const T = UT(); const p = T.roster.map(id => L.P[id]).filter(p => p.age <= 24 && ['WR', 'CB', 'RB'].includes(p.pos)).sort((a, b) => b.pot - a.pot)[0]; showPlayer(p.id); const d = document.querySelector('.rl-card'); if (d) d.open = true; });
await modalShot('card_young');
// scouting through the season
await page.evaluate(() => { closeModal(); for (let i = 0; i < 5; i++) scoutingWeek(); go('scouting'); }); await shot('scouting_board');
await page.evaluate(() => { const p = L.draft.map(id => L.P[id]).filter(p => p.sc && p.sc.dgs).sort((a, b) => scoutedValue(b) - scoutedValue(a))[0]; showPlayer(p.id); });
await modalShot('prospect_inseason');
// to the offseason: combine
await page.evaluate(() => { closeModal(); simToPlayoffs(); let g = 0; while (L.phase === 'playoffs' && g++ < 12) { if (userPlayoffGame()) instantUserGame(); else simPlayoffRound(); } if (L.recap) L.recap.seen = true; for (let i = 0; i < 2; i++) scoutingWeek(); SUB.scView = 'comb'; go('scouting'); });
await shot('combine_table');
await page.evaluate(() => { SUB.scPos = 'WR'; rlCmbSort('forty'); }); await shot('combine_wr_by40');
await page.evaluate(() => { SUB.scPos = 'All'; SUB.cmbSort = 'bench'; SUB.cmbDir = -1; render(); }); await shot('combine_bench');
await page.evaluate(() => { SUB.scView = 'board'; SUB.drView = 'board'; const p = L.draft.map(id => L.P[id]).filter(p => p.comb && p.comb.forty != null && p.sc && p.sc.dgs).sort((a, b) => scoutedValue(b) - scoutedValue(a))[0]; showPlayer(p.id); });
await modalShot('prospect_combine_report');
// private workout: run the drill with a bot
const bot = async (kind, secs) => page.evaluate(async ([kind, secs]) => {
  const G = MGM.g, wait = ms => new Promise(r => setTimeout(r, ms)); mgmStart(); await wait(1700); const t0 = performance.now();
  while (performance.now() - t0 < secs * 1000 && MGM.st === 'play') {
    if (kind === 'qb') { G.down(80 + Math.random() * 200, 140 + Math.random() * 200); await wait(500); }
    else if (kind === 'rb') { G.down(Math.random() < .5 ? 60 : 300, 300); await wait(380); }
    else if (kind === 'db') { G.move(G.rx + (Math.random() - .5) * 30, 300, true); await wait(60); }
    else { G.down(180, 240); await wait(kind === 'kick' ? 700 : 450); }
  }
}, [kind, secs]);
const finish = () => page.evaluate(() => { const G = MGM.g; if (!G) return; if (G.dur) G.t = G.dur; else G.over = true; });
await page.evaluate(() => { const b = [...document.querySelectorAll('.modal button')].find(x => /Private workout/.test(x.textContent)); if (b) b.click(); });
await modalShot('workout_ready');
const wk = await page.evaluate(() => MGM.kind); await bot(wk, 4); await modalShot('workout_mid_' + wk); await finish(); await page.waitForTimeout(400); await modalShot('workout_result');
await page.evaluate(() => mgmClose(true)); await modalShot('prospect_after_workout');
// to the draft and free agency: camp opens
await page.evaluate(() => { closeModal(); offseasonNext(); simDraftUntilUser(); finishDraft(); go('develop'); }); await shot('camp_panel');
// every drill once
for (const pos of ['QB', 'WR', 'RB', 'OT', 'DE', 'CB', 'LB', 'K']) {
  const ok = await page.evaluate(pos => { const T = UT(), C = tcampState(); const p = T.roster.map(id => L.P[id]).find(p => p.pos === pos && !C.done[p.id] && !(p.inj > 0)); if (!p) return false; mgmOpen(p.id, 'camp'); return true; }, pos);
  if (!ok) continue; const kind = await page.evaluate(() => MGM.kind); await bot(kind, 3.5); await modalShot('drill_' + pos + '_' + kind); await finish(); await page.waitForTimeout(400);
  if (pos === 'QB' || pos === 'K') await modalShot('drill_' + pos + '_result'); await page.evaluate(() => mgmClose(true));
}
await shot('camp_after');
// styles: the report and the camp panel in each look
for (const st of ['program', 'varsity', 'night']) {
  await page.evaluate(st => { setUiStyle(st); go('develop'); }, st); await shot('camp_' + st);
  await page.evaluate(() => { const p = Object.values(L.P).filter(p => p.tid === L.user && p.sc && p.sc.dgs).sort((a, b) => b.pot - a.pot)[0] || Object.values(L.P).find(p => p.draft && p.sc && p.sc.dgs); if (p) { showPlayer(p.id); document.querySelectorAll('.rl-old').forEach(d => d.open = true); } });
  await modalShot('report_' + st); await page.evaluate(() => closeModal());
}
await page.evaluate(() => setUiStyle('broadcast'));
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out); await browser.close();

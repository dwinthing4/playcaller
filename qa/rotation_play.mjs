// A played game (mode 'play'): the user calls deep shots and throws them (keys 1-4). Checks the stamina in the ratings chip,
// breather notices in the HUD ticker, valid lineups, and that a tired receiver sits. Screenshots in qa/shots/rotation.
// run: node tools/build.mjs && node qa/rotation_play.mjs [desk|phone] [userSnaps=16]
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const shots = path.join(root, 'qa', 'shots', 'rotation'); fs.mkdirSync(shots, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const which = process.argv[2] || 'desk', WANT = +(process.argv[3] || 16);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const [vw, vh] = which === 'phone' ? [390, 844] : [1280, 800];
const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 })).newPage(); const errs = [], fails = [];
const check = (c, what) => { if (!c) fails.push(what); console.log((c ? 'PASS ' : 'FAIL ') + what); };
page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
await page.goto('file:///' + path.join(root, 'dist', 'playcaller.html').replace(/\\/g, '/'), { timeout: 120000 }); await page.waitForTimeout(500);
await page.evaluate(() => { try { localStorage.removeItem('pc_cam_v1'); } catch (e) { } NG.slot = 1; NG.qlen = 300; createLeague(); pickTeam(L.teams[5].id); });
await page.evaluate(() => { const f = LG.lineup; window.__rq = { bad: [], notes: [], ticks: [] };
  LG.lineup = (T, form, side, ctx, rs) => { const l = f(T, form, side, ctx, rs); if (rs) { const ids = l.map(e => e.pid); if (l.length !== 11 || new Set(ids).size !== 11 || ids.some(id => !L.P[id] || L.P[id].inj > 0)) window.__rq.bad.push(T.abbr + ' ' + form); if (T.id === L.user) for (const n of l.notes || []) window.__rq.notes.push(n); } return l; };
  const tk = document.querySelector('#game .tick'); new MutationObserver(() => { const t = tk.textContent; if (t && /breather|back in/.test(t)) window.__rq.ticks.push(t); }).observe(tk, { childList: true, characterData: true, subtree: true }); });
const G = () => page.evaluate(() => { const g = MATCH._G; if (!g) return null; const pl = g.play; return { kbar: !!(g.kpow || g.kaim), kick: !!g.kickCb, stage: g.stage, ready: g.ready, side: g.userSide, sheet: g.sheet ? g.sheet.side : null, phase: pl && pl.phase, over: g.over, down: g.down, chip: document.querySelector('#hud .pchip.show .sta') ? document.querySelector('#hud .pchip.show').textContent : null }; });
const wait = ms => page.waitForTimeout(ms); let n = 0; const shot = async name => page.screenshot({ path: path.join(shots, `${which}_${String(n++).padStart(2, '0')}_${name}.png`) });
await page.evaluate(() => startUserGame('play'));
for (let i = 0; i < 240; i++) { const g = await G(); if (g && g.ready) break; await wait(500); }
await page.click('#mKick');
let snaps = 0, guard = 0, chipSeen = null, wrChip = null, forced = false, satOut = null, ticked = false;
while (guard++ < 900 && snaps < WANT) {
  const g = await G(); if (!g || g.over) break;
  if (g.kick) { await page.click('#mK').catch(() => { }); await wait(600); continue; }
  if (g.kbar) { await page.keyboard.press('Space'); await wait(700); continue; }
  if (g.stage === 'call') {
    if (await page.$('[data-act="xp"]')) { await page.click('[data-act="xp"]'); await wait(300); continue; }
    if (g.sheet === 'O' && g.down === 4 && await page.$('[data-act="punt"]')) { await page.click('[data-act="punt"]'); await wait(400); continue; }
    // after a few snaps, wear the X receiver down so the next snap shows a breather (the natural kind needs a long drive)
    if (g.sheet === 'O' && snaps >= 4 && !forced) { satOut = await page.evaluate(() => { const g = MATCH._G, T = UT(), x = (g.cur && g.cur.lists[0] || []).find(e => e.pos === 'WR'); if (!x || g.cur.off !== T.id) return null; g.rot.E[x.rp.id] = 0.62; return { id: x.rp.id, ln: x.rp.ln }; }); forced = !!satOut; }
    const picked = await page.evaluate(side => { const cards = [...document.querySelectorAll('.sheet .pc[data-id]')], pl = c => L.plays.find(x => x.id === c.dataset.id);
      const pick = side === 'O' ? (cards.find(c => { const p = pl(c); return p && p.type === 'pass' && p.deep && p.form === 'Shotgun'; }) || cards.find(c => { const p = pl(c); return p && p.type === 'pass' && p.deep; }) || cards[0]) : cards[0];
      if (pick) pick.click(); return !!pick; }, g.sheet);
    if (!picked) await wait(300);
    await wait(500); continue;
  }
  if (g.stage === 'pre' && g.phase === 'pre' && g.side === 'O') {
    await wait(500);
    if (satOut && !ticked) { const st = await page.evaluate(id => ({ on: MATCH._G.play.O.some(p => p.pid === id), tick: document.querySelector('#game .tick').textContent }), satOut.id); check(!st.on, `the worn-down receiver (${satOut.ln}) sits this snap`); check(/breather/.test(st.tick), `HUD notice: "${st.tick}"`); await shot('breather_notice'); ticked = true; }
    await page.evaluate(() => MATCH._G.play.snap()); snaps++; await wait(1700);
    await page.keyboard.press('Digit1'); await wait(300);
    for (let k = 0; k < 14; k++) { const g2 = await G(); if (g2 && g2.chip && !chipSeen) { chipSeen = g2.chip; await shot('chip_stamina'); } if (g2 && g2.chip && / (WR|TE|RB) /.test(g2.chip) && !wrChip) { wrChip = g2.chip; await shot('chip_stamina_receiver'); } if (!g2 || g2.stage !== 'live') break; await wait(200); }
    continue;
  }
  if (g.stage === 'pre' && g.side === 'D' && g.phase === 'pre') { await page.evaluate(() => MATCH._G.play.snap()); await wait(600); const g2 = await G(); if (g2 && g2.chip && !chipSeen) { chipSeen = g2.chip; await shot('chip_stamina_def'); } continue; }
  await wait(250);
}
const q = await page.evaluate(() => { const g = MATCH._G, T = UT(), E = g && g.rot ? g.rot.E : {}; const low = T.roster.map(id => L.P[id]).filter(p => E[p.id] != null && E[p.id] < 0.95).map(p => `${p.pos} ${p.ln} ${(E[p.id] * 100).toFixed(0)}%`).slice(0, 10); return Object.assign({ low }, window.__rq); });
console.log(`user offensive snaps ${snaps}; stamina chip: ${chipSeen ? chipSeen.replace(/\s+/g, ' ') : 'not seen'}; ball carrier chip: ${wrChip ? wrChip.replace(/\s+/g, ' ') : 'not seen'}`);
console.log('tired after the drives: ' + q.low.join(', ')); console.log('notices (lineups): ' + q.notes.join(' | ')); console.log('HUD ticker: ' + q.ticks.join(' | '));
check(!!chipSeen && /STA/.test(chipSeen), 'ratings chip shows stamina (STA)'); check(q.bad.length === 0, 'every lineup 11 healthy, different players' + (q.bad.length ? ': ' + q.bad.join(', ') : ''));
await browser.close();
console.log(`${fails.length} failed`); console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
process.exit(fails.length || errs.length ? 1 : 0);

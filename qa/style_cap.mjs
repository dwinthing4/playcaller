// UI style capture: every menu screen and the in-game HUD in one look (Broadcast / Game Program / Varsity / Night Game).
// run: node tools/build.mjs && node qa/style_cap.mjs [desk|phone] [broadcast|program|varsity|night] [tag] [--menus|--game]
// screenshots in qa/shots/style/<tag>_<style>_<size>/ ; also checks horizontal overflow, small tap targets (phone) and console errors.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/');
const args = process.argv.slice(2).filter(a => !a.startsWith('--')), flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const which = args[0] || 'desk', style = args[1] || 'broadcast', tag = args[2] || 'now', team = 7;
const only = flags.includes('--menus') ? 'menus' : flags.includes('--game') ? 'game' : 'all';
const out = path.join(root, 'qa', 'shots', 'style', `${tag}_${style}_${which}`); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const [vw, vh, dpr] = which === 'phone' ? [390, 844, 2] : [1280, 800, 1];
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 });
await ctx.addInitScript(s => { try { localStorage.setItem('pc_style', s); localStorage.removeItem('pc_cam_v1'); } catch (e) { } }, style);
const page = await ctx.newPage(); const errs = [], notes = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
let n = 0; const shot = async (name, full) => page.screenshot({ path: path.join(out, String(n++).padStart(2, '0') + '_' + name + '.png'), fullPage: !!full });
const check = async name => { const r = await page.evaluate(([phone]) => { const ov = document.documentElement.scrollWidth - innerWidth; const small = [];
  if (phone) for (const b of document.querySelectorAll('#app button, #modal button, #app select')) { const r = b.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue; if (r.height < 30 || r.width < 30) small.push((b.textContent || b.className).trim().slice(0, 18) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  return { ov, small: small.slice(0, 8) }; }, [dpr > 1]); if (r.ov > 2) notes.push(`${name}: horizontal overflow ${r.ov}px`); if (r.small.length) notes.push(`${name}: small targets ${r.small.join(', ')}`); };
const view = async (name, fn, arg) => { await page.evaluate(fn, arg); await page.waitForTimeout(450); await check(name); await shot(name); };
await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(1200);
await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(200);
if (only !== 'game') {
  await check('title'); await shot('title');
  await view('newcareer', () => { NG.slot = 6; renderTitle(); });
  await view('pickteam', () => { NG.qlen = 120; createLeague(); });
  await page.evaluate(t => { pickTeam(L.teams[t].id); startUserGame('instant'); closeModal(); }, team); await page.waitForTimeout(400);
  for (const lay of ['dash', 'cast', 'locker']) { await view('hub_' + lay, l => { closeModal(); L.settings.hubLayout = l; go('home'); scrollTo(0, 0); }, lay); if (which === 'desk' || lay === 'dash') { await page.evaluate(() => scrollTo(0, 760)); await page.waitForTimeout(250); await shot('hub_' + lay + '_s'); } }
  await page.evaluate(() => { L.settings.hubLayout = 'dash'; });
  await view('roster', () => { closeModal(); SUB.rosterView = 'cards'; go('roster'); });
  await view('roster_list', () => { closeModal(); SUB.rosterView = 'list'; go('roster'); });
  await view('player_card', () => { closeModal(); SUB.rosterView = 'cards'; go('roster'); showPlayer(UT().depth.QB[0]); });
  await page.evaluate(() => { const b = document.querySelector('.modal .box'); if (b) b.scrollTop = 600; }); await page.waitForTimeout(200); await shot('player_card_s');
  for (const t of ['inbox', 'standings', 'schedule', 'depth', 'plan', 'playbook', 'staff', 'trade', 'draft', 'scouting', 'settings']) await view('tab_' + t, t => { closeModal(); go(t); scrollTo(0, 0); }, t);
  await view('prospect', () => { closeModal(); showPlayer(L.draft[0]); });
  await page.evaluate(() => closeModal());
}
if (only !== 'menus') {
  if (only === 'game') await page.evaluate(t => { NG.slot = 6; NG.qlen = 120; createLeague(); pickTeam(L.teams[t].id); }, team);
  await page.evaluate(() => { closeModal(); go('home'); startUserGame('play'); });
  for (let i = 0; i < 400; i++) { if (await page.evaluate(() => MATCH._G && MATCH._G.ready)) break; await page.waitForTimeout(300); }
  await page.waitForTimeout(500); await shot('g_intro');
  if (flags.includes('--kick')) { // the user kicks off: power bar, then quit
    await page.evaluate(() => { const g = MATCH._G; g.recvFirst = g.user === g.hid ? g.aid : g.hid; }); await page.click('#mKick').catch(() => { });
    for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!document.querySelector('.kbar.show'))) break; await page.waitForTimeout(150); }
    await page.waitForTimeout(500); await shot('g_kbar'); console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', out); await browser.close(); process.exit(0);
  }
  await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; }); await page.click('#mKick').catch(() => { }); await page.evaluate(() => { MATCH._G.recvFirst = MATCH._G.user; });
  await page.waitForTimeout(450); await shot('g_banner');
  for (let i = 0; i < 160; i++) { const s = await page.evaluate(() => !!document.querySelector('.sheet.show')); if (s) break; await page.waitForTimeout(200); }
  await page.waitForTimeout(600); await shot('g_sheet');
  await page.evaluate(() => { const b = document.querySelector('[data-f="pass"]'); if (b) b.click(); }); await page.waitForTimeout(300); await shot('g_sheet_pass');
  await page.evaluate(() => { const c = [...document.querySelectorAll('.sheet .plist .pc')][1] || document.querySelector('.sheet .pc'); if (c) c.click(); });
  await page.waitForTimeout(1100); await shot('g_presnap');
  const sp = await page.evaluate(() => { const b = document.querySelector('[data-a="snap"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (sp) { if (dpr > 1) await page.touchscreen.tap(sp.x, sp.y); else await page.mouse.click(sp.x, sp.y); }
  for (let i = 0; i < 80; i++) { const s = await page.evaluate(() => MATCH._G.stage === 'live' && MATCH._G.play.liveT > 1.1); if (s) break; await page.waitForTimeout(50); }
  await page.evaluate(() => { MATCH._G.paused = true; }); await page.waitForTimeout(250); await shot('g_live');
  const hud = await page.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const b = e.getBoundingClientRect(); return b.width ? [Math.round(b.x), Math.round(b.y), Math.round(b.right), Math.round(b.bottom)] : null; }; return { sb: r('#hud .sb'), pchip: r('#hud .pchip.show'), hint: r('#gui .hint'), pause: r('.mbtn.pause'), cam: r('.mbtn.camb') }; });
  const ov = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  if (ov(hud.pchip, hud.hint)) notes.push('HUD: ratings chip overlaps hint ' + JSON.stringify(hud)); if (ov(hud.pchip, hud.sb)) notes.push('HUD: ratings chip overlaps scorebug ' + JSON.stringify(hud));
  await page.evaluate(() => { MATCH._G.paused = false; document.querySelector('.mbtn.pause').click(); }); await page.waitForTimeout(450); await shot('g_pause');
  await page.evaluate(() => { const b = document.querySelector('[data-m="cam"]'); if (b) b.click(); }); await page.waitForTimeout(400); await shot('g_camera');
  // worst case for the top-left stack: ratings chip and a long hint both up
  const ol = await page.evaluate(() => { const h = document.querySelector('#gui .hint'), c = document.querySelector('#hud .pchip'); document.querySelector('.campnl').classList.remove('show'); const o = document.querySelector('.ovl'); if (o) o.classList.remove('show');
    h.textContent = 'Drag back to throw · drag forward to run · stick moves the QB'; c.classList.add('show'); const a = c.getBoundingClientRect(), b = h.getBoundingClientRect(); return { chip: [a.left, a.top, a.right, a.bottom].map(Math.round), hint: [b.left, b.top, b.right, b.bottom].map(Math.round), overlap: a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom }; });
  await page.waitForTimeout(300); await shot('g_chip_hint'); if (ol.overlap) notes.push('HUD: chip overlaps hint ' + JSON.stringify(ol));
  if (dpr > 1) { // sideline view turns the game sideways on an upright phone
    await page.evaluate(() => { document.querySelector('#gui .hint').textContent = ''; document.querySelector('#hud .pchip').classList.remove('show'); const b = document.querySelector('[data-cv="side"]'); if (b) b.click(); const x = document.querySelector('[data-cx]'); if (x) x.click(); MATCH._G.paused = false; });
    for (let i = 0; i < 200; i++) { const s = await page.evaluate(() => !!document.querySelector('.sheet.show')); if (s) break; await page.waitForTimeout(200); }
    await page.waitForTimeout(700); await shot('g_rot_sheet'); notes.push('rot: ' + await page.evaluate(() => document.getElementById('game').classList.contains('rot')));
  }
}
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors', notes.length ? '\nNOTES\n' + notes.join('\n') : '', '\n' + out); await browser.close();

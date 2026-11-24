// Depth chart roles + snap shares screenshots: desk and phone, every UI style. run: node tools/build.mjs && node qa/depth_cap.mjs
// shots in qa/shots/depth/. Also checks: no console errors, no horizontal scroll, the editors change the team settings.
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..').replace(/\\/g, '/');
const out = path.join(root, 'qa', 'shots', 'depth'); fs.mkdirSync(out, { recursive: true });
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const styles = (process.argv[2] || 'broadcast,program,varsity,night').split(',');
const problems = [];
for (const [vw, vh, tag] of [[1280, 900, 'desk'], [390, 844, 'phone']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: tag === 'phone' ? 2 : 1, hasTouch: tag === 'phone', isMobile: tag === 'phone' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file:///' + root + '/dist/playcaller.html'); await page.waitForTimeout(400);
  await page.evaluate(() => { NG.slot = 2; createLeague(); pickTeam(L.teams[9].id); startUserGame('instant'); closeModal(); });
  // the editors: pick a deep threat, a 3rd-down back, a custom share, a lock
  await page.evaluate(() => { const T = UT(); go('depth'); SUB.depthSide = 'O'; SUB.depthMode = 'snaps'; render(); });
  const sel = await page.$('.dblk select[onchange*="\'role\',\'WR\',\'X\'"]'); const wr = await page.evaluate(() => UT().depth.WR[2]);
  if (sel) await sel.selectOption(String(wr)); else problems.push(tag + ': no WR deep-threat select');
  const pd = await page.$('.dblk select[onchange*="\'role\',\'RB\',\'PD\'"]'); const rb = await page.evaluate(() => UT().depth.RB[1]); if (pd) await pd.selectOption(String(rb));
  const sh = await page.$$('.dblk select.dsh'); if (sh[1]) await sh[1].selectOption('35');
  const lk = await page.$('.dblk .dlk'); if (lk) await lk.click();
  const chk = await page.evaluate(([wr, rb]) => { const r = UT().rot || {}; return { x: r.roles && r.roles.WR && r.roles.WR.X === wr, pd: r.roles && r.roles.RB && r.roles.RB.PD === rb, custom: r.preset && Object.values(r.preset).includes('custom'), lock: r.lock && Object.keys(r.lock).length === 1, onX: starters(UT(), 'Shotgun', 'O').find(e => e.slot === 'X').pid === wr }; }, [wr, rb]);
  for (const k in chk) if (!chk[k]) problems.push(`${tag}: editor did not set ${k}`);
  for (const st of styles) {
    await page.evaluate(s => { setUiStyle(s); }, st);
    for (const [side, mode] of [['O', 'snaps'], ['D', 'snaps'], ['O', 'order']]) {
      if (tag === 'phone' && st !== 'broadcast' && side === 'D') continue;
      await page.evaluate(([side, mode]) => { SUB.depthSide = side; SUB.depthForm = side === 'O' ? 'Shotgun' : '4-3'; SUB.depthMode = mode; render(); scrollTo(0, 0); }, [side, mode]); await page.waitForTimeout(150);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov > 2) problems.push(`${tag} ${st} ${side} ${mode}: horizontal overflow ${ov}px`);
      await page.screenshot({ path: path.join(out, `${tag}_${st}_${side}_${mode}.png`), fullPage: tag === 'desk' });
      if (tag === 'phone' && mode === 'snaps') { const y = await page.evaluate(() => { const b = [...document.querySelectorAll('.dblk h3')].find(h => h.textContent === (SUB.depthSide === 'O' ? 'WR' : 'DE')); return b ? b.getBoundingClientRect().top + scrollY - 70 : 0; }); await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(100); await page.screenshot({ path: path.join(out, `${tag}_${st}_${side}_${mode}_wr.png`) }); }
    }
  }
  if (errs.length) problems.push(`${tag}: ` + errs.join(' | '));
  await ctx.close();
}
await browser.close();
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'depth chart UI ok'); console.log('shots in ' + out);
process.exit(problems.length ? 1 : 0);

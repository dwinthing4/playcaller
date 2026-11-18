// Which management-screen controls are covered by the invisible (opacity 0, absolute) .say boxes?
import { launch } from './lib.mjs';
for (const which of ['phone', 'desk']) {
  const H = await launch(which, { tag: 'say_' + which, seed: 5 }); const { page } = H;
  await H.newLeague(60, 5);
  for (const tab of ['home', 'plan']) {
    await page.evaluate(t => { go(t); }, tab); await H.wait(400);
    const r = await page.evaluate(() => { const says = [...document.querySelectorAll('#app .say')].map(s => { const c = getComputedStyle(s), b = s.getBoundingClientRect(); return { pos: c.position, op: c.opacity, box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }; });
      const blocked = [...document.querySelectorAll('#app button')].filter(b => { const q = b.getBoundingClientRect(); if (!q.width || q.bottom < 0 || q.top > innerHeight) return false; const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return h && !(h === b || b.contains(h)) && h.closest('.say'); }).map(b => b.textContent.trim().slice(0, 24));
      return { says, blocked }; });
    console.log(which, tab, JSON.stringify(r));
  }
  await H.close();
}

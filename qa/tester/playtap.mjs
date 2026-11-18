// Real tap / click on the home PLAY button centre: does the game open?
import { launch } from './lib.mjs';
for (const which of ['phone', 'desk']) {
  const H = await launch(which, { tag: 'playtap_' + which, seed: 5 }); const { page } = H;
  await H.newLeague(60, 5); await page.evaluate(() => go('home')); await H.wait(400);
  const b = await page.$('button[onclick="startUserGame(\'play\')"]'); const r = await b.boundingBox();
  await H.tapAt(r.x + r.width / 2, r.y + r.height / 2); await H.wait(800);
  const c = await page.evaluate(() => ({ open: !!MATCH._G, hidden: document.getElementById('game').hidden }));
  await H.tapAt(r.x + 6, r.y + r.height / 2); await H.wait(800);
  const e = await page.evaluate(() => ({ open: !!MATCH._G, hidden: document.getElementById('game').hidden }));
  console.log(which, 'PLAY box', JSON.stringify(r), '-> tap centre opens game:', c.open, '| tap left edge opens game:', e.open);
  await H.close();
}

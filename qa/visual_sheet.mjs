// Contact sheet: lay out burst frames (optionally cropped) in a labeled grid so a whole burst can be viewed at once.
// node qa/visual_sheet.mjs out.png cols cellW crop(x,y,w,h|full) file1 file2 ...
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import os from 'os';
const [out, colsS, cellWS, cropS, ...files] = process.argv.slice(2);
const cols = +colsS, cellW = +cellWS;
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const browser = await chromium.launch({ executablePath: exe });
// read the size of the first image via a probe page
const page = await browser.newPage();
const url = f => 'file:///' + path.resolve(f).replace(/\\/g, '/');
const dims = await page.evaluate(async u => { const i = new Image(); i.src = u; await i.decode(); return [i.naturalWidth, i.naturalHeight]; }, url(files[0])).catch(async () => { await page.goto(url(files[0])); return page.evaluate(() => [document.images[0].naturalWidth, document.images[0].naturalHeight]); });
const [iw, ih] = dims;
const [cx, cy, cw, ch] = cropS === 'full' ? [0, 0, iw, ih] : cropS.split(',').map(Number);
const s = cellW / cw, cellH = Math.round(ch * s), rows = Math.ceil(files.length / cols);
const cells = files.map((f, i) => `<div class="c"><div class="im" style="background-image:url('${url(f)}');background-size:${iw * s}px ${ih * s}px;background-position:${-cx * s}px ${-cy * s}px"></div><span>${i}: ${path.basename(f).replace('.png', '')}</span></div>`).join('');
const html = `<html><body style="margin:0;background:#111;font:12px sans-serif;color:#ff0"><div style="display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:4px;padding:4px">${cells}</div>
<style>.c{position:relative}.im{width:${cellW}px;height:${cellH}px;background-repeat:no-repeat}.c span{position:absolute;left:2px;top:2px;background:rgba(0,0,0,.7);padding:1px 4px}</style></body></html>`;
const tmp = path.join(path.dirname(path.resolve(out)), '_sheet.html'); fs.writeFileSync(tmp, html);
await page.setViewportSize({ width: cols * (cellW + 4) + 4, height: rows * (cellH + 4) + 4 });
await page.goto(url(tmp)); await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true }); fs.unlinkSync(tmp);
await browser.close(); console.log('wrote', out, cols + 'x' + rows, 'cell', cellW + 'x' + cellH);

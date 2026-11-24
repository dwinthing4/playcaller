// how long the game page takes to load (a busy machine makes page.goto time out)
import { chromium } from 'playwright-core'; import path from 'path'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const exe = path.join(os.homedir(), 'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe');
const t0 = Date.now(); const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] }); console.log('launch', Date.now() - t0);
const p = await (await b.newContext()).newPage(); p.on('pageerror', e => console.log('ERR', e.message));
const t1 = Date.now(); await p.goto('file:///' + (process.argv[2] || path.join(root, 'dist', 'playcaller.html')).replace(/\\/g, '/'), { waitUntil: 'commit', timeout: 60000 }); console.log('commit', Date.now() - t1);
await p.waitForFunction(() => typeof MATCH !== 'undefined', null, { timeout: 90000 }).catch(() => console.log('no MATCH')); console.log('script', Date.now() - t1);
const t2 = Date.now(); await p.waitForLoadState('load', { timeout: 90000 }).catch(() => console.log('no load')); console.log('load', Date.now() - t1); await b.close();

// node tools/shoot.mjs   ต้องเปิดเซิร์ฟเวอร์ก่อน: python3 -m http.server 8080
// env: BASE=http://localhost:8080/  OVERLAY_K=<key จริง>
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:8080/';
const K = process.env.OVERLAY_K || 'demo';
const SKINS = ['universal','fps','rpg','roblox','block','cyber','light','horror','space','custom'];
const PAGES = { donor: '', admin: '#admin', overlay: `#overlay?k=${K}` };
const WIDTHS = [390, 1280];

const AUDIT = () => {
  const out = [], W = innerWidth;
  const parse = c => { const m = c.match(/[\d.]+/g); if (!m) return null;
    const [r,g,b] = m.slice(0,3).map(v => { v/=255; return v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4; });
    return { L: .2126*r + .7152*g + .0722*b, a: m[3] === undefined ? 1 : +m[3] }; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const x = parse(getComputedStyle(e).backgroundColor); if (x && x.a > .9) return x.L; } return null; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const tag = el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.classList[0] ? '.'+el.classList[0] : '');
    if (r.right > W + 1 || r.left < -1) out.push({ type:'overflow-x', el:tag, right:Math.round(r.right) });
    if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX)) out.push({ type:'clipped', el:tag });
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || (cs.backgroundClip||cs.webkitBackgroundClip) === 'text') continue; // ตัวอักษรไล่เฉด (gradient clip) วัด contrast ตรง ๆ ไม่ได้
      const f = parse(cs.color), b = bgOf(el);
      if (f && b != null) { const cr = (Math.max(f.L,b)+.05)/(Math.min(f.L,b)+.05);
        if (cr < 4.5) out.push({ type:'contrast', el:tag, ratio:+cr.toFixed(2), text:el.textContent.trim().slice(0,30) }); }
    }
  }
  if (document.documentElement.scrollWidth > W) out.push({ type:'page-hscroll', width:document.documentElement.scrollWidth });
  return out.slice(0, 80);
};

const alphaStats = async (page, b64) => page.evaluate(async b64 => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data; let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] === 0) clear++;
  return { transparentRatio: +(clear / (d.length / 4)).toFixed(3), topLeftAlpha: d[3] };
}, b64);

await mkdir('docs/shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }); // ใช้ Chrome จริง ไม่ใช่ Chromium
const report = [];
for (const skin of SKINS) for (const [name, hash] of Object.entries(PAGES)) for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: name === 'overlay' ? 1080 : 900 } });
  await ctx.addInitScript(v => localStorage.setItem('u_theme_v1', v),
    JSON.stringify({ kind:'donate-theme', v:1, skin, a1:'#ff7a00', a2:'#00e5a8' }));
  const p = await ctx.newPage();
  await p.goto(BASE + hash, { waitUntil: 'load' });   // ไม่ใช้ networkidle เพราะ WebSocket ค้างตลอด
  if (name === 'overlay') await p.evaluate(() => (window.RZX && window.RZX.test ? window.RZX.test(500) : (window.testAlert && window.testAlert())));
  await p.waitForTimeout(900);
  const file = `docs/shots/${skin}-${name}-${w}.png`;
  const buf = await p.screenshot({ path: file, fullPage: name !== 'overlay', omitBackground: name === 'overlay' });
  const issues = await p.evaluate(AUDIT);
  if (name === 'overlay') {
    const a = await alphaStats(p, buf.toString('base64'));
    if (a.transparentRatio < 0.5 || a.topLeftAlpha !== 0) issues.push({ type:'overlay-not-transparent', ...a });
    const g = await ctx.newPage();   // ทดสอบพื้นเขียว
    await g.setViewportSize({ width: w, height: 1080 });
    await g.setContent(`<body style="margin:0;background:#00ff00"><iframe src="${BASE}${hash}" style="border:0;width:100vw;height:100vh"></iframe></body>`);
    await g.waitForTimeout(800);
    await g.frames()[1]?.evaluate(() => (window.RZX && window.RZX.test ? window.RZX.test(500) : (window.testAlert && window.testAlert())));
    await g.waitForTimeout(900);
    await g.screenshot({ path: `docs/shots/${skin}-overlay-green-${w}.png` });
  }
  report.push({ skin, page: name, w, file, issues });
  await ctx.close();
}
await browser.close();
await writeFile('docs/shots/report.json', JSON.stringify(report, null, 2));
const bad = report.filter(r => r.issues.length);
console.log(`ถ่าย ${report.length} ชุด, มีปัญหา ${bad.length} ชุด`);
bad.forEach(r => console.log(`- ${r.skin}/${r.page}/${r.w}px:`, r.issues.map(i => i.type + (i.el ? ' ' + i.el : '')).join(', ')));
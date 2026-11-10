const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
let n = 0; const check = (name, fn) => { try { fn(); n++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); throw e; } };

const css = fs.readFileSync(path.join(ROOT, 'tools/theme.css'), 'utf8');
const raw = (css.split('/* @overlay-start')[1] || '').split('/* @overlay-end')[0];
check('มีบล็อก overlay', () => assert.ok(raw.length > 0));
const body = raw.slice(raw.indexOf('*/') + 2);
const rules = [...body.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => ({ sel: m[1].trim().replace(/\s+/g, ' '), decls: m[2] }));
check('มีอย่างน้อย 6 กฎ', () => assert.ok(rules.length >= 6));

const SAFE = new Set(['background-color', 'background-image', 'color', 'box-shadow', 'border-radius', 'text-shadow']);
for (const r of rules) {
  const isRoot = /^html\.u-overlay, html\.u-overlay body$/.test(r.sel);
  for (const [, p] of r.decls.matchAll(/([a-z-]+)\s*:/g))
    check(`${r.sel} → ${p}`, () => assert.ok(SAFE.has(p) || (isRoot && p === 'background'),
      `"${p}" อาจเปลี่ยนขนาด/ตำแหน่งการ์ดหรือพื้นหลัง overlay`));
}
check('html/body โปร่งใส', () => assert.match(body, /html\.u-overlay\s*,\s*html\.u-overlay body\s*\{\s*background:\s*transparent\s*!important/));
const card = rules.find(r => r.sel === 'html.u-overlay #card');
check('การ์ดมีกรอบดำหนา', () => assert.match(card.decls, /0 0 0 var\(--u-bw\) var\(--u-line\)/));
check('การ์ดมีเงาแข็ง blur=0', () => assert.match(card.decls, /var\(--u-depth\) var\(--u-depth\) 0 var\(--u-bw\) var\(--u-shadow\)/));
check('ชื่อใช้สีเน้น', () => assert.match(rules.find(r => r.sel === 'html.u-overlay #aName').decls, /var\(--u-a1-text\)/));
check('ยอดเงินใช้สีเน้น 2', () => assert.match(rules.find(r => r.sel === 'html.u-overlay #aAmt').decls, /var\(--u-a2-text\)/));
const ci = rules.find(r => r.sel === 'html.u-overlay #card .ci');
check('ชั้น .ci ของการ์ดไม่บังพาเลตธีม', () => { assert.match(ci.decls, /background-image:\s*none/); assert.match(ci.decls, /background-color:\s*var\(--u-surface\)/); });
check('background-image ใช้ได้เฉพาะ none', () => { for (const r of rules) for (const [, v] of r.decls.matchAll(/background-image\s*:\s*([^;]+)/g)) assert.equal(v.trim(), 'none', r.sel); });
check('ไม่มี blur/filter (perf)', () => assert.doesNotMatch(body, /blur\(|filter\s*:/));

// ขอบเขต: ซอร์สธีม (ใช้ซ้ำข้ามแบรนด์ได้) ไม่ใช่หน้าโฮสต์ที่เป็นแบรนด์ของเจ้าของ
for (const f of ['tools/theme.css', 'tools/brand.js']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) check(`ไม่มี RZ CLAN ใน ${f}`, () => assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /RZ\s*CLAN/i));
}
console.log(`overlay-css: ${n} checks passed`);
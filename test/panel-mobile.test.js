// แผงธีมต้องไม่แคบเกินไปบนจอ 390px (padding ซ้อนกันเหลือแค่ 271px) และต้องไม่ล้นหน้าจอ
const assert = require('node:assert/strict'), fs = require('node:fs');
const css = fs.readFileSync(__dirname + '/../tools/theme.css', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
let n = 0; const check = (name, fn) => { try { fn(); n++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); throw e; } };
const m = css.match(/@media \(max-width:480px\)\{#u-theme\{([^}]*)\}/);
check('มีกฎมือถือสำหรับ #u-theme', () => assert.ok(m));
check('ดึงแผงขยายออกชดเชย padding ซ้อน', () => assert.match(m[1], /margin-left:-\d+px/));
check('ไม่ขยายเกิน padding ที่ซ้อน (<= 36px ต่อด้าน)', () => {
  const v = +m[1].match(/margin-left:-(\d+)px/)[1]; assert.ok(v > 0 && v <= 36, String(v)); });
check('ฝังลง index.html แล้ว', () => assert.ok(html.includes(m[0])));
console.log(`panel-mobile: ${n} checks passed`);
// --- หัวข้อพาเนลบนมือถือไม่ถูกตัดเป็น … ---
{
  let n2 = 0; const c2 = (name, fn) => { try { fn(); n2++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); throw e; } };
  const h = css.match(/@media \(max-width:480px\)\{#vDonor \.hdr\{([^}]*)\}#vDonor \.hdr h3\{([^}]*)\}\}/);
  c2('มีกฎให้หัวข้อพาเนลขึ้นบรรทัดใหม่บนมือถือ', () => assert.ok(h));
  c2('.hdr wrap ได้', () => assert.match(h[1], /flex-wrap:wrap/));
  c2('h3 ไม่ nowrap/ellipsis', () => { assert.match(h[2], /white-space:normal/); assert.match(h[2], /text-overflow:clip/); });
  c2('ฝังลง index.html แล้ว', () => assert.ok(html.includes(h[0])));
  console.log(`panel-mobile (headings): ${n2} checks passed`);
}

const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), T = require('../tools/brand.js');
let n = 0; const check = (name, fn) => { try { fn(); n++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0]); throw e; } };
const mock = () => { const m = { currentTime: 0, destination: {}, starts: [], stops: [], gains: [] };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  m.createGain = () => { const g = { gain: param(), connect() {} }; m.gains.push(g); return g; };
  m.createOscillator = () => ({ type: '', frequency: param(), connect() {}, start: t => m.starts.push(t), stop: t => m.stops.push(t) });
  return m; };

for (const pack of ['coin', 'laser', 'levelup']) {
  const ctx = mock(), d = T.playPack(pack, ctx, 1);
  check(`${pack} มีโน้ต`, () => assert.ok(ctx.starts.length >= 1));
  check(`${pack} สั้นกว่า 1 วินาที`, () => assert.ok(d > 0.1 && d < 1));
  check(`${pack} stop ครบ`, () => assert.equal(ctx.stops.length, ctx.starts.length));
  check(`${pack} gain ≤ 0.25`, () => assert.ok(ctx.gains[0].gain.value <= 0.25));
}
check('classic ไม่สร้างเสียงใหม่', () => { const c = mock(); assert.equal(T.playPack('classic', c, 1), 0); assert.equal(c.starts.length, 0); });
check('vol=0 เงียบ', () => { const c = mock(); T.playPack('coin', c, 0); assert.equal(c.gains[0].gain.value, 0); });
check('ทุกธีมมีเสียง auto', () => T.SKINS.forEach(s => assert.ok(['coin', 'laser', 'levelup'].includes(T.AUTO_SFX[s]), s)));
check('auto ของ fps = laser', () => assert.equal(T.packFor({ skin: 'fps', sfx: 'auto' }), 'laser'));
check('ไม่ใช้ไฟล์เสียงภายนอก', () => {
  const src = fs.readFileSync(path.join(__dirname, '../tools/brand.js'), 'utf8');
  const sec = src.split('// @u-theme-start')[1].split('// @u-theme-end')[0];
  assert.doesNotMatch(sec, /\.(mp3|wav|ogg|m4a)\b|new Audio\(|fetch\(/);
});
console.log(`sfx-packs: ${n} checks passed`);
// Persona alert layer must be a CONTAINED calling-card frame (no full-screen slash / flash / shake / scattered text).
// Source-level checks on the shipped index.html + tools/p5.js. Run: node test/p5-contained-alert.test.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const JS = fs.readFileSync(path.join(root, 'tools/p5.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + l); };

const m = HTML.match(/const ALERT_CSS = String\.raw`([\s\S]*?)`;/);
ok(!!m, 'ALERT_CSS block is embedded in index.html');
const CSS = m ? m[1] : '';
const emb = HTML.match(/<script id="p5-js">([\s\S]*?)<\/script>/);
ok(!!emb && emb[1].includes('const ALERT_CSS'), 'index.html embeds the current tools/p5.js');

// --- the frame ---
for (const sel of ['.plate', '.plate2', '.sl.t', '.sl.b', '.tag', '.bit']) ok(CSS.includes('#p5-alert ' + sel), 'frame piece styled: ' + sel);
ok(/#p5-alert\{[^}]*width:0;height:0/.test(CSS), 'layer starts at 0x0 and is sized to #card by fit() (never to the viewport)');
ok(/fit\(\)/.test(JS) && /getBoundingClientRect/.test(JS), 'layer is fitted by READING #card geometry (getBoundingClientRect)');
ok(/layer\.append\(el\('i', 'plate'\), el\('i', 'plate2'\)/.test(JS), 'fire() builds the calling-card plates');
ok(/MEGA \\u2605/.test(JS), 'mega tier gets a distinct tag');

// --- removed: full-screen effects ---
ok(!/\.slash/.test(CSS) && !/el\('i', 'slash/.test(JS), 'no full-width slash bands');
ok(!/flashbang/.test(CSS + JS), 'no screen flash');
ok(!/p5-mega|@keyframes p5m|#shaker/.test(CSS + JS), 'no stage/screen shake');
ok(!/[0-9.]+(vh|vw)/.test(CSS), 'alert CSS uses no viewport units (nothing can span the screen)');
ok(!/inset:-/.test(CSS), 'no negative-inset full-bleed layers');
ok(!/filter\s*:|blur\(|backdrop-filter/.test(CSS), 'no blur / filter (OBS performance rule)');
const cfg = JS.match(/alert:\s*\{[^\n]*\}/);
ok(cfg && !/slashMs/.test(cfg[0]) && /std: 14/.test(cfg[0]), 'config: slashMs removed, shard counts reduced');

// --- never touch the card's geometry ---
const cardRules = (CSS.match(/[^{}]*#card[^{}]*\{[^}]*\}/g) || []).join('\n');
const geo = /(^|[;{\s])(width|height|padding|margin|top|left|right|bottom|position)\s*:/;
ok(!geo.test(cardRules.replace(/animation-[a-z-]+\s*:[^;]*/g, '')), '#card rules in alert CSS set no width/height/padding/margin/position');
ok(!/card\.style\./.test(JS), 'p5.js never writes inline styles onto #card');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);

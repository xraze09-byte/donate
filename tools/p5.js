// @p5-start — Persona skin runtime: cursor-reactive shadows, ransom title, intro loader, Three.js scene, cinematic alert layer,
// and the form-side wiring for DonationGuard. ไม่แก้ play()/SHIELD/SPAM/socket/TTS/queue/SLIPH — สังเกตการเปลี่ยนคลาส/DOM เท่านั้น
(function (root) {
  'use strict';
  const doc = root.document;

  /* ================= ค่าที่ปรับได้ (ลบ/แก้ที่นี่ที่เดียว) ================= */
  const CONFIG = {
    intro:  { enabled: true, durationMs: 1700, skipIfSeenMs: 6 * 3600e3, wordA: 'TAKE YOUR', wordB: 'HEART' },
    scene:  { enabled: true, cdn: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', shards: 26, stars: 5,
              parallax: 0.55, spin: 0.35, maxPixelRatio: 1.5, targetFps: 60, lowPowerShards: 10 },
    shake:  { perThousand: 0.35, max: 1.6, decay: 0.9 },       // กล้องสั่นตามยอดที่พิมพ์
    burst:  { particles: 90, speed: 0.55, life: 1.1 },         // ระเบิดตอนกดส่ง
    alert:  { enabled: true, megaAt: 1000, bigAt: 300, letterStaggerMs: 38, particles: { std: 14, big: 22, mega: 34 },
            tierMap: { 'RECRUIT': 'std', 'SOLDIER': 'std', 'ELITE': 'big', 'LEGEND': 'mega', 'GOD TIER': 'mega' } },
    splatter: true,
    form:   { minFillMs: true, extraCooldown: false }   // extraCooldown: ด่านถี่เสริม (ค่าเริ่มต้นปิด เพราะ SPAM เดิม 20 วิ + จำกัด pending 3 มีอยู่แล้ว)
  };

  const skin = () => doc.documentElement.getAttribute('data-skin');
  const isOverlay = () => /^#(overlay|obs)/.test(root.location.hash);
  const isAdmin = () => /^#admin/.test(root.location.hash);
  const isDonor = () => !isOverlay() && !isAdmin();
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) || doc.documentElement.getAttribute('data-u-motion') === 'off';
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  /* ================= 1) เงา/ปุ่มตอบสนองเมาส์ (ตัวแปร CSS ล้วน ไม่ re-layout) ================= */
  const mouse = { x: 0, y: 0 };
  function bindPointer() {
    if (bindPointer.done) return; bindPointer.done = true;
    let raf = 0;
    const set = (cx, cy) => { mouse.x = (cx / root.innerWidth) * 2 - 1; mouse.y = (cy / root.innerHeight) * 2 - 1;
      if (!raf) raf = root.requestAnimationFrame(() => { raf = 0; const s = doc.documentElement.style;
        s.setProperty('--p5-mx', mouse.x.toFixed(3)); s.setProperty('--p5-my', mouse.y.toFixed(3)); }); };
    root.addEventListener('pointermove', e => set(e.clientX, e.clientY), { passive: true });
    root.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) set(t.clientX, t.clientY); }, { passive: true });
  }

  /* ================= 2) ransom-note title ================= */
  function ransomize(node) {
    if (!node || node.dataset.p5r) return; node.dataset.p5r = '1';
    const txt = (node.textContent || '').trim(); if (!txt) return;
    node.setAttribute('aria-label', txt);
    const wrap = el('span', 'p5-ransom'); wrap.setAttribute('aria-hidden', 'true');
    for (const ch of Array.from(txt)) wrap.append(ch === ' ' ? el('span', '', '\u00A0') : el('span', '', ch));
    node.textContent = ''; node.append(wrap);
  }
  function titles() { if (skin() === 'persona' && isDonor()) doc.querySelectorAll('#vDonor h1 .glitch').forEach(ransomize); }

  /* ================= 3) INTRO LOADER ================= */
  const INTRO_KEY = 'p5_intro_seen';
  function shouldIntro() {
    if (!CONFIG.intro.enabled || skin() !== 'persona' || !isDonor() || reduced()) return false;
    try { const t = +root.sessionStorage.getItem(INTRO_KEY) || 0; if (t && Date.now() - t < CONFIG.intro.skipIfSeenMs) return false; } catch (e) { /* ok */ }
    return true;
  }
  function runIntro(done) {
    if (doc.getElementById('p5-intro')) return;
    const box = el('div'); box.id = 'p5-intro'; box.setAttribute('role', 'status'); box.setAttribute('aria-label', 'Loading');
    const dur = CONFIG.intro.durationMs;
    for (let i = 0; i < 7; i++) { const s = el('div', 'p5-stripe'); s.style.top = (i * 15 - 6) + '%'; s.style.setProperty('--d', (i * 0.06).toFixed(2) + 's'); box.append(s); }
    [[-14, 22, 0.15], [9, 70, 0.3]].forEach(([a, top, d]) => { const c = el('div', 'p5-chain'); c.style.setProperty('--a', a + 'deg'); c.style.top = top + '%'; c.style.setProperty('--d', d + 's'); box.append(c); });
    const word = el('div', 'p5-word'); word.append(doc.createTextNode(CONFIG.intro.wordA + ' '), el('em', '', CONFIG.intro.wordB)); box.append(word);
    const bar = el('div', 'p5-bar'), fill = el('i'); fill.style.setProperty('--dur', (dur / 1000 - 0.35).toFixed(2) + 's'); bar.append(fill); box.append(bar);
    const pct = el('div', 'p5-pct', '0%'); box.append(pct);
    box.append(el('div', 'p5-half a'), el('div', 'p5-half b'));
    box.classList.add('on'); doc.body.append(box);
    const t0 = performance.now();
    (function tick() { const p = Math.min(1, Math.max(0, (performance.now() - t0 - 350) / (dur - 350))); pct.textContent = Math.round(p * 100) + '%'; if (p < 1 && box.isConnected) root.requestAnimationFrame(tick); })();
    const finish = () => { box.classList.add('slash'); setTimeout(() => { box.remove(); try { root.sessionStorage.setItem(INTRO_KEY, String(Date.now())); } catch (e) { /* ok */ } done && done(); }, 620); };
    setTimeout(finish, dur);
    box.addEventListener('click', finish, { once: true });   // แตะข้ามได้
    root.__p5IntroFinish = finish;
  }

  /* ================= 4) THREE.JS SCENE (donor page เท่านั้น) ================= */
  let S = null;        // scene state
  let loadingThree = null;
  function loadThree() {
    if (root.THREE) return Promise.resolve(root.THREE);
    if (loadingThree) return loadingThree;
    loadingThree = new Promise((res, rej) => {
      const s = doc.createElement('script'); s.src = CONFIG.scene.cdn; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (root.THREE ? res(root.THREE) : rej(new Error('no THREE'))); s.onerror = () => rej(new Error('load failed'));
      doc.head.append(s);
    });
    return loadingThree;
  }
  function webglOK() { try { const c = doc.createElement('canvas'); return !!(root.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }

  async function startScene() {
    if (S || !CONFIG.scene.enabled || skin() !== 'persona' || !isDonor() || reduced() || !webglOK()) return;
    let THREE; try { THREE = await loadThree(); } catch (e) { return; }     // CDN ล่ม = ไม่มี 3D เฉยๆ ฟอร์มไม่กระทบ
    if (S || skin() !== 'persona' || !isDonor()) return;
    const cv = doc.createElement('canvas'); cv.id = 'p5-3d'; cv.setAttribute('aria-hidden', 'true'); doc.body.prepend(cv);
    const low = (root.navigator.hardwareConcurrency || 4) <= 4 || /Mobi|Android/i.test(root.navigator.userAgent);
    let renderer; try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: !low, powerPreference: 'high-performance' }); } catch (e) { cv.remove(); return; }
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, CONFIG.scene.maxPixelRatio)); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, 1, 0.1, 100); cam.position.z = 9;
    const RED = 0xe60012, WHITE = 0xffffff, BLACK = 0x0a0a0a;
    scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 4, 6); scene.add(key);
    const rim = new THREE.PointLight(RED, 1.4, 30); rim.position.set(-5, -2, 4); scene.add(rim);

    // ดาวห้าแฉก 3 มิติ (สัญลักษณ์การ์ดโจร) — extrude จากรูป 2D
    function starGeo(R, r) { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; const x = Math.cos(a) * rad, y = Math.sin(a) * rad; i ? sh.lineTo(x, y) : sh.moveTo(x, y); } sh.closePath();
      return new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 }); }
    const sGeo = starGeo(1, 0.45), shardGeo = new THREE.TetrahedronGeometry(0.5), cardGeo = new THREE.BoxGeometry(2.6, 1.5, 0.08);
    const mats = [new THREE.MeshStandardMaterial({ color: RED, roughness: 0.4, metalness: 0.2, flatShading: true }),
                  new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.5, flatShading: true }),
                  new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.6, flatShading: true })];
    const items = [], rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < CONFIG.scene.stars; i++) { const m = new THREE.Mesh(sGeo, mats[i % 2]); m.position.set(rnd(-7, 7), rnd(-4, 4), rnd(-4, 1)); m.scale.setScalar(rnd(0.5, 1.1)); items.push({ m, vr: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-.5, .5)).multiplyScalar(.5), vy: rnd(.1, .3), ph: rnd(0, 6.28), z: m.position.z }); scene.add(m); }
    const nShard = low ? CONFIG.scene.lowPowerShards : CONFIG.scene.shards;
    for (let i = 0; i < nShard; i++) { const m = new THREE.Mesh(shardGeo, mats[i % 3]); m.position.set(rnd(-9, 9), rnd(-5, 5), rnd(-6, 0)); m.scale.setScalar(rnd(0.3, 1)); items.push({ m, vr: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)), vy: rnd(.1, .4), ph: rnd(0, 6.28), z: m.position.z }); scene.add(m); }
    // Calling card (กลาง) เอียงตามเมาส์
    const card = new THREE.Mesh(cardGeo, [mats[1], mats[1], mats[1], mats[1], mats[1], mats[0]]); card.position.set(0, 0.2, -2.5); scene.add(card);
    // อนุภาคระเบิด
    const N = CONFIG.burst.particles, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pLife = new Float32Array(N);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: WHITE, size: 0.11, transparent: true, opacity: 0.95, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);

    S = { THREE, renderer, scene, cam, cv, items, card, pts, pPos, pVel, pLife, shake: 0, boost: 0, spin: 0, raf: 0, running: true, last: 0, low, burstN: N };
    function size() { const w = root.innerWidth, h = root.innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    size(); root.addEventListener('resize', size, { passive: true });
    cv.classList.add('on');
    const frameMs = 1000 / CONFIG.scene.targetFps, clock = new THREE.Clock();
    function loop(now) {
      if (!S || !S.running) { if (S) S.raf = 0; return; }
      S.raf = root.requestAnimationFrame(loop);
      if (now - S.last < frameMs - 1) return; S.last = now;
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      cam.position.x += (mouse.x * CONFIG.scene.parallax - cam.position.x) * 0.06;
      cam.position.y += (-mouse.y * CONFIG.scene.parallax * 0.7 - cam.position.y) * 0.06;
      if (S.shake > 0.01) { cam.position.x += (Math.random() - .5) * S.shake * .3; cam.position.y += (Math.random() - .5) * S.shake * .3; S.shake *= CONFIG.shake.decay; } else S.shake = 0;
      cam.lookAt(0, 0, -1);
      const spin = CONFIG.scene.spin + S.boost; S.boost *= 0.94;
      for (const it of items) { it.m.rotation.x += it.vr.x * dt * spin; it.m.rotation.y += it.vr.y * dt * spin; it.m.rotation.z += it.vr.z * dt * spin;
        it.m.position.y += Math.sin(t * it.vy + it.ph) * 0.004; }
      card.rotation.y += (mouse.x * 0.6 - card.rotation.y) * 0.08; card.rotation.x += (mouse.y * 0.4 - card.rotation.x) * 0.08;
      card.rotation.z = Math.sin(t * .6) * .05 + S.spin; S.spin *= 0.92;
      for (let i = 0; i < S.burstN; i++) {
        if (pLife[i] > 0) { pLife[i] -= dt / CONFIG.burst.life; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; pVel[i * 3 + 1] -= dt * 1.2; }
        else pPos[i * 3 + 2] = -999;
      }
      pGeo.attributes.position.needsUpdate = true;
      renderer.render(scene, cam);
    }
    S.loop = loop; S.raf = root.requestAnimationFrame(loop);
    // หยุดวาดเมื่อแท็บถูกซ่อน (ประหยัดแบตเตอรี่) แล้วเริ่มใหม่เมื่อกลับมา — ไม่มีลูปซ้อน
    doc.addEventListener('visibilitychange', () => {
      if (!S) return;
      if (doc.hidden) { S.running = false; if (S.raf) root.cancelAnimationFrame(S.raf); S.raf = 0; }
      else if (!S.running) { S.running = true; S.last = 0; clock.getDelta(); if (!S.raf) S.raf = root.requestAnimationFrame(S.loop); }
    });
  }
  function stopScene() { if (!S) return; S.running = false; root.cancelAnimationFrame(S.raf); try { S.renderer.dispose(); } catch (e) { /* ok */ } S.cv.remove(); S = null; }

  // API ที่ฟอร์มเรียก: สั่นกล้องตามยอด / ระเบิด / หมุนเร็ว
  const scene3d = {
    typing(amount) { if (!S) return; const a = Number(amount) || 0; S.shake = Math.min(CONFIG.shake.max, Math.max(S.shake, (a / 1000) * CONFIG.shake.perThousand)); S.boost = Math.min(6, S.boost + Math.min(2, a / 1500)); },
    burst(power) { if (!S) return; const n = S.burstN, v = CONFIG.burst.speed * (power || 1);
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), sp = (0.4 + Math.random()) * v * 6;
        S.pPos[i * 3] = 0; S.pPos[i * 3 + 1] = 0; S.pPos[i * 3 + 2] = -2; S.pVel[i * 3] = Math.sin(b) * Math.cos(a) * sp; S.pVel[i * 3 + 1] = Math.sin(b) * Math.sin(a) * sp; S.pVel[i * 3 + 2] = Math.cos(b) * sp; S.pLife[i] = 1; }
      S.shake = Math.max(S.shake, 1.2 * (power || 1)); S.boost += 4 * (power || 1); S.spin += 6.283; },
    get active() { return !!S; }
  };

  /* ================= 5) FORM WIRING + GUARD ================= */
  function wireForm() {
    const G = root.DonationGuard, form = doc.getElementById('dForm'); if (!G || !form || form.dataset.p5g) return; form.dataset.p5g = '1';
    // honeypot: มองไม่เห็นสำหรับคน, tabindex=-1, autocomplete=off, ไม่ใช้ชื่อ "website/url" ที่ autofill ชอบเติม
    const hp = el('div'); hp.setAttribute('aria-hidden', 'true'); hp.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden';
    const hpIn = el('input'); hpIn.type = 'text'; hpIn.name = 'p5_trap_' + Math.random().toString(36).slice(2, 7); hpIn.tabIndex = -1; hpIn.autocomplete = 'off'; hpIn.id = 'p5Trap'; hp.append(hpIn);
    const tok = el('input'); tok.type = 'hidden'; tok.id = 'p5Csrf'; form.append(hp, tok);
    let shownAt = Date.now(); const store = root.sessionStorage;
    // เวลากรอกวัดจาก "การโต้ตอบของคนจริง" (event.isTrusted) ไม่ใช่เวลาโหลดหน้า: บอทที่ยิง event เองไม่มี isTrusted
    // และคนที่เปิดหน้าค้างไว้นานก็ไม่ถูกปฏิเสธ (วัดจากการแตะครั้งแรกในฟอร์ม)
    let humanAt = 0, humanTouches = 0;
    const touch = e => { if (e.isTrusted) { if (!humanAt) humanAt = Date.now(); humanTouches++; } };
    ['keydown', 'pointerdown', 'input', 'focusin'].forEach(t => form.addEventListener(t, touch, true));
    const newToken = () => { try { tok.value = G.issueToken(store); } catch (e) { tok.value = ''; } shownAt = Date.now(); };
    newToken();

    // ด่านเสริมก่อน handler เดิม (capture): ถ้าไม่ผ่านจะ stopImmediatePropagation → submit เดิม/openPay ไม่ถูกเรียก
    form.addEventListener('submit', e => {
      const stop = (msg) => { e.preventDefault(); e.stopImmediatePropagation(); const t = doc.getElementById('toast'); if (t) { t.textContent = '!! ' + msg; t.classList.remove('good'); t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); } };
      const bot = G.botCheck({ honeypot: hpIn.value, shownAt: CONFIG.form.minFillMs && humanAt ? humanAt : 0 });
      if (bot.bot) return stop(bot.why === 'honeypot' ? 'ตรวจพบพฤติกรรมอัตโนมัติ' : 'กรอกเร็วเกินไป ลองใหม่อีกครั้ง');
      if (!G.consumeToken(store, tok.value)) { newToken(); return stop('เซสชันหมดอายุ กรุณากดส่งอีกครั้ง'); }
      newToken();
      const amtEl = doc.getElementById('dAmt'), nameEl = doc.getElementById('dName'), msgEl = doc.getElementById('dMsg');
      const a = G.parseAmount(amtEl && amtEl.value); if (!a.ok) return stop('ยอดเงินไม่ถูกต้อง: ' + a.why);
      const cd = CONFIG.form.extraCooldown ? G.cooldown(store) : { ok: true };
      if (!cd.ok) return stop('ส่งถี่เกินไป รออีก ' + cd.wait + ' วินาที');
      const cfg = G.linkConfig(root.localStorage);
      if (nameEl && G.hasLink(nameEl.value, cfg)) return stop('ชื่อห้ามมีลิงก์');
      if (msgEl) { if (cfg.mode === 'drop' && G.hasLink(msgEl.value, cfg)) return stop('ข้อความห้ามมีลิงก์'); msgEl.value = G.stripLinks(msgEl.value, cfg); }
      if (nameEl) nameEl.value = G.cleanText(nameEl.value, 24);
      if (msgEl) msgEl.value = G.cleanText(msgEl.value, 120);
      cd.mark && cd.mark(); scene3d.burst(Math.min(2.2, 0.8 + a.value / 1500));
    }, true);

    const amt = doc.getElementById('dAmt'); if (amt) amt.addEventListener('input', () => scene3d.typing(amt.value));
  }

  /* ================= 6) CINEMATIC ALERT LAYER (OBS + preview) =================
     เพิ่มชั้นตกแต่งเป็นลูกของ #stage (pointer-events:none, absolute) → ไม่แตะ #card ขนาด/ตำแหน่งเดิม
     ขับด้วย MutationObserver บน #card.in และ #stage.active ; ข้อความถูกอ่านผ่าน textContent เท่านั้น */
  function alertLayer() {
    const stage = doc.getElementById('stage'), card = doc.getElementById('card'); if (!stage || !card || stage.dataset.p5a) return; stage.dataset.p5a = '1';
    const layer = el('div'); layer.id = 'p5-alert'; layer.setAttribute('aria-hidden', 'true'); stage.append(layer);
    const css = doc.createElement('style'); css.id = 'p5-alert-css'; css.textContent = ALERT_CSS; doc.head.append(css);
        let lastIn = false;
    const G = root.DonationGuard;
    // วางเลเยอร์ทับกรอบของ #card (อ่านขนาดอย่างเดียว ไม่เขียนอะไรลง #card)
    const fit = () => { const r = card.getBoundingClientRect(), o = stage.getBoundingClientRect(); if (!r.width || !r.height) return;
      layer.style.left = (r.left - o.left) + 'px'; layer.style.top = (r.top - o.top) + 'px'; layer.style.width = r.width + 'px'; layer.style.height = r.height + 'px'; layer.style.right = 'auto'; layer.style.bottom = 'auto'; };
    const fire = () => {
      if (!CONFIG.alert.enabled || skin() !== 'persona' || reduced()) return;
      // #aAmt ยังเป็น '0' ตอนการ์ดเด้ง (ตัวเลขนับขึ้นทีหลัง) จึงอ่านระดับจากชื่อ tier ที่ play() ตั้งไว้ก่อนแล้ว
      // (ตารางระดับเดิมของระบบเป็นแหล่งความจริงเดียว) ถ้าไม่รู้จักชื่อ ค่อย fallback ไปใช้ตัวเลขยอด
      const tierName = String((doc.getElementById('aTier') || {}).textContent || '').trim().toUpperCase();
      const amtN = Number(String((doc.getElementById('aAmt') || {}).textContent || '0').replace(/,/g, '')) || 0;
      const tier = CONFIG.alert.tierMap[tierName] || (G ? G.tierFor(amtN, { mega: CONFIG.alert.megaAt, big: CONFIG.alert.bigAt }) : 'std');
      layer.className = 't-' + tier; layer.replaceChildren();
      // กรอบ "calling card" ติดขอบการ์ด: แผ่นหลัง 2 แผ่น + เส้นฟัน 2 เส้น + ป้ายระดับ (ไม่มีแถบเต็มจอ/แฟลช/จอสั่น)
      layer.append(el('i', 'plate'), el('i', 'plate2'), el('i', 'sl t'), el('i', 'sl b'));
      const tag = el('b', 'tag'); tag.textContent = (tier === 'mega' ? 'MEGA \u2605 ' : '') + (tierName || 'ALERT'); layer.append(tag);
      fit(); void layer.offsetWidth;
      const n = CONFIG.alert.particles[tier] || 14, reach = tier === 'mega' ? 220 : tier === 'big' ? 180 : 150;
      for (let i = 0; i < n; i++) { const p = el('b', 'bit'); const side = i % 4, u = Math.random(), ang = Math.random() * 6.283, d = 60 + Math.random() * reach;
        p.style.setProperty('--x', side === 0 ? u * 100 + '%' : side === 1 ? '100%' : side === 2 ? u * 100 + '%' : '0%');
        p.style.setProperty('--y', side === 0 ? '0%' : side === 1 ? u * 100 + '%' : side === 2 ? '100%' : u * 100 + '%');
        p.style.setProperty('--dx', Math.round(Math.cos(ang) * d) + 'px'); p.style.setProperty('--dy', Math.round(Math.sin(ang) * d) + 'px');
        p.style.setProperty('--s', (4 + Math.random() * (tier === 'mega' ? 10 : 7)).toFixed(1) + 'px');
        p.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg'); p.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's'; if (i % 3 === 0) p.classList.add('w'); layer.append(p); }
      // การ์ดมี animation เข้า: วัดซ้ำสั้น ๆ ให้เฟรมตามตำแหน่งจริง (อ่านอย่างเดียว)
      let k = 0; const iv = root.setInterval(() => { fit(); if (++k > 12) root.clearInterval(iv); }, 80);
      kinetic();
    };
    // ตัวอักษรเด้งทีละตัว: ห่อ node ที่มีอยู่ด้วย span โดยไม่เปลี่ยนค่า textContent ของ #aName (การทดสอบเดิม/TTS อ่านค่านี้)
    function kinetic() {
      for (const id of ['aName', 'aAmt']) { const n = doc.getElementById(id); if (!n || n.dataset.p5k === n.textContent) continue; n.dataset.p5k = n.textContent; n.classList.remove('p5-k'); void n.offsetWidth; n.classList.add('p5-k');
        n.style.setProperty('--stag', CONFIG.alert.letterStaggerMs + 'ms'); }
      const msg = doc.getElementById('aMsg'); if (msg) { msg.classList.remove('p5-k2'); void msg.offsetWidth; msg.classList.add('p5-k2'); }
    }
    const mo = new MutationObserver(() => { const nowIn = card.classList.contains('in') && !card.classList.contains('out'); if (nowIn && !lastIn) fire(); lastIn = nowIn; });
    mo.observe(card, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(() => { if (!stage.classList.contains('active')) { layer.replaceChildren(); layer.className = ''; } }).observe(stage, { attributes: true, attributeFilter: ['class'] });
  }
  // อนุญาตเฉพาะคุณสมบัติที่ไม่ขยับ/ไม่ย่อขยายการ์ด: ทุกอย่างอยู่ใน #p5-alert (absolute, inset:0, pointer-events:none)
  const ALERT_CSS = String.raw`
#p5-alert{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:8;overflow:visible}
#p5-alert:empty{display:none}
#p5-alert .plate,#p5-alert .plate2{position:absolute;inset:0;opacity:0}
#p5-alert .plate{background:#e60012;clip-path:polygon(0 12%,8% 0,100% 0,100% 88%,92% 100%,0 100%);transform:translate(-9px,8px) rotate(-1.6deg)}
#p5-alert .plate2{background:#000;border:3px solid #fff;box-sizing:border-box;clip-path:polygon(0 8%,6% 0,100% 0,100% 92%,94% 100%,0 100%);transform:translate(8px,-7px) rotate(1.2deg)}
html[data-skin="persona"] #p5-alert .plate{animation:p5pl .42s cubic-bezier(.2,1.5,.35,1) forwards}
html[data-skin="persona"] #p5-alert .plate2{animation:p5pl2 .42s .05s cubic-bezier(.2,1.5,.35,1) forwards}
@keyframes p5pl{0%{opacity:0;transform:translate(60px,30px) rotate(-8deg) scale(.9)}100%{opacity:1;transform:translate(-9px,8px) rotate(-1.6deg) scale(1)}}
@keyframes p5pl2{0%{opacity:0;transform:translate(-60px,-30px) rotate(8deg) scale(.9)}100%{opacity:1;transform:translate(8px,-7px) rotate(1.2deg) scale(1)}}
#p5-alert .sl{position:absolute;height:7px;width:46%;opacity:0;transform:skewX(-35deg)}
#p5-alert .sl.t{top:-14px;left:-4%;background:#e60012;border-bottom:3px solid #000}
#p5-alert .sl.b{bottom:-14px;right:-4%;background:#fff;border-top:3px solid #000}
html[data-skin="persona"] #p5-alert .sl.t{animation:p5st .34s .18s cubic-bezier(.2,.9,.1,1) forwards}
html[data-skin="persona"] #p5-alert .sl.b{animation:p5sb .34s .24s cubic-bezier(.2,.9,.1,1) forwards}
@keyframes p5st{from{opacity:0;transform:translateX(-80px) skewX(-35deg)}to{opacity:1;transform:translateX(0) skewX(-35deg)}}
@keyframes p5sb{from{opacity:0;transform:translateX(80px) skewX(-35deg)}to{opacity:1;transform:translateX(0) skewX(-35deg)}}
#p5-alert .tag{position:absolute;left:14px;top:-20px;background:#fff;color:#000;font:900 15px/1 var(--p5-display,Impact,sans-serif);letter-spacing:.14em;text-transform:uppercase;
  padding:5px 12px 4px;transform:skewX(-10deg) rotate(-2deg);border-left:6px solid #e60012;opacity:0;box-shadow:3px 3px 0 #000}
html[data-skin="persona"] #p5-alert .tag{animation:p5tg .3s .3s cubic-bezier(.2,1.7,.3,1) forwards}
@keyframes p5tg{from{opacity:0;transform:skewX(-10deg) rotate(-12deg) scale(1.8)}to{opacity:1;transform:skewX(-10deg) rotate(-2deg) scale(1)}}
#p5-alert.t-mega .plate{background:linear-gradient(135deg,#e60012 55%,#fff 55% 62%,#e60012 62%)}
#p5-alert.t-mega .tag{background:#e60012;color:#fff;border-left-color:#fff}
#p5-alert .bit{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);background:#e60012;opacity:0;clip-path:polygon(50% 0,100% 100%,0 100%);
  animation:p5b .8s cubic-bezier(.12,.7,.3,1) forwards}
#p5-alert .bit.w{background:#fff}
@keyframes p5b{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--r))}}
html[data-skin="persona"] #aName.p5-k,html[data-skin="persona"] #aAmt.p5-k{animation:p5k .5s cubic-bezier(.2,1.9,.35,1) both}
@keyframes p5k{0%{opacity:0;letter-spacing:.5em;transform:scale(2.2) skewX(-14deg)}100%{opacity:1;letter-spacing:inherit;transform:scale(1) skewX(0)}}
html[data-skin="persona"] #aMsg.p5-k2{animation:p5k2 .45s ease-out .25s both}
@keyframes p5k2{0%{opacity:0;transform:translateY(14px) skewX(-10deg)}100%{opacity:1;transform:none}}
html[data-skin="persona"] #card.in:not(.out){animation-name:p5pop!important;animation-timing-function:cubic-bezier(.2,1.7,.35,1)!important}
@keyframes p5pop{0%{opacity:0;transform:scale(.4) rotate(-9deg)}60%{opacity:1;transform:scale(1.07) rotate(1.5deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@media (prefers-reduced-motion:reduce){#p5-alert{display:none}}
`;

  /* ================= boot ================= */
  function boot() {
    bindPointer();
    const run = () => {
      titles();
      if (isDonor()) { wireForm(); if (skin() === 'persona') startScene(); } else stopScene();
      alertLayer();
    };
    run();
    root.addEventListener('hashchange', run);
    new MutationObserver(() => { if (skin() !== 'persona') stopScene(); else run(); }).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-skin'] });
    if (shouldIntro()) runIntro();
  }
  if (!root.__P5) {
    root.__P5 = { CONFIG, scene3d, runIntro, shouldIntro, ransomize };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
// @p5-end

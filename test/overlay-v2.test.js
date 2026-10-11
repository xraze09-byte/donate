// RZX Overlay Extension v2 (compact alert) + app integration. Real index.html in jsdom.
// jsdom has no layout engine => we verify config/class/CSS wiring, link compatibility and behaviour, not pixels.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(url,pre){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const socks=[];
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+url,virtualConsole:vc,
  beforeParse(w){
   /* jsdom has no media playback; real browsers do. Stub so TTS unlock/play on click doesn't surface as a jsdom 'Not implemented' error */
   w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};
   class WS{constructor(u){this.url=u;this.readyState=1;this._l={};socks.push(this);setTimeout(()=>this.onopen&&this.onopen({}),0)}
     send(){}close(){this.readyState=3}addEventListener(t,f){(this._l[t]=this._l[t]||[]).push(f)}removeEventListener(){}
     _emit(d){const ev={data:JSON.stringify(d)};this.onmessage&&this.onmessage(ev);(this._l.message||[]).forEach(f=>f(ev))}}
   WS.CONNECTING=0;WS.OPEN=1;WS.CLOSING=2;WS.CLOSED=3;
   w.WebSocket=WS;w.fetch=()=>Promise.reject(new Error('x'));
   w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({key:'k123',goal:10000}));
   if(pre)pre(w);
  }});
 return {dom,w:dom.window,d:dom.window.document,errors,socks,R:dom.window.document.documentElement};
}
(async()=>{
 // 1) activation on every link shape the app really produces
 const shapes=['#overlay','#overlay?k=k123&goal=5000&ws=wss%3A%2F%2Fx.test%2Fws','?aw=400#overlay?k=k123','?only=alert&edit=1#overlay?k=k123','#obs'];
 for(const u of shapes){
  const t=boot(u);await sleep(700);
  ok(t.R.classList.contains('rzx')&&typeof t.w.RZX==='object','v2 active on '+u+(t.errors.length?'  ERR '+t.errors[0]:''));
  ok(t.errors.length===0,'  0 script errors on '+u);
 }
 // 2) donor + admin pages must NOT get overlay behaviour
 let t=boot('');await sleep(600);
 ok(!t.R.classList.contains('rzx')&&!t.w.RZX,'donor page: v2 inactive');
 ok(t.errors.length===0,'donor page: 0 script errors');
 t=boot('#admin');await sleep(600);
 ok(!t.R.classList.contains('rzx'),'admin page: v2 inactive');

 // 3) config: defaults match the spec, query + hash params, clamping
 t=boot('#overlay?k=k123');await sleep(600);
 const s=t.R.style;
 ok(s.getPropertyValue('--aw')==='440px','default card width 440px');
 ok(s.getPropertyValue('--lg')==='200px','default logo 200px');
 ok(s.getPropertyValue('--sps')==='0.42','default spark scale 0.42');
 ok(s.getPropertyValue('--pad')==='52px','default effect padding 52px (fx=1)');
 t=boot('?aw=380&fs=1.2&lg=260&fx=2&shake=0&glitch=1#overlay?k=k123');await sleep(600);
 ok(t.R.style.getPropertyValue('--aw')==='380px'&&t.R.style.getPropertyValue('--fs')==='1.2'&&t.R.style.getPropertyValue('--lg')==='260px','aw / fs / lg from URL');
 ok(t.R.style.getPropertyValue('--pad')==='72px'&&t.R.style.getPropertyValue('--sps')==='0.62','fx=2 widens effect box + sparks');
 ok(t.R.classList.contains('rzx-noshake')&&t.R.classList.contains('rzx-glitch'),'shake=0 and glitch=1 classes');
 t=boot('?fx=0#overlay');await sleep(600);
 ok(t.R.classList.contains('rzx-fx0')&&t.R.style.getPropertyValue('--pad')==='16px','fx=0 => card only (no effects, tight box)');
 t=boot('#overlay?aw=500&fx=0');await sleep(600);
 ok(t.R.style.getPropertyValue('--aw')==='500px','params placed AFTER # also work');
 t=boot('?aw=400#overlay?aw=700');await sleep(600);
 ok(t.R.style.getPropertyValue('--aw')==='400px','?search wins over #hash params');

 // 4) layout editor values (--as/--ax/--ay) still honoured: 'ค่าที่เคยจัดไว้ใน Editor ยังอยู่ครบ'
 t=boot('#overlay',w=>w.localStorage.setItem('rzx_cfg',JSON.stringify({as:.8,ax:12,ay:-6,gx:30,gh:14})));await sleep(600);
 ok(t.R.style.getPropertyValue('--as')==='0.8'&&t.R.style.getPropertyValue('--ax')==='12'&&t.R.style.getPropertyValue('--ay')==='-6','saved scale/position restored from localStorage');
 ok(t.R.style.getPropertyValue('--gx')==='30'&&t.R.style.getPropertyValue('--gh')==='14px','saved goal-bar layout restored');

 // 5) CSS rules actually shipped, matching the spec the user gave
 const css=t.d.getElementById('rzx-css').textContent;
 ok(/--aw:440px/.test(css),'css: card 440px');
 ok(/#card \.ac-n\{[^}]*font-size:calc\(42px\*var\(--fs\)\)/.test(css),'css: name 42px');
 ok(/#card \.ac-l\{font-size:calc\(30px\*var\(--fs\)\)/.test(css),'css: amount 30px');
 ok(/#card \.ac-m\{[^}]*font-size:calc\(16px\*var\(--fs\)\)/.test(css)&&/-webkit-line-clamp:3/.test(css),'css: message 16px, 3 lines max');
 ok(/#card \.ac-n\{[^}]*line-height:1\.12/.test(css),'css: name line-height 1.12 (Thai vowels/tone marks not clipped)');
 ok(/tabular-nums/.test(css),'css: tabular numerals for the amount');
 ok(/#flash\{position:absolute!important/.test(css)&&!/#flash\{position:fixed/.test(css),'css: flash is inside the card frame, not fixed full-screen');
 ok(!/scale\(7\)/.test(css),'css: no 7x logo fly-in');
 ok(!/150vmin/.test(css),'css: no 150vmin shockwave');
 ok(/mask-image/.test(css),'css: soft fade at the frame edge (no hard clip)');
 ok(!t.d.getElementById('rzx-compact-css'),'old compact-v1 layer is gone');
 ok(t.d.querySelectorAll('style#rzx-css').length===1&&t.d.querySelectorAll('script#rzx-js').length===1,'exactly one v2 style + one v2 script (v1 fully removed)');

 // 6) fire a real alert through the relay socket: card shows, name fits, no errors
 t=boot('#overlay?k=k123');await sleep(800);
 const sock=t.socks[0];
 ok(!!sock,'overlay opened a relay socket');
 sock._emit({t:'alert',d:{id:'a1',name:'Alice',amount:500,message:'สวัสดีครับ'}});
 let shown=false;for(let i=0;i<40;i++){await sleep(60);if(t.d.getElementById('stage').classList.contains('active')){shown=true;break}}
 ok(shown,'real relay alert activates the stage');
 await sleep(1200);
 ok((t.d.getElementById('aName').textContent||'')==='ALICE','alert name rendered');
 ok(t.R.classList.contains('rzx-gl'),'glitch-on-open class applied at card open');
 ok(t.R.classList.contains('rzx-t2'),'500 baht => tier 2 glow class');
 ok(t.errors.length===0,'alert playback: 0 script errors '+(t.errors[0]||''));
 ok(!!t.d.getElementById('rzx-lcf'),'confetti canvas created INSIDE the card frame (#shaker), not on body');
 ok(t.d.getElementById('rzx-lcf').parentNode.id==='shaker','confetti canvas parent is #shaker');

 // 7) hostile name/message is escaped in widgets (ticker/top/last)
 t=boot('?widgets=ticker,top,last#overlay?k=k123');await sleep(700);
 t.socks[0]._emit({t:'alert',d:{id:'x9',name:'<img src=x onerror=window.__pwn=1>',amount:50,message:'<b>hi</b>'}});
 await sleep(500);
 ok(!t.w.__pwn&&!t.d.querySelector('.rzx-w img'),'widgets escape hostile donor text');

 // 8) editor: panel builds, links keep the app params (k/ws/goal) so a new OBS source joins the same room
 t=boot('?edit=1#overlay?k=k123&goal=7000&ws=wss%3A%2F%2Fr.test%2Fws');await sleep(900);
 ok(!!t.d.getElementById('rzx-panel')&&!!t.d.getElementById('rzx-ghost'),'editor panel + ghost frame present');
 const urls=[...t.d.querySelectorAll('#rzx-urls input')].map(i=>i.value);
 ok(urls.length===7,'7 OBS links generated ('+urls.length+')');
 ok(urls.every(u=>/#overlay\?/.test(u)&&/k=k123/.test(u)&&/goal=7000/.test(u)&&/ws=wss%3A%2F%2Fr\.test%2Fws/.test(u)),'every copied link keeps k / goal / ws');
 ok(urls.every(u=>!/edit=1/.test(u)),'copied links never contain edit=1');
 ok(/only=alert/.test(urls[1]),'Alert link has only=alert');
 // change width in editor -> link reflects it
 const aw=t.d.querySelector('[data-k="aw"]');aw.value=520;aw.dispatchEvent(new t.w.Event('input',{bubbles:true}));await sleep(100);
 ok(t.R.style.getPropertyValue('--aw')==='520px','editor slider changes card width live');
 ok(/aw=520/.test(t.d.querySelectorAll('#rzx-urls input')[1].value),'editor link carries aw=520');
 ok(JSON.parse(t.w.localStorage.getItem('rzx_cfg')).aw===520,'editor value persisted to localStorage');
 // long-test button doesn't crash
 t.d.querySelector('[data-a="long"]').click();await sleep(1200);
 ok(t.errors.length===0,'long name/message test: 0 script errors '+(t.errors[0]||''));
 // reset
 t.d.querySelector('[data-a="reset"]').click();await sleep(100);
 ok(t.R.style.getPropertyValue('--aw')==='440px','reset layout restores 440px');

 // 8) regression: donation bookkeeping (widgets=top,last)
 {
  const t=boot('?widgets=top,last#overlay?k=k123');await sleep(600);
  const hist=()=>JSON.parse(t.w.localStorage.getItem('rzx_hist')||'[]');
  // same donor + same amount + no id, twice within 20s => two donations, not one
  t.socks[0]._emit({t:'alert',d:{name:'Aom',amount:100,message:'a'}});
  t.socks[0]._emit({t:'alert',d:{name:'Aom',amount:100,message:'b'}});
  await sleep(150);
  ok(hist().length===2,'two identical-looking donations without id are both recorded ('+hist().length+')');
  const topTxt=t.d.querySelector('#rzx-top .rzx-ol').textContent;
  ok(/฿200/.test(topTxt),'Top Donors sums both donations to 200 ('+topTxt+')');
  // relay re-sending the SAME id must still dedupe
  t.socks[0]._emit({t:'alert',d:{id:'dup1',name:'Z',amount:40,message:''}});
  t.socks[0]._emit({t:'alert',d:{id:'dup1',name:'Z',amount:40,message:''}});
  await sleep(150);
  ok(hist().filter(x=>x.k==='dup1').length===1,'same id delivered twice is recorded once');
  // negative / garbage amounts never become positive money
  t.socks[0]._emit({t:'alert',d:{id:'neg1',name:'Neg',amount:'-500',message:''}});
  await sleep(100);
  ok(hist().filter(x=>x.k==='neg1')[0].a===0,'"-500" is not turned into +500');
  t.socks[0]._emit({t:'alert',d:{id:'cm1',name:'Comma',amount:'1,250.50',message:''}});
  await sleep(100);
  ok(hist().filter(x=>x.k==='cm1')[0].a===1250.5,'"1,250.50" parses to 1250.5');
  ok(t.errors.length===0,'bookkeeping: 0 script errors '+(t.errors[0]||''));
 }

 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('TEST CRASH',e);process.exit(2)});

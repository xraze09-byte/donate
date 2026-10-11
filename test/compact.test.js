// Compact donation alert (OBS overlay). Runs the REAL index.html in jsdom (no layout engine, so we check
// classes, injected CSS rules, timeline timings and confetti origin rather than pixel sizes).
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function boot(hash){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){
   class WS{constructor(){this.readyState=1}send(){}close(){}};w.WebSocket=WS;w.fetch=()=>Promise.reject(new Error('x'));
   w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.AudioContext=undefined;w.webkitAudioContext=undefined;
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({key:'k123',goal:10000}));
  }});
 return {dom,w:dom.window,d:dom.window.document,errors};
}
(async()=>{
 // 1) overlay boots in compact mode, no errors
 let t=boot('#overlay?k=k123');await sleep(900);
 ok(t.errors.length===0,'overlay: 0 script errors '+(t.errors[0]||''));
 ok(t.d.documentElement.classList.contains('rzx-compact'),'overlay enters compact mode by default');
 const css=t.d.getElementById('rzx-compact-css');
 ok(!!css,'compact stylesheet present');
 const c=css?css.textContent:'';
 ok(/body\.obs #shaker\{width:min\(var\(--aw,460px\)/.test(c),'card width capped (~460px, was up to 880px)');
 ok(/\.shk,body\.obs \.strk,body\.obs #cracks\{display:none/.test(c),'full-screen ring / rays / cracks hidden');
 ok(/body\.obs #flash\{[^}]*display:none/.test(c),'full-screen white flash disabled');
 ok(/#logoWrap\{width:54px;height:54px/.test(c),'logo shrunk from 370px to 54px badge');
 ok(/\.ac-n\{font-size:clamp\(1\.5rem,5vw,2\.1rem\)/.test(c),'name max size cut from ~99px to ~34px');
 ok(!/scale\(7\)/.test(c),'no 7x fly-in scale in compact layer');
 ok(/line-clamp:3/.test(c)&&/line-clamp:2/.test(c),'long names/messages clamp (2 / 3 lines) so card never grows huge');

 // 2) doesn't leak into donor page
 t=boot('');await sleep(600);
 ok(!t.d.documentElement.classList.contains('rzx-compact'),'donor page is NOT put into compact mode');
 ok(t.errors.length===0,'donor page: 0 script errors');

 // 3) ?big=1 restores old look (stylesheet removed)
 t=boot('#overlay?k=k123&big=1');await sleep(900);
 ok(t.d.documentElement.classList.contains('rzx-big')&&!t.d.documentElement.classList.contains('rzx-compact'),'?big=1 -> old full-scene look');
 ok(!t.d.getElementById('rzx-compact-css'),'?big=1 removes compact stylesheet');

 // 4) ?aw= width option, clamped
 t=boot('#overlay?k=k123&aw=520');await sleep(900);
 ok(t.d.documentElement.style.getPropertyValue('--aw')==='520px','?aw=520 sets card width');
 t=boot('#overlay?k=k123&aw=9999');await sleep(900);
 ok(t.d.documentElement.style.getPropertyValue('--aw')==='','?aw out of range ignored');

 // 5) user's Layout Editor scale/position still honoured (compact must not override --as/--ax/--ay rule)
 t=boot('#overlay?k=k123&as=0.8&ax=10&ay=-5');await sleep(900);
 ok(t.d.documentElement.style.getPropertyValue('--as')==='0.8','layout-editor scale still applied on top (--as=0.8)');
 ok(!/--as|--ax|--ay/.test(c),'compact layer does not redefine --as/--ax/--ay');

 // 6) play(): timeline is shorter in compact mode; fire a real alert and observe card.in timing
 t=boot('#overlay?k=k123&as=1');await sleep(900);
 const w=t.w;let fired=false;
 try{ if(w.RZX&&w.RZX.test){w.RZX.test(500);fired=true} }catch(e){}
 if(!fired){ try{ w.dispatchEvent(new w.StorageEvent('storage',{key:'rzc_bus_v4',newValue:JSON.stringify({t:'alert',d:{name:'Alice',amount:500,message:'hello',ts:Date.now(),id:'x1'}})}));fired=true }catch(e){} }
 const card=t.d.getElementById('card');
 const t0=Date.now();let tIn=-1;
 for(let i=0;i<40;i++){await sleep(50);if(card.classList.contains('in')){tIn=Date.now()-t0;break}}
 ok(fired,'alert fired through the real overlay path');
 ok(tIn>=0&&tIn<650,'card appears fast in compact mode ('+tIn+'ms; was ~780ms+)');
 await sleep(900);
 ok(t.errors.length===0,'alert playback: 0 script errors '+(t.errors[0]||''));
 ok((t.d.getElementById('aName').textContent||'').length>0,'alert text rendered');
 const sp=t.d.querySelectorAll('#sparks i').length;
 ok(sp<=14,'sparks capped in compact mode ('+sp+' <= 14; was up to 140)');
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('TEST CRASH',e);process.exit(2)});
